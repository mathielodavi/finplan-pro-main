// supabase/functions/sync-calendarios/index.ts
// Edge Function: Sincronização de calendários externos (ICS read-only)
// Disparo via cron a cada 6h (ver docs/integracao-calendarios.md) ou sob demanda via
// calendarioService.sincronizarAgora() (botão "Sincronizar agora" no Perfil).
//
// Para cada calendario_conexoes.ativo, baixa o feed ICS, expande os VEVENTs futuros (inclusive
// séries) e tenta casar cada cliente do mesmo consultor por e-mail > nome > telefone. Atualiza
// clientes.em_agenda_externa/em_agenda_ate e a reunião vinculada, e grava em
// calendario_conexoes.ultimo_diagnostico o que ficou sem cliente (coluna sob RLS do consultor).
// Falha em um cliente ou conexão não interrompe o processamento dos demais.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  Cliente,
  EventoIcs,
  EventoSemCliente,
  encontrarEventoCasado,
  eventosAPartirDe,
  motivoSemCliente,
  parsearEventosIcs,
  primeiroNome,
} from "./logica.ts";

interface CalendarioConexao {
  id: string;
  consultor_id: string;
  ics_url: string;
  ativo: boolean;
}

const JANELA_DIAGNOSTICO_DIAS = 60;
const MAX_ITENS_DIAGNOSTICO = 50;

/** Dia do evento no horário de Brasília, para comparar com o dia de uma reunião manual. */
function diaBrasilia(data: Date | string): string {
  return new Date(new Date(data).getTime() - 3 * 60 * 60 * 1000).toISOString().split("T")[0];
}

/**
 * Sincroniza a reunião do evento casado (criando ou atualizando — nunca duplicando, graças ao
 * índice único parcial por cliente_id em calendario_evento_uid).
 */
