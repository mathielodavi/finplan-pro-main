// supabase/functions/check-alerts/index.ts
// Edge Function: Alertas Diários do Tulipa CRM
// Disparo via cron diário às 08:00 BRT (11:00 UTC)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// ─── Tipos auxiliares ────────────────────────────────────────────────────────

interface ReuniaoAtrasada {
  id: string;
  data_reuniao: string;
  status: string;
  cliente_id: string;
  clientes: { nome: string } | null;
}

interface RenovacaoProxima {
  id: string;
  descricao: string;
  data_fim: string;
  status: string;
  tipo: string;
  consultor_id: string;
  cliente_id: string;
  clientes: { nome: string } | null;
}

// ─── Constantes de estilo (inline CSS) ───────────────────────────────────────

const PRIMARY_COLOR = "#4f46e5"; // indigo-600
const PRIMARY_DARK = "#3730a3"; // indigo-800
const BG_COLOR = "#f5f3ff"; // indigo-50
const TEXT_COLOR = "#1e1b4b"; // indigo-950
const TEXT_MUTED = "#6b7280"; // gray-500
const BORDER_COLOR = "#e0e7ff"; // indigo-100
const WARNING_BG = "#fef3c7"; // amber-100
const WARNING_TEXT = "#92400e"; // amber-800
const DANGER_BG = "#fee2e2"; // red-100
const DANGER_TEXT = "#991b1b"; // red-800

// ─── Funções auxiliares ──────────────────────────────────────────────────────

/**
 * Calcula a diferença em dias entre duas datas (ignora horas).
 */
function diasAte(dataFutura: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(dataFutura);
  alvo.setHours(0, 0, 0, 0);
  return Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Formata data ISO para dd/mm/aaaa no fuso de São Paulo.
 */
function formatarData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Gera o timestamp legível para o rodapé do e-mail.
 */
function timestampRodape(): string {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "long",
    timeStyle: "short",
  });
}

// ─── Template HTML do e-mail ─────────────────────────────────────────────────

