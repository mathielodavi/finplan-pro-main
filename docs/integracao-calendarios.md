# Integração de calendários externos — Implementado

> Status: **implementado**. Este documento descreve a abordagem adotada para validar, na
> tela de Atendimento, se cada cliente possui ou não um agendamento formalizado em um
> calendário externo (Google/Microsoft), exibindo as tags **"Em agenda"** / **"Fora da
> agenda"**.

## Contexto e restrições

- A intenção é **apenas leitura/visualização**: saber se há ou não marcação para o
  cliente (hoje e no futuro). Não é necessário criar/editar eventos.
- Há preocupação com **restrições de TI** sobre conectar aplicativos externos via
  OAuth. Por isso, evitamos OAuth como caminho primário.

## Abordagem recomendada: assinatura ICS (read-only)

Em vez de OAuth, usar a **URL secreta de calendário em formato iCal (ICS)** que tanto
Google quanto Microsoft/Outlook oferecem nativamente:

- **Google Calendar**: Configurações do calendário → "Endereço secreto no formato iCal".
- **Microsoft/Outlook**: Configurações → Calendário → Compartilhar/Publicar → link ICS.

O consultor cola essa URL uma vez. O sistema baixa e faz o parse do feed ICS
periodicamente. Sem OAuth, sem escopos, sem app registrado — apenas um GET HTTP a
uma URL. Fricção de TI mínima.

## 1. Modelo de dados (aplicado)

```sql
CREATE TABLE public.calendario_conexoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provedor text NOT NULL CHECK (provedor IN ('google', 'microsoft', 'ics')),
  ics_url text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ultima_sync timestamptz,
  ultimo_erro text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendario_conexoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Consultor gerencia sua própria conexão"
  ON public.calendario_conexoes FOR ALL
  USING (consultor_id = auth.uid());

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS em_agenda_externa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS em_agenda_ate date;

-- Rastreamento de reuniões geradas automaticamente pelo sync (ver seção 2).
ALTER TABLE public.reunioes
  ADD COLUMN IF NOT EXISTS calendario_evento_uid text,
  ADD COLUMN IF NOT EXISTS link_reuniao text;

CREATE UNIQUE INDEX IF NOT EXISTS reunioes_calendario_por_cliente_idx
  ON public.reunioes (cliente_id)
  WHERE calendario_evento_uid IS NOT NULL;
```

- `calendario_conexoes`: uma linha por consultor (múltiplos provedores no futuro
  poderiam usar múltiplas linhas, mas a UI inicial assume uma conexão ativa por vez).