async function sincronizarReuniao(supabase: SupabaseClient, clienteId: string, evento: EventoIcs) {
  // Só reaproveita a reunião "gerenciada pelo sync" se ela ainda estiver 'agendada'. Sem esse
  // filtro, quando o consultor marcava a reunião como 'realizada' (com notas), a PRÓXIMA ocorrência
  // de um evento recorrente "roubava" essa mesma linha na próxima sincronização e sobrescrevia
  // status/data — a reunião concluída reaparecia como pendente. Ver índice único parcial em
  // supabase_migration_reunioes_sync_status_fix.sql, que só proíbe duplicar uma reunião AGENDADA.
  const { data: gerenciada, error: errBuscaReuniao } = await supabase
    .from("reunioes")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("status", "agendada")
    .not("calendario_evento_uid", "is", null)
    .maybeSingle();
  if (errBuscaReuniao) throw errBuscaReuniao;

  let reuniaoExistente: { id: string } | null = gerenciada;

  // Ainda não há reunião gerenciada pelo sync: em vez de criar uma nova (duplicando a agenda),
  // adota um agendamento manual — de preferência o do mesmo dia do evento, depois o próximo futuro
  // e, por último, o mais antigo.
  if (!reuniaoExistente) {
    const { data: manuais, error: errBuscaManual } = await supabase
      .from("reunioes")
      .select("id, data_reuniao")
      .eq("cliente_id", clienteId)
      .eq("status", "agendada")
      .is("calendario_evento_uid", null)
      .order("data_reuniao", { ascending: true });
    if (errBuscaManual) throw errBuscaManual;

    const lista = (manuais ?? []) as Array<{ id: string; data_reuniao: string }>;
    const agora = Date.now();
    reuniaoExistente =
      lista.find((m) => diaBrasilia(m.data_reuniao) === diaBrasilia(evento.dtstart)) ??
      lista.find((m) => new Date(m.data_reuniao).getTime() >= agora) ??
      lista[0] ??
      null;
  }

  const payloadReuniao = {
    data_reuniao: evento.dtstart.toISOString(),
    status: "agendada",
    calendario_evento_uid: evento.uid,
    link_reuniao: evento.linkReuniao,
  };

  if (reuniaoExistente) {
    const { error } = await supabase.from("reunioes").update(payloadReuniao).eq("id", reuniaoExistente.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("reunioes").insert([{
      cliente_id: clienteId,
      notas: "Sincronizado automaticamente do calendário externo.",
      ...payloadReuniao,
    }]);
    if (error) throw error;
  }
}

/** E-mail do próprio consultor: ele não conta como "outro convidado" na salvaguarda do casamento. */
async function emailsDoConsultor(supabase: SupabaseClient, consultorId: string): Promise<Set<string>> {
  const { data } = await supabase.auth.admin.getUserById(consultorId);
  const email = data?.user?.email?.trim().toLowerCase();
  return new Set(email ? [email] : []);
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
    // A function processa todos os consultores: a resposta traz só contagens, nunca títulos de
    // evento. O detalhe fica em ultimo_diagnostico, visível apenas ao dono da conexão (RLS).
    const resultadosPorConexao: Array<{ conexao_id: string; ok: boolean; casados?: number; erro?: string }> = [];

    for (const conexao of (conexoes ?? []) as CalendarioConexao[]) {
      try {
        const icsRes = await fetch(conexao.ics_url);
        if (!icsRes.ok) {
          throw new Error(`Falha ao baixar ICS (HTTP ${icsRes.status})`);
        }
        const icsTexto = await icsRes.text();
        // HTTP 200 com outra coisa (página de login, por exemplo) não pode zerar os vínculos.
        if (!icsTexto.includes("BEGIN:VCALENDAR")) {
          throw new Error("O link não devolveu um calendário ICS válido.");
        }
        const eventosFuturos = eventosAPartirDe(parsearEventosIcs(icsTexto), hoje);

        const { data: clientesConsultor, error: errClientes } = await supabase
          .from("clientes")
          .select("id, nome, email, telefone")
          .eq("consultor_id", conexao.consultor_id);

        if (errClientes) throw errClientes;
        const clientes = (clientesConsultor ?? []) as Cliente[];

        const emailsProprios = await emailsDoConsultor(supabase, conexao.consultor_id);

        const contagemPrimeiroNome = new Map<string, number>();
        for (const cliente of clientes) {
          const pn = primeiroNome(cliente.nome);
          contagemPrimeiroNome.set(pn, (contagemPrimeiroNome.get(pn) || 0) + 1);
        }

        const casados: Array<{ id: string; nome: string; evento: EventoIcs }> = [];
        const naoCasados: string[] = [];

        for (const cliente of clientes) {
          const eventoCasado = encontrarEventoCasado(cliente, eventosFuturos, contagemPrimeiroNome, emailsProprios);
          if (eventoCasado) {
            casados.push({ id: cliente.id, nome: cliente.nome, evento: eventoCasado });
          } else {
            naoCasados.push(cliente.id);
          }
        }

        // Reunião primeiro, flag depois: a flag só fica true se a reunião foi gravada. Erro em um
        // cliente é registrado e não impede os seguintes.
        const errosClientes: string[] = [];
        for (const c of casados) {
          try {
            if (c.evento.uid) await sincronizarReuniao(supabase, c.id, c.evento);
            const { error: errUpdate } = await supabase
              .from("clientes")
              .update({ em_agenda_externa: true, em_agenda_ate: c.evento.dtstart.toISOString().split("T")[0] })
              .eq("id", c.id);
            if (errUpdate) throw errUpdate;
          } catch (err) {
            const mensagem = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err);
            console.error(`Erro ao sincronizar cliente ${c.id}:`, mensagem);
            errosClientes.push(`${c.nome}: ${mensagem}`);
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

        // Diagnóstico: compromissos próximos que nenhum cliente reconhece.
        const limite = hoje.getTime() + JANELA_DIAGNOSTICO_DIAS * 24 * 60 * 60 * 1000;
        const semCliente: EventoSemCliente[] = eventosFuturos
          .filter((e) => e.dtstart.getTime() <= limite)
          .filter((e) => !clientes.some((c) => encontrarEventoCasado(c, [e], contagemPrimeiroNome, emailsProprios)))
          .sort((a, b) => a.dtstart.getTime() - b.dtstart.getTime())
          .slice(0, MAX_ITENS_DIAGNOSTICO)
          .map((e) => ({
            data: e.dtstart.toISOString(),
            titulo: e.summary || "(sem título)",
            motivo: motivoSemCliente(e, clientes, contagemPrimeiroNome, emailsProprios),
          }));

        await supabase
          .from("calendario_conexoes")
          .update({
            ultima_sync: new Date().toISOString(),
            ultimo_erro: errosClientes.length > 0
              ? `${errosClientes.length} cliente(s) não sincronizado(s). ${errosClientes.slice(0, 3).join(" | ")}`
              : null,
            ultimo_diagnostico: {
              eventos_futuros: eventosFuturos.length,
              clientes_casados: casados.length - errosClientes.length,
              sem_cliente: semCliente,
            },
          })
          .eq("id", conexao.id);

        if (errosClientes.length > 0) conexoesComErro++;
        else conexoesOk++;
        resultadosPorConexao.push({
          conexao_id: conexao.id,
          ok: errosClientes.length === 0,
          casados: casados.length - errosClientes.length,
          ...(errosClientes.length > 0 ? { erro: `${errosClientes.length} cliente(s) não sincronizado(s)` } : {}),
        });
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : (err as { message?: string })?.message ?? String(err);
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