function gerarHtmlEmail(
  reunioesAtrasadas: ReuniaoAtrasada[],
  renovacoesProximas: RenovacaoProxima[]
): string {
  // Seção: Agendamentos em Atraso
  const secaoReunioesRows = reunioesAtrasadas
    .map((r) => {
      const nomeCliente = r.clientes?.nome ?? "Cliente não identificado";
      const dataFormatada = formatarData(r.data_reuniao);
      const diasAtraso = Math.abs(diasAte(r.data_reuniao));
      return `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid ${BORDER_COLOR}; font-size: 14px; color: ${TEXT_COLOR};">
            ${nomeCliente}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid ${BORDER_COLOR}; font-size: 14px; color: ${TEXT_COLOR};">
            ${dataFormatada}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid ${BORDER_COLOR}; text-align: center;">
            <span style="background: ${DANGER_BG}; color: ${DANGER_TEXT}; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">
              ${diasAtraso} dia${diasAtraso !== 1 ? "s" : ""}
            </span>
          </td>
        </tr>`;
    })
    .join("");

  const secaoReunioes =
    reunioesAtrasadas.length > 0
      ? `
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 18px; color: ${PRIMARY_DARK}; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid ${PRIMARY_COLOR};">
          🔴 Agendamentos em Atraso
        </h2>
        <table style="width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <thead>
            <tr style="background: ${BG_COLOR};">
              <th style="padding: 10px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: ${TEXT_MUTED}; font-weight: 600;">Cliente</th>
              <th style="padding: 10px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: ${TEXT_MUTED}; font-weight: 600;">Data Agendada</th>
              <th style="padding: 10px 16px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: ${TEXT_MUTED}; font-weight: 600;">Atraso</th>
            </tr>
          </thead>
          <tbody>
            ${secaoReunioesRows}
          </tbody>
        </table>
      </div>`
      : "";

  // Seção: Renovações Próximas
  const secaoRenovacoesRows = renovacoesProximas
    .map((c) => {
      const nomeCliente = c.clientes?.nome ?? "Cliente não identificado";
      const dataFormatada = formatarData(c.data_fim);
      const dias = diasAte(c.data_fim);
      const badgeBg = dias <= 7 ? DANGER_BG : WARNING_BG;
      const badgeColor = dias <= 7 ? DANGER_TEXT : WARNING_TEXT;
      return `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid ${BORDER_COLOR}; font-size: 14px; color: ${TEXT_COLOR};">
            ${nomeCliente}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid ${BORDER_COLOR}; font-size: 14px; color: ${TEXT_COLOR};">
            ${c.descricao || "Planejamento financeiro"}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid ${BORDER_COLOR}; font-size: 14px; color: ${TEXT_COLOR};">
            ${dataFormatada}
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid ${BORDER_COLOR}; text-align: center;">
            <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">
              ${dias} dia${dias !== 1 ? "s" : ""}
            </span>
          </td>
        </tr>`;
    })
    .join("");

  const secaoRenovacoes =
    renovacoesProximas.length > 0
      ? `
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 18px; color: ${PRIMARY_DARK}; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid ${PRIMARY_COLOR};">
          🟡 Renovações Próximas (≤30 dias)
        </h2>
        <table style="width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <thead>
            <tr style="background: ${BG_COLOR};">
              <th style="padding: 10px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: ${TEXT_MUTED}; font-weight: 600;">Cliente</th>
              <th style="padding: 10px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: ${TEXT_MUTED}; font-weight: 600;">Contrato</th>
              <th style="padding: 10px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: ${TEXT_MUTED}; font-weight: 600;">Vencimento</th>
              <th style="padding: 10px 16px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: ${TEXT_MUTED}; font-weight: 600;">Restam</th>
            </tr>
          </thead>
          <tbody>
            ${secaoRenovacoesRows}
          </tbody>
        </table>
      </div>`
      : "";

  // Resumo no topo
  const totalAlertas = reunioesAtrasadas.length + renovacoesProximas.length;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tulipa CRM - Alertas Diários</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; padding: 24px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${PRIMARY_COLOR}, ${PRIMARY_DARK}); border-radius: 12px 12px 0 0; padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">
        🌷 Tulipa CRM
      </h1>
      <p style="margin: 8px 0 0 0; color: #c7d2fe; font-size: 14px; font-weight: 400;">
        Alertas Diários
      </p>
    </div>

    <!-- Corpo do e-mail -->
    <div style="background: #ffffff; padding: 32px 24px; border-left: 1px solid ${BORDER_COLOR}; border-right: 1px solid ${BORDER_COLOR};">

      <!-- Resumo -->
      <div style="background: ${BG_COLOR}; border-radius: 8px; padding: 16px 20px; margin-bottom: 28px; border: 1px solid ${BORDER_COLOR};">
        <p style="margin: 0; font-size: 14px; color: ${TEXT_COLOR};">
          📊 Você tem <strong style="color: ${PRIMARY_COLOR};">${totalAlertas}</strong> alerta${totalAlertas !== 1 ? "s" : ""} pendente${totalAlertas !== 1 ? "s" : ""} hoje:
          ${reunioesAtrasadas.length > 0 ? `<strong>${reunioesAtrasadas.length}</strong> reunião(ões) atrasada(s)` : ""}
          ${reunioesAtrasadas.length > 0 && renovacoesProximas.length > 0 ? " e " : ""}
          ${renovacoesProximas.length > 0 ? `<strong>${renovacoesProximas.length}</strong> renovação(ões) próxima(s)` : ""}
        </p>
      </div>

      ${secaoReunioes}
      ${secaoRenovacoes}
    </div>

    <!-- Footer -->
    <div style="background: ${BG_COLOR}; border-radius: 0 0 12px 12px; padding: 20px 24px; text-align: center; border: 1px solid ${BORDER_COLOR}; border-top: none;">
      <p style="margin: 0; font-size: 12px; color: ${TEXT_MUTED};">
        Enviado automaticamente por Tulipa CRM &bull; FinPlan Pro
      </p>
      <p style="margin: 4px 0 0 0; font-size: 11px; color: ${TEXT_MUTED};">
        ${timestampRodape()}
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Handler principal da Edge Function ──────────────────────────────────────

