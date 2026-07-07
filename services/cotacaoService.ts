import { supabase } from './supabaseClient';

// Cotação de ativos negociados na B3 (ações, FIIs, ETFs) — via edge function `cotacao-ativos`,
// que faz o proxy para a API da brapi.dev usando um token guardado no Supabase Vault (nunca
// exposto no bundle do navegador). Cache local de 20min por ticker para reduzir chamadas.

const CACHE_KEY_PREFIX = 'finplan_cotacao_';
const CACHE_TTL_MS = 20 * 60 * 1000;

interface CotacaoCache {
    valor: number;
    timestamp: number;
}

const lerCache = (ticker: string): CotacaoCache | null => {
    try {
        const raw = localStorage.getItem(CACHE_KEY_PREFIX + ticker);
        return raw ? JSON.parse(raw) as CotacaoCache : null;
    } catch {
        return null;
    }
};

const gravarCache = (ticker: string, valor: number) => {
    try {
        localStorage.setItem(CACHE_KEY_PREFIX + ticker, JSON.stringify({ valor, timestamp: Date.now() }));
    } catch {
        // localStorage indisponível — segue sem cache.
    }
};

export const cotacaoService = {
    /**
     * Busca a cotação atual (delayed) de uma lista de tickers B3, via edge function.
     * Retorna um mapa { TICKER: preco }; tickers não encontrados ou com erro ficam de fora
     * do mapa — o chamador decide o fallback (normalmente deixa o campo para preenchimento
     * manual, nunca bloqueia o fluxo).
     */
    getCotacoes: async (tickers: string[]): Promise<Record<string, number>> => {
        const resultado: Record<string, number> = {};
        const pendentes: string[] = [];

        tickers.forEach(t => {
            const cache = lerCache(t);
            if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
                resultado[t] = cache.valor;
            } else {
                pendentes.push(t);
            }
        });

        if (pendentes.length === 0) return resultado;

        try {
            const { data, error } = await supabase.functions.invoke('cotacao-ativos', { body: { tickers: pendentes } });
            if (error) throw error;
            Object.entries(data?.cotacoes || {}).forEach(([ticker, preco]) => {
                const valor = Number(preco);
                if (isFinite(valor) && valor > 0) {
                    resultado[ticker] = valor;
                    gravarCache(ticker, valor);
                }
            });
        } catch (err) {
            console.error('Erro ao buscar cotações (edge function cotacao-ativos):', err);
        }

        return resultado;
    },
};
