# 📧 check-alerts — Alertas Diários do Tulipa CRM

Edge Function que verifica diariamente reuniões atrasadas e contratos próximos da renovação, enviando um e-mail consolidado via [Resend](https://resend.com).

---

## 📋 O que a função faz

1. **Reuniões atrasadas** — Busca na tabela `reunioes` registros com `status = 'agendada'` cuja `data_reuniao` já passou, incluindo o nome do cliente via join com `clientes`.
2. **Renovações próximas (≤30 dias)** — Busca na tabela `contratos` registros com `status = 'ativo'`, `tipo = 'planejamento'` e `data_fim` dentro dos próximos 30 dias, incluindo o nome do cliente.
3. **E-mail HTML** — Se houver pelo menos um alerta, envia um e-mail estilizado em português (PT-BR) via API da Resend.
4. **Sem spam** — Se não houver alertas, a função retorna sucesso sem enviar nenhum e-mail.

---

## 🔧 Variáveis de Ambiente (Secrets)

Configure as seguintes variáveis no Supabase Dashboard em **Settings → Edge Functions → Secrets**:

| Variável                    | Descrição                                          | Exemplo                              |
| --------------------------- | -------------------------------------------------- | ------------------------------------ |
| `SUPABASE_URL`              | URL do projeto Supabase (já disponível por padrão) | `https://xxxxx.supabase.co`          |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (já disponível por padrão)        | `eyJhbGci...`                        |
| `RESEND_API_KEY`            | Chave da API Resend                                | `re_xxxxxxxxx`                       |
| `ALERT_RECIPIENT_EMAIL`     | E-mail que receberá os alertas                     | `consultor@financeiro.com.br`        |

> **Nota:** `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo Supabase. Você só precisa adicionar `RESEND_API_KEY` e `ALERT_RECIPIENT_EMAIL`.

### Adicionando secrets via CLI

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
supabase secrets set ALERT_RECIPIENT_EMAIL=consultor@financeiro.com.br
```

---

## 🚀 Deploy

```bash
# Na raiz do projeto (onde está a pasta supabase/)
supabase functions deploy check-alerts --project-ref <seu-project-ref>
```

---

## ⏰ Configurando o Cron (Agendamento Diário)

A função deve ser disparada diariamente às **08:00 BRT** (11:00 UTC).

### Opção 1: Via SQL (recomendado)

Execute no **SQL Editor** do Supabase Dashboard:

```sql
-- Habilitar extensões necessárias (se ainda não estiverem habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Agendar o cron job para rodar diariamente às 11:00 UTC (08:00 BRT)
SELECT cron.schedule(
  'daily-alerts',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<SEU-PROJECT-REF>.supabase.co/functions/v1/check-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || '<SUA-ANON-KEY>'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

> ⚠️ Substitua `<SEU-PROJECT-REF>` e `<SUA-ANON-KEY>` pelos valores reais do seu projeto.

### Opção 2: Via Supabase Dashboard

1. Acesse **Database → Extensions** e habilite `pg_cron` e `pg_net`
2. Acesse **Database → Cron Jobs**  
3. Clique em **"Create a new cron job"**
4. Configure:
   - **Name:** `daily-alerts`
   - **Schedule:** `0 11 * * *`
   - **Command:** cole o bloco SQL acima (sem o `SELECT cron.schedule(...)` wrapper)

### Gerenciamento do Cron

```sql
-- Listar todos os jobs agendados
SELECT * FROM cron.job;

-- Remover o job
SELECT cron.unschedule('daily-alerts');

-- Ver logs de execução
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

---

## 🧪 Teste Local

### 1. Inicie o Supabase local

```bash
supabase start
```

### 2. Sirva a função localmente

```bash
supabase functions serve check-alerts --env-file .env.local
```

### 3. Crie um arquivo `.env.local` na raiz do projeto

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<sua-service-role-key-local>
RESEND_API_KEY=re_xxxxxxxxx
ALERT_RECIPIENT_EMAIL=dev@teste.com
```

### 4. Dispare manualmente via cURL

```bash
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/check-alerts' \
  --header 'Authorization: Bearer <SUA-ANON-KEY-LOCAL>' \
  --header 'Content-Type: application/json' \
  --data '{}'
```

### Respostas esperadas

**Com alertas (200):**
```json
{
  "success": true,
  "message": "E-mail de alertas enviado com sucesso.",
  "email_id": "abc-123",
  "reunioes_atrasadas": 3,
  "renovacoes_proximas": 2,
  "destinatario": "consultor@financeiro.com.br"
}
```

**Sem alertas (200):**
```json
{
  "success": true,
  "message": "Nenhum alerta para hoje.",
  "reunioes_atrasadas": 0,
  "renovacoes_proximas": 0
}
```

**Erro de configuração (500):**
```json
{
  "error": "Configuração da API Resend ausente."
}
```

---

## 🗄️ Tabelas Utilizadas

| Tabela      | Campos utilizados                                       |
| ----------- | ------------------------------------------------------- |
| `reunioes`  | `id`, `data_reuniao`, `status`, `cliente_id`            |
| `contratos` | `id`, `descricao`, `data_fim`, `status`, `tipo`, `consultor_id`, `cliente_id` |
| `clientes`  | `nome` (via join / foreign key)                         |

---

## 📐 Arquitetura

```
check-alerts/
└── index.ts          ← Edge Function principal
```

```
[pg_cron: 08:00 BRT]
       │
       ▼
  net.http_post()
       │
       ▼
  Edge Function
  /check-alerts
       │
       ├── Query: reuniões atrasadas
       ├── Query: renovações ≤30 dias
       │
       ▼
  Resend API
  (envio de e-mail)
       │
       ▼
  📧 Consultor
```

---

## 🔒 Segurança

- A função utiliza **Service Role Key** para bypass de RLS, permitindo consultar dados de todos os consultores.
- As secrets são armazenadas de forma segura no Supabase e nunca expostas no código.
- O endpoint deve ser protegido por autenticação (a `anon key` no header do cron já provê isso).