serve(async (req: Request) => {
  try {
    // Variáveis de ambiente obrigatórias
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const alertRecipientEmail = Deno.env.get("ALERT_RECIPIENT_EMAIL");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Variáveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.");
      return new Response(
        JSON.stringify({ error: "Configuração do Supabase ausente." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!resendApiKey) {
      console.error("RESEND_API_KEY não configurada.");
      return new Response(
        JSON.stringify({ error: "Configuração da API Resend ausente." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!alertRecipientEmail) {
      console.error("ALERT_RECIPIENT_EMAIL não configurada.");
      return new Response(
        JSON.stringify({ error: "E-mail destinatário não configurado." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Cliente Supabase com service role (ignora RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ── 1. Reuniões atrasadas ────────────────────────────────────────────────
    // Busca reuniões com status "agendada" cuja data já passou
    const { data: reunioesAtrasadas, error: errReunioes } = await supabase
      .from("reunioes")
      .select("id, data_reuniao, status, cliente_id, clientes(nome)")
      .eq("status", "agendada")
      .lt("data_reuniao", new Date().toISOString())
      .order("data_reuniao", { ascending: true });

    if (errReunioes) {
      console.error("Erro ao buscar reuniões atrasadas:", errReunioes);
      return new Response(
        JSON.stringify({ error: "Falha ao consultar reuniões.", details: errReunioes.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 2. Renovações próximas (≤30 dias) ────────────────────────────────────
    // Contratos de planejamento ativos com data_fim nos próximos 30 dias
    const hoje = new Date();
    const limite30dias = new Date();
    limite30dias.setDate(hoje.getDate() + 30);

    const hojeISO = hoje.toISOString().split("T")[0]; // yyyy-mm-dd
    const limiteISO = limite30dias.toISOString().split("T")[0];

    const { data: renovacoesProximas, error: errRenovacoes } = await supabase
      .from("contratos")
      .select("id, descricao, data_fim, status, tipo, consultor_id, cliente_id, clientes(nome)")
      .eq("status", "ativo")
      .eq("tipo", "planejamento")
      .gte("data_fim", hojeISO)
      .lte("data_fim", limiteISO)
      .order("data_fim", { ascending: true });

    if (errRenovacoes) {
      console.error("Erro ao buscar renovações:", errRenovacoes);
      return new Response(
        JSON.stringify({ error: "Falha ao consultar contratos.", details: errRenovacoes.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 3. Verificar se há alertas ───────────────────────────────────────────
    const totalReunioes = reunioesAtrasadas?.length ?? 0;
    const totalRenovacoes = renovacoesProximas?.length ?? 0;

    if (totalReunioes === 0 && totalRenovacoes === 0) {
      console.log("Nenhum alerta encontrado hoje. E-mail não será enviado.");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhum alerta para hoje.",
          reunioes_atrasadas: 0,
          renovacoes_proximas: 0,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 4. Gerar e enviar e-mail via Resend ──────────────────────────────────
    const htmlEmail = gerarHtmlEmail(
      (reunioesAtrasadas ?? []) as ReuniaoAtrasada[],
      (renovacoesProximas ?? []) as RenovacaoProxima[]
    );

    const assunto = `🌷 Tulipa CRM — ${totalReunioes + totalRenovacoes} alerta(s) para hoje`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Tulipa CRM <alertas@tulipa.app>",
        to: [alertRecipientEmail],
        subject: assunto,
        html: htmlEmail,
      }),
    });

    if (!resendRes.ok) {
      const resendError = await resendRes.text();
      console.error("Erro ao enviar e-mail via Resend:", resendRes.status, resendError);
      return new Response(
        JSON.stringify({
          error: "Falha ao enviar e-mail.",
          status: resendRes.status,
          details: resendError,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const resendData = await resendRes.json();
    console.log("E-mail de alertas enviado com sucesso:", resendData);

    return new Response(
      JSON.stringify({
        success: true,
        message: "E-mail de alertas enviado com sucesso.",
        email_id: resendData.id,
        reunioes_atrasadas: totalReunioes,
        renovacoes_proximas: totalRenovacoes,
        destinatario: alertRecipientEmail,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro inesperado na Edge Function check-alerts:", err);
    return new Response(
      JSON.stringify({
        error: "Erro interno na Edge Function.",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
