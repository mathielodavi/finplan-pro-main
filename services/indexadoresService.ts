// Acumulado dos últimos 12 meses dos indexadores de correção (IPCA, IGP-M, INCC, SELIC) — API
// pública do Banco Central (SGS), sem chave e sem custo. Mesmo padrão do selicService: cache local
// de 24h e, em falha, devolve o cache vencido (ou null — o chamador decide o fallback).

import type { MonetaryIndex } from '../types/dividas';

export type IndiceMercado = Exclude<MonetaryIndex, 'fixed' | 'none'>;

/** Séries SGS de variação MENSAL (%): IPCA, IGP-M, INCC-M e Selic acumulada no mês. */
const SERIES_SGS: Record<IndiceMercado, number> = {
    IPCA: 433,
    'IGP-M': 189,
    INCC: 192,
    SELIC: 4390,
};

const CACHE_PREFIX = 'finplan_indexador_12m_v1_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface Cache { valor: number; timestamp: number }

const lerCache = (indice: IndiceMercado): Cache | null => {
    try {
        const raw = localStorage.getItem(CACHE_PREFIX + indice);
        return raw ? JSON.parse(raw) as Cache : null;
    } catch {
        return null;
    }
};

const gravarCache = (indice: IndiceMercado, valor: number) => {
    try {
        localStorage.setItem(CACHE_PREFIX + indice, JSON.stringify({ valor, timestamp: Date.now() }));
    } catch {
        // localStorage indisponível — segue sem cache.
    }
};

/** "dd/mm/aaaa" do BCB → chave ordenável aaaa-mm. */
const mesDoRegistro = (data: string): string => {
    const [, mm, aaaa] = data.split('/');
    return `${aaaa}-${mm}`;
};

/**
 * Compõe os 12 últimos meses FECHADOS de uma série de variação mensal (%) em um acumulado (%).
 * Descarta o mês corrente (a série da Selic, por exemplo, já traz o mês em andamento, parcial).
 * Retorna null se não houver 12 meses de dados válidos.
 */
export const acumular12Meses = (registros: { data: string; valor: string }[], hoje: Date = new Date()): number | null => {
    const mesCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const mensais = registros
        .map(r => ({ mes: mesDoRegistro(r.data), v: Number(r.valor) }))
        .filter(r => isFinite(r.v) && r.mes < mesCorrente)
        .sort((a, b) => a.mes.localeCompare(b.mes))
        .slice(-12);
    if (mensais.length < 12) return null;
    return (mensais.reduce((acc, r) => acc * (1 + r.v / 100), 1) - 1) * 100;
};

export const indexadoresService = {
    /** Acumulado de 12 meses (% a.a.) do índice, ou null se o BCB e o cache falharem. */
    getAcumulado12m: async (indice: IndiceMercado): Promise<number | null> => {
        const cache = lerCache(indice);
        if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) return cache.valor;

        try {
            const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SERIES_SGS[indice]}/dados/ultimos/14?formato=json`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`BCB respondeu ${resp.status}`);
            const valor = acumular12Meses(await resp.json());
            if (valor === null) throw new Error(`Série ${indice} sem 12 meses fechados`);
            gravarCache(indice, valor);
            return valor;
        } catch (err) {
            console.error(`Erro ao buscar acumulado 12m de ${indice} no BCB:`, err);
            return cache?.valor ?? null;
        }
    },

    /** Busca vários índices em paralelo; índice sem dado fica ausente do mapa. */
    getTaxasMercado: async (indices: IndiceMercado[]): Promise<Partial<Record<IndiceMercado, number>>> => {
        const unicos = Array.from(new Set(indices));
        const resultados = await Promise.all(unicos.map(async i => [i, await indexadoresService.getAcumulado12m(i)] as const));
        const mapa: Partial<Record<IndiceMercado, number>> = {};
        resultados.forEach(([i, v]) => { if (v !== null) mapa[i] = v; });
        return mapa;
    },
};
