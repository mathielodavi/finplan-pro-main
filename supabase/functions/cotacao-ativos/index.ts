// supabase/functions/cotacao-ativos/index.ts
// Edge Function: proxy de cotacoes de ativos B3 (acoes, FIIs, ETFs) via brapi.dev (API v2).
// O token da brapi.dev fica no Supabase Vault (secret "brapi_api_token"), lido aqui
// via a funcao SQL restrita public.get_brapi_token() (grant apenas para service_role) -
// nunca fica exposto no bundle do navegador nem em requisicoes visiveis ao cliente.
// O plano gratuito da brapi.dev permite 1 ativo por requisicao, entao consultamos
// ticker por ticker (sequencial, server-side - sem problema de CORS aqui). Um pequeno
// intervalo entre as chamadas evita estourar o rate-limit por minuto da brapi.dev em
// lotes grandes (simulacoes com muitos ativos "Comprar" ao mesmo tempo).
// Chamado por services/cotacaoService.ts (RebalanceamentoInvestimentos.tsx) para
// pre-preencher o preco de mercado no simulador de aporte.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function buscarUmaCotacao(ticker: string, token: string): Promise<number | null> {
  const url = `https://brapi.dev/api/v2/stocks/quote?symbols=${encodeURIComponent(ticker)}`;
  const resp = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    console.error(`brapi.dev (${ticker}) respondeu ${resp.status}:`, corpo);
    return null;
  }
  const dados = await resp.json();
  const r = dados?.results?.[0];
  const preco = Number(r?.data?.regularMarketPrice ?? r?.regularMarketPrice);
  return (r?.symbol && isFinite(preco) && preco > 0) ? preco : null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Variaveis SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configuradas.");
      return new Response(
        JSON.stringify({ error: "Configuracao do Supabase ausente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tickers } = await req.json().catch(() => ({ tickers: [] }));
    const listaTickers: string[] = Array.isArray(tickers) ? Array.from(new Set(tickers.filter((t) => typeof t === "string" && t.trim()))) : [];

    if (listaTickers.length === 0) {
      return new Response(
        JSON.stringify({ cotacoes: {} }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: token, error: errToken } = await supabase.rpc("get_brapi_token");
    if (errToken || !token) {
      console.error("Erro ao ler token da brapi.dev no Vault:", errToken);
      return new Response(
        JSON.stringify({ error: "Token de cotacao nao configurado." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cotacoes: Record<string, number> = {};
    // Sequencial (nao paralelo) para respeitar limite de requisicoes por minuto do plano gratuito,
    // com um pequeno intervalo entre chamadas para reduzir ainda mais o risco de rate-limit em
    // lotes grandes (o cliente ja faz retry para os tickers que ainda assim falharem).
    for (let i = 0; i < listaTickers.length; i++) {
      const ticker = listaTickers[i];
      try {
        const preco = await buscarUmaCotacao(ticker, token as string);
        if (preco !== null) cotacoes[ticker] = preco;
      } catch (err) {
        console.error(`Erro ao buscar cotacao de ${ticker}:`, err);
      }
      if (i < listaTickers.length - 1) await esperar(120);
    }

    return new Response(
      JSON.stringify({ cotacoes }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro inesperado na Edge Function cotacao-ativos:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno na Edge Function.", details: err instanceof Error ? err.message : String(err), cotacoes: {} }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
