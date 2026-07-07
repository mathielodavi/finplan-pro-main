// supabase/functions/sync-calendarios/index.ts
// Edge Function: Sincronização de calendários externos (ICS read-only)
// Disparo via cron a cada 6h (ver README desta pasta) ou sob demanda via
// calendarioService.sincronizarAgora() (botão "Sincronizar agora" no Perfil).
//
// Para cada calendario_conexoes.ativo, baixa o feed ICS, faz parse manual dos
// VEVENTs futuros e tenta casar cada um a um cliente do mesmo consultor por
// e-mail > nome > telefone. Atualiza clientes.em_agenda_externa/em_agenda_ate.
// Falha em uma conexão não interrompe o processamento das demais.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ─── Tipos auxiliares ────────────────────────────────────────────────────────

interface CalendarioConexao {
  id: string;
  consultor_id: string;
  ics_url: string;
  ativo: boolean;
}

interface Cliente {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
}

interface EventoIcs {
  uid: string | null;
  dtstart: Date;
  summary: string;
  description: string;
  attendeeEmails: string[];
  linkReuniao: string | null;
}

// ─── Utilidades de texto (equivalente a utils/formatadores.ts normalizarTexto) ─

function normalizarTexto(texto: string): string {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function somenteDigitos(texto: string): string {
  return (texto || "").replace(/\D/g, "");
}

function desescaparIcsTexto(valor: string): string {
  return valor
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

// Link de chamada do Teams: Outlook/Exchange costuma incluir a propriedade
// dedicada X-MICROSOFT-SKYPETEAMSMEETINGURL; alguns feeds só trazem o link
// dentro do corpo do DESCRIPTION ("Ingressar na reunião" etc.) — nesse caso
// buscamos a URL padrão do Teams como último recurso.
function extrairLinkTeamsDaDescricao(descricao: string): string | null {
  const m = descricao.match(/https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"'<>\]]+/i);
  return m ? m[0] : null;
}

// ─── Parser manual de ICS (VEVENT) ───────────────────────────────────────────
// Suporte suficiente para leitura (sem RRULE/recorrência): unfold de linhas
// dobradas, DTSTART em DATE ou DATE-TIME (UTC ou "flutuante"), SUMMARY,
// DESCRIPTION e ATTENDEE (mailto:).

function desdobrarLinhasIcs(texto: string): string[] {
  const linhasCru = texto.split(/\r\n|\n|\r/);
  const linhas: string[] = [];
  for (const linha of linhasCru) {
    if ((linha.startsWith(" ") || linha.startsWith("\t")) && linhas.length > 0) {
      linhas[linhas.length - 1] += linha.slice(1);
    } else {
      linhas.push(linha);
    }
  }
  return linhas;
}

// TZID's comuns para o fuso de Brasília (Windows e IANA) — Outlook/Exchange
// costuma exportar "E. South America Standard Time" em vez do IANA padrão.
// Brasil não observa horário de verão desde 2019, então -03:00 fixo é seguro.
function ehFusoBrasilia(tzid: string): boolean {
  const t = tzid.toLowerCase();
  return t.includes("sao_paulo") || t.includes("brasilia") || t.includes("south america");
}

function parsearDataIcs(valor: string, paramsDaChave?: string): Date | null {
  const v = valor.trim();
  // DATE-TIME: YYYYMMDDTHHMMSS[Z]
  const mDateTime = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (mDateTime) {
    const [, ano, mes, dia, hora, min, seg, z] = mDateTime;
    if (z) {
      return new Date(Date.UTC(+ano, +mes - 1, +dia, +hora, +min, +seg));
    }
    const tzidMatch = paramsDaChave?.match(/TZID=([^;:]+)/i);
    if (tzidMatch && ehFusoBrasilia(tzidMatch[1])) {
      // Horário local de Brasília (UTC-3) → converte para UTC de verdade.
      return new Date(Date.UTC(+ano, +mes - 1, +dia, +hora + 3, +min, +seg));
    }
    // TZID não reconhecido — mantém como horário "flutuante" no fuso do
    // servidor (comportamento anterior, mais seguro que assumir errado).
    return new Date(+ano, +mes - 1, +dia, +hora, +min, +seg);
  }
  // DATE (evento de dia inteiro): YYYYMMDD
  const mDate = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (mDate) {
    const [, ano, mes, dia] = mDate;
    return new Date(+ano, +mes - 1, +dia, 0, 0, 0);
  }
  return null;
}

function parsearEventosIcs(icsTexto: string): EventoIcs[] {
  const linhas = desdobrarLinhasIcs(icsTexto);
  const eventos: EventoIcs[] = [];

  let dentroDeEvento = false;
  let atual: {
    uid: string | null;
    dtstart: Date | null;
    summary: string;
    description: string;
    attendeeEmails: string[];
    linkTeams: string | null;
  } | null = null;

  for (const linhaRaw of linhas) {
    const linha = linhaRaw.trim();
    if (linha === "BEGIN:VEVENT") {
      dentroDeEvento = true;
      atual = { uid: null, dtstart: null, summary: "", description: "", attendeeEmails: [], linkTeams: null };
      continue;
    }
    if (linha === "END:VEVENT") {
      if (atual && atual.dtstart) {
        const description = desescaparIcsTexto(atual.description);
        eventos.push({
          uid: atual.uid,
          dtstart: atual.dtstart,
          summary: desescaparIcsTexto(atual.summary),
          description,
          attendeeEmails: atual.attendeeEmails,
          linkReuniao: atual.linkTeams ? desescaparIcsTexto(atual.linkTeams) : extrairLinkTeamsDaDescricao(description),
        });
      }
      dentroDeEvento = false;
      atual = null;
      continue;
    }
    if (!dentroDeEvento || !atual) continue;

    const idx = linha.indexOf(":");
    if (idx === -1) continue;
    const chaveComParams = linha.slice(0, idx);
    const valor = linha.slice(idx + 1);
    const chave = chaveComParams.split(";")[0].toUpperCase();

    if (chave === "UID") {
      atual.uid = valor.trim();
    } else if (chave === "DTSTART") {
      atual.dtstart = parsearDataIcs(valor, chaveComParams);
    } else if (chave === "SUMMARY") {
      atual.summary = valor;
    } else if (chave === "DESCRIPTION") {
      atual.description = valor;
    } else if (chave === "X-MICROSOFT-SKYPETEAMSMEETINGURL") {
      atual.linkTeams = valor.trim();
    } else if (chave === "ATTENDEE" || chave === "ORGANIZER") {
      const mMailto = valor.match(/mailto:(.+)/i);
      if (mMailto) atual.attendeeEmails.push(mMailto[1].trim().toLowerCase());
    }
  }

  return eventos;
}

// ─── Matching evento → cliente ───────────────────────────────────────────────
// Prioridade: e-mail do participante > nome do cliente no título/descrição >
// telefone do cliente na descrição.

function escaparRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function primeiroNome(nome: string): string {
  return normalizarTexto(nome).split(/\s+/)[0] || "";
}

function contemPalavra(texto: string, palavra: string): boolean {
  return new RegExp(`\\b${escaparRegExp(palavra)}\\b`).test(texto);
}

/**
 * Compara o nome do cliente (como cadastrado no CRM, que pode ter mais partes —
 * ex.: "Cynthia Honorato Val") ao texto do evento (que costuma ter só parte do
 * nome, ex.: "Cynthia Honorato" digitado à mão no calendário). Em vez de exigir
 * o nome completo como substring exata, exige que pelo menos 2 das palavras
 * significativas do nome (ou todas, se o nome só tiver 1-2 palavras) apareçam
 * como palavra inteira em qualquer lugar do texto, em qualquer ordem.
 */
function nomeCompativelComTexto(nomeCliente: string, texto: string): boolean {
  const tokens = normalizarTexto(nomeCliente).split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  const textoNormalizado = normalizarTexto(texto);
  const presentes = tokens.filter((t) => contemPalavra(textoNormalizado, t)).length;
  const minimoNecessario = Math.min(2, tokens.length);
  return presentes >= minimoNecessario;
}

function encontrarEventoCasado(
  cliente: Cliente,
  eventos: EventoIcs[],
  contagemPrimeiroNome: Map<string, number>
): EventoIcs | null {
  const candidatos: EventoIcs[] = [];
  const emailCliente = cliente.email ? cliente.email.trim().toLowerCase() : null;

  if (emailCliente) {
    candidatos.push(...eventos.filter((e) => e.attendeeEmails.includes(emailCliente)));
  }
  if (candidatos.length === 0 && cliente.nome) {
    const pn = primeiroNome(cliente.nome);
    // Só aceita casar pelo primeiro nome isolado (ex.: evento só diz "Raquel",
    // sem o sobrenome) quando esse primeiro nome é único entre os clientes deste
    // consultor — evita ambiguidade entre clientes que compartilham o mesmo nome.
    const primeiroNomeEhUnico = pn.length >= 3 && (contagemPrimeiroNome.get(pn) || 0) === 1;
    candidatos.push(
      ...eventos.filter((e) => {
        // Evento tem lista de participantes conhecida e o cliente não está nela?
        // Provavelmente é a reunião de outra pessoa que só menciona o nome do
        // cliente de passagem (ex.: "Follow-up sobre Cynthia") — não casa por nome.
        if (e.attendeeEmails.length > 0 && emailCliente && !e.attendeeEmails.includes(emailCliente)) return false;
        const texto = `${e.summary} ${e.description}`;
        if (nomeCompativelComTexto(cliente.nome, texto)) return true;
        if (primeiroNomeEhUnico) return contemPalavra(normalizarTexto(texto), pn);
        return false;
      })
    );
  }
  if (candidatos.length === 0 && cliente.telefone) {
    const telDigitos = somenteDigitos(cliente.telefone);
    if (telDigitos.length >= 8) {
      candidatos.push(...eventos.filter((e) => somenteDigitos(e.description).includes(telDigitos)));
    }
  }

  if (candidatos.length === 0) return null;
  // Evento casado mais distante no futuro.
  return candidatos.reduce((mais, atual) => (atual.dtstart > mais.dtstart ? atual : mais));
}

// ─── Handler principal ────────────────────────────────────────────────────────

serve(async (_req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
      return new Response(
        JSON.stringify({ error: "Configuração do Supabase ausente." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: conexoes, error: errConexoes } = await supabase
      .from("calendario_conexoes")
      .select("id, consultor_id, ics_url, ativo")
      .eq("ativo", true);

    if (errConexoes) {
      console.error("Erro ao buscar conexões de calendário:", errConexoes);
      return new Response(
        JSON.stringify({ error: "Falha ao consultar conexões.", details: errConexoes.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let conexoesOk = 0;
    let conexoesComErro = 0;
    const resultadosPorConexao: Array<{ conexao_id: string; ok: boolean; casados?: number; erro?: string }> = [];

    for (const conexao of (conexoes ?? []) as CalendarioConexao[]) {
      try {
        const icsRes = await fetch(conexao.ics_url);
        if (!icsRes.ok) {
          throw new Error(`Falha ao baixar ICS (HTTP ${icsRes.status})`);
        }
        const icsTexto = await icsRes.text();
        const eventosFuturos = parsearEventosIcs(icsTexto).filter((e) => e.dtstart >= hoje);

        const { data: clientesConsultor, error: errClientes } = await supabase
          .from("clientes")
          .select("id, nome, email, telefone")
          .eq("consultor_id", conexao.consultor_id);

        if (errClientes) throw errClientes;

        const contagemPrimeiroNome = new Map<string, number>();
        for (const cliente of (clientesConsultor ?? []) as Cliente[]) {
          const pn = primeiroNome(cliente.nome);
          contagemPrimeiroNome.set(pn, (contagemPrimeiroNome.get(pn) || 0) + 1);
        }

        const casados: Array<{ id: string; evento: EventoIcs }> = [];
        const naoCasados: string[] = [];

        for (const cliente of (clientesConsultor ?? []) as Cliente[]) {
          const eventoCasado = encontrarEventoCasado(cliente, eventosFuturos, contagemPrimeiroNome);
          if (eventoCasado) {
            casados.push({ id: cliente.id, evento: eventoCasado });
          } else {
            naoCasados.push(cliente.id);
          }
        }

        // Atualiza casados (data varia por cliente, update individual) e sincroniza
        // a reunião correspondente (criando ou atualizando — nunca duplicando,
        // graças ao índice único parcial por cliente_id em calendario_evento_uid).
        for (const c of casados) {
          const { error: errUpdate } = await supabase
            .from("clientes")
            .update({ em_agenda_externa: true, em_agenda_ate: c.evento.dtstart.toISOString().split("T")[0] })
            .eq("id", c.id);
          if (errUpdate) throw errUpdate;

          if (c.evento.uid) {
            let { data: reuniaoExistente, error: errBuscaReuniao } = await supabase
              .from("reunioes")
              .select("id")
              .eq("cliente_id", c.id)
              .not("calendario_evento_uid", "is", null)
              .maybeSingle();
            if (errBuscaReuniao) throw errBuscaReuniao;

            // Ainda não há reunião gerenciada pelo sync para este cliente: em vez de
            // criar uma nova (duplicando a agenda), adota o agendamento "agendada"
            // manual mais próximo, se existir, passando a gerenciá-lo a partir daqui.
            if (!reuniaoExistente) {
              const { data: manual, error: errBuscaManual } = await supabase
                .from("reunioes")
                .select("id")
                .eq("cliente_id", c.id)
                .eq("status", "agendada")
                .is("calendario_evento_uid", null)
                .order("data_reuniao", { ascending: true })
                .limit(1)
                .maybeSingle();
              if (errBuscaManual) throw errBuscaManual;
              reuniaoExistente = manual;
            }

            const payloadReuniao = {
              data_reuniao: c.evento.dtstart.toISOString(),
              status: "agendada",
              calendario_evento_uid: c.evento.uid,
              link_reuniao: c.evento.linkReuniao,
            };

            if (reuniaoExistente) {
              const { error: errUpdateReuniao } = await supabase
                .from("reunioes")
                .update(payloadReuniao)
                .eq("id", reuniaoExistente.id);
              if (errUpdateReuniao) throw errUpdateReuniao;
            } else {
              const { error: errInsertReuniao } = await supabase
                .from("reunioes")
                .insert([{
                  cliente_id: c.id,
                  notas: "Sincronizado automaticamente do calendário externo.",
                  ...payloadReuniao,
                }]);
              if (errInsertReuniao) throw errInsertReuniao;
            }
          }
        }

        // Limpa quem deixou de ter evento casado (não afeta reuniões — se o cliente
        // já teve uma reunião vinculada ao calendário, ela permanece intacta até um
        // novo evento a substitua; não excluímos/cancelamos automaticamente).
        if (naoCasados.length > 0) {
          const { error: errReset } = await supabase
            .from("clientes")
            .update({ em_agenda_externa: false, em_agenda_ate: null })
            .in("id", naoCasados);
          if (errReset) throw errReset;
        }

        await supabase
          .from("calendario_conexoes")
          .update({ ultima_sync: new Date().toISOString(), ultimo_erro: null })
          .eq("id", conexao.id);

        conexoesOk++;
        resultadosPorConexao.push({ conexao_id: conexao.id, ok: true, casados: casados.length });
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : String(err);
        console.error(`Erro ao sincronizar conexão ${conexao.id}:`, mensagem);
        conexoesComErro++;
        resultadosPorConexao.push({ conexao_id: conexao.id, ok: false, erro: mensagem });
        try {
          await supabase.from("calendario_conexoes").update({ ultimo_erro: mensagem }).eq("id", conexao.id);
        } catch (errSalvarErro) {
          console.error("Falha ao gravar ultimo_erro:", errSalvarErro);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        conexoes_processadas: (conexoes ?? []).length,
        conexoes_ok: conexoesOk,
        conexoes_com_erro: conexoesComErro,
        detalhes: resultadosPorConexao,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro inesperado na Edge Function sync-calendarios:", err);
    return new Response(
      JSON.stringify({
        error: "Erro interno na Edge Function.",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