- `ultimo_erro`: guarda a última falha de sincronização (ex.: "URL inválida", "feed
  vazio", "timeout") para exibir na UI de configuração — não estava no desenho
  original, adicionado para dar feedback ao consultor sem precisar olhar logs.
- `clientes.em_agenda_externa` / `em_agenda_ate`: cache do resultado do último sync,
  lido diretamente pela UI de Pautas (sem precisar buscar/parsear ICS em tempo real).

## 2. Matching evento → cliente

Heurística em ordem de prioridade (a primeira que casar decide):

1. **E-mail do participante** do evento (`ATTENDEE`/`ORGANIZER` do VEVENT) ==
   `clientes.email`.
2. **Nome do cliente** contido no título ou descrição do evento — comparação
   tolerante: exige que pelo menos 2 das palavras significativas do nome (ou todas,
   se o nome só tiver 1-2 palavras) apareçam como palavra inteira em qualquer lugar
   do texto, em qualquer ordem — não o nome completo como substring exata. Isso
   cobre o caso comum de o nome no CRM ter mais partes do que o digitado no
   calendário (ex.: CRM "Cynthia Honorato **Val**", evento só "Cynthia Honorato").
   **Salvaguarda de segurança**: se o evento já tem uma lista de participantes
   conhecida (`ATTENDEE`) e o e-mail do cliente não está nela, o match por nome é
   descartado — evita casar com a reunião de outra pessoa que só menciona o nome do
   cliente de passagem.
3. **Telefone** do cliente presente na descrição do evento (fallback, menor
   confiabilidade — números costumam aparecer sem formatação padronizada).

### Reunião automática (`reunioes`)

Além da tag "Em agenda", quando um cliente casa com um evento a Pauta ganha uma
`reuniao` sincronizada automaticamente (`status='agendada'`, `data_reuniao` = horário
do evento), refletindo direto no "Próxima Ação"/atraso-próxima da lista de clientes —
não é só um badge informativo. Rastreamento via `reunioes.calendario_evento_uid`
(UID do VEVENT) com índice único parcial por `cliente_id`: no máximo **uma** reunião
"gerenciada pelo sync" por cliente, sempre atualizada (nunca duplicada) a cada nova
sincronização. Reuniões criadas manualmente pelo consultor (`calendario_evento_uid`
`NULL`) nunca são tocadas pelo sync. Se o cliente deixar de casar com qualquer evento,
a reunião existente **não é cancelada automaticamente** (fora do escopo desta rodada).

### Fuso horário

Outlook/Exchange costuma exportar `DTSTART;TZID=E. South America Standard Time:...`
(hora local de Brasília, sem sufixo `Z`). O parser reconhece esse TZID (e variantes
IANA como `America/Sao_Paulo`) e converte para UTC de verdade (-03:00 fixo — Brasil
não observa horário de verão desde 2019). TZIDs não reconhecidos caem no
comportamento anterior (horário "flutuante", sem conversão).

### Link de chamada (Teams)

Extraído de `X-MICROSOFT-SKYPETEAMSMEETINGURL` (propriedade dedicada que o
Outlook/Exchange inclui em reuniões do Teams) ou, na ausência dela, por regex sobre a
`DESCRIPTION` procurando uma URL `teams.microsoft.com/l/meetup-join/...`. Guardado em
`reunioes.link_reuniao`. Na mensagem de WhatsApp da categoria "Próximas"
([utils/whatsappUtils.ts](../utils/whatsappUtils.ts) `montarMensagemAgenda`), quando
presente, é anexado um parágrafo extra: "Utilize o link ao lado para acessar nossa
chamada: `<LINK>`".

Apenas eventos com `DTSTART >= hoje` são considerados (feeds ICS podem conter anos de
histórico; não há necessidade de olhar para o passado).

## 3. Edge function `sync-calendarios` (esqueleto)

Segue o mesmo padrão estrutural de
[supabase/functions/check-alerts/index.ts](../supabase/functions/check-alerts/index.ts)
(fetch de dados via `SUPABASE_SERVICE_ROLE_KEY`, chamada HTTP externa, tratamento de
erro por item, resposta JSON estruturada):

1. `SELECT * FROM calendario_conexoes WHERE ativo = true`.
2. Para cada conexão, dentro de um `try/catch` isolado (uma falha não deve
   interromper o processamento das demais conexões):
   a. `fetch(ics_url)` → texto ICS.
   b. **Implementado com parser manual de `VEVENT`** (sem `ical.js`) — unfold de linhas
      dobradas, `DTSTART` em `DATE`/`DATE-TIME` (UTC ou "flutuante", sem suporte a
      `RRULE`/recorrência), `SUMMARY`, `DESCRIPTION` e `ATTENDEE`/`ORGANIZER`
      (`mailto:`). Evita depender de uma lib externa via esm.sh dentro da edge function;
      suficiente para o caso de uso (visualização de eventos únicos/futuros, sem precisar
      expandir séries recorrentes).
   c. Filtra `VEVENT`s com `DTSTART >= hoje`.
   d. Busca `clientes` do mesmo `consultor_id` (`SELECT id, nome, email, telefone FROM
      clientes WHERE consultor_id = :consultor_id`).
   e. Para cada cliente, tenta casar com algum evento pela heurística da seção 2.
   f. `UPDATE clientes SET em_agenda_externa = true, em_agenda_ate = <data do evento
      casado mais distante> WHERE id IN (<casados>)`; e `em_agenda_externa = false,
      em_agenda_ate = null` para os demais clientes do consultor (garante que quem
      deixou de ter evento não fique com uma tag desatualizada).
   g. Em caso de sucesso: `UPDATE calendario_conexoes SET ultima_sync = now(),
      ultimo_erro = null`. Em caso de falha: `UPDATE calendario_conexoes SET
      ultimo_erro = <mensagem>` (sem atualizar `ultima_sync`).
3. Resposta final agrega quantas conexões foram processadas com sucesso/erro (mesmo
   estilo de resposta JSON de `check-alerts`).

**Cron** (`pg_cron` + `pg_net` — ambas as extensões foram habilitadas no projeto):

A anon key não fica em texto puro no job (isso ficaria armazenado em `cron.job`,
consultável indefinidamente). Em vez disso, ela foi guardada como secret no **Supabase
Vault** (`vault.create_secret(..., 'project_anon_key', ...)`) e o cron a referencia por
nome, decifrada só em tempo de execução:

```sql
SELECT cron.schedule(
  'sync-calendarios',
  '0 */6 * * *',  -- a cada 6 horas
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/sync-calendarios',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_anon_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

Periodicidade de 6h é suficiente para o caso de uso (visualização, não tempo real);
pode ser ajustada para 1x/dia se o volume de conexões crescer muito. Job agendado e
ativo (`cron.job`, `jobname = 'sync-calendarios'`).

## 4. Camada de serviço

`services/calendarioService.ts`:

```ts
type Provedor = 'google' | 'microsoft' | 'ics';

interface CalendarioConexao {
  id: string;
  consultor_id: string;
  provedor: Provedor;
  ics_url: string;
  ativo: boolean;
  ultima_sync: string | null;
  ultimo_erro: string | null;
}

// getConexao(): busca a conexão do consultor logado (auth.uid()), no máximo uma.
// salvarConexao(ics_url, provedor): upsert da conexão do consultor logado.
// removerConexao(id): remove a conexão (desliga a feature para aquele consultor).
// sincronizarAgora(): invoca a edge function sync-calendarios via supabase.functions.invoke,
//   para o botão "Sincronizar agora" da UI dar feedback imediato em vez de esperar o cron.
```

## 5. Onde o consultor cadastra a URL

Nova seção **"Calendário externo"** dentro de
[components/Configuracoes/PerfilConfig.tsx](../components/Configuracoes/PerfilConfig.tsx)
— aba "Meu Perfil" de [views/ConfiguracoesPage.tsx](../views/ConfiguracoesPage.tsx), o
lugar natural para configuração pessoal por consultor (`auth.uid()`), ao lado dos
campos de nome/telefone/avatar já editados ali hoje.

Elementos da seção:
- Campo de texto para a URL ICS.
- Seletor Google / Microsoft / Outro (só para rotular a conexão — o processamento é
  idêntico para os três, todos tratados como feed ICS).
- Botão "Sincronizar agora" → chama `calendarioService.sincronizarAgora()`.
- Exibição de `ultima_sync` (via `formatarData`) e, se houver, `ultimo_erro` em destaque.
  Implementado com uma caixa inline nos tokens do tema (`bg-danger/10`, `text-danger`),
  não com [Alert.tsx](../components/UI/Alert.tsx) — esse componente ainda usa cores claras
  hardcoded (`bg-rose-50` etc.), remanescentes de antes do redesign dark (mesmo problema
  encontrado e corrigido na reforma da tela Carteira).

## 6. UI de exibição (Atendimento / Pautas)

Em cada item das Pautas ([views/Dashboard.tsx](../views/Dashboard.tsx), lista de
`agendaHibrida`), renderizar via [Badge.tsx](../components/UI/Badge.tsx):

- **"Em agenda"** (`variant="success"`) quando `cliente.em_agenda_externa === true`.
- **"Fora da agenda"** (`variant="neutral"`) caso contrário.

A tag só deve aparecer se o consultor logado tiver uma `calendario_conexoes` ativa —
caso contrário, omitir completamente (não exibir "Fora da agenda" para todo mundo
apenas porque a integração nunca foi configurada, o que sugeriria um dado que não
existe).

## Alternativas consideradas

- **OAuth completo (Google/Microsoft Graph)**: mais rico (leitura estruturada,
  webhooks), porém exige apps registrados, client id/secret, consentimento e
  provável aprovação de TI. Descartado como caminho inicial pela fricção.
- **CalDAV read-only**: viável, mas mais complexo que ICS e com menor cobertura de
  configuração self-service pelo usuário final.

## Status de implementação

1. ✅ Migração aplicada (`calendario_conexoes` + `clientes.em_agenda_externa`/`em_agenda_ate`).
2. ✅ `services/calendarioService.ts` criado.
3. ✅ Edge function `sync-calendarios` criada e implantada (ativa no projeto).
4. ✅ Cron do sync periódico agendado a cada 6h, autenticado via secret no Supabase Vault.
5. ✅ Seção "Calendário externo" em `PerfilConfig.tsx`.
6. ✅ Badges "Em agenda"/"Fora da agenda" nas Pautas do Dashboard.

Sem uma URL ICS real configurada por um consultor, o fluxo fim-a-fim (parse de um feed de
verdade, matching contra a base de clientes) não pôde ser testado nesta rodada — a
verificação foi feita por leitura de código, `tsc --noEmit` e `npm run build`.
