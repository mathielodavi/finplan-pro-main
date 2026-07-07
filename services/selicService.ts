// Taxa Selic (Meta definida pelo Copom, % a.a.) — API pública do Banco Central (SGS série 432),
// sem chave e sem custo. Cache local de 24h para evitar chamadas repetidas.

const BCB_SELIC_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json';
const CACHE_KEY = 'finplan_selic_meta_anual_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Usado apenas se a API do BCB e o cache local falharem simultaneamente (ex.: primeiro acesso offline). */
const FALLBACK_SELIC_ANUAL = 10.5;

interface SelicCache {
    valor: number;
    timestamp: number;
}

const lerCache = (): SelicCache | null => {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) as SelicCache : null;
    } catch {
        return null;
    }
};

const gravarCache = (valor: number) => {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ valor, timestamp: Date.now() }));
    } catch {
        // localStorage indisponível (modo privado etc.) — segue sem cache.
    }
};

export const selicService = {
    /** Taxa Selic (Meta Copom, % a.a.) — busca da API do BCB, com cache de 24h e fallback local. */
    getSelicAnual: async (): Promise<number> => {
        const cache = lerCache();
        if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
            return cache.valor;
        }

        try {
            const resp = await fetch(BCB_SELIC_URL);
            if (!resp.ok) throw new Error(`BCB respondeu ${resp.status}`);
            const data = await resp.json();
            const valor = Number(data?.[0]?.valor);
            if (!isFinite(valor) || valor <= 0) throw new Error('Valor de Selic inválido');
            gravarCache(valor);
            return valor;
        } catch (err) {
            console.error('Erro ao buscar Selic na API do BCB:', err);
            return cache?.valor ?? FALLBACK_SELIC_ANUAL;
        }
    },
};
