// Cotação de moedas estrangeiras (dólar, euro etc.) — API pública AwesomeAPI (economia.awesomeapi.com.br),
// sem chave e sem custo. Mesmo padrão do selicService.ts: cache local com TTL e fallback hardcoded
// caso a API e o cache falhem simultaneamente. Usado na Carteira Ativa para converter o saldo de
// ativos cadastrados em moeda estrangeira para reais automaticamente.

export type MoedaCodigo = 'USD' | 'EUR' | 'GBP' | 'ARS';

export interface MoedaOption {
  codigo: MoedaCodigo;
  nome: string;
  simbolo: string;
}

export const MOEDAS_SUPORTADAS: MoedaOption[] = [
  { codigo: 'USD', nome: 'Dólar americano', simbolo: 'US$' },
  { codigo: 'EUR', nome: 'Euro', simbolo: '€' },
  { codigo: 'GBP', nome: 'Libra esterlina', simbolo: '£' },
  { codigo: 'ARS', nome: 'Peso argentino', simbolo: 'AR$' },
];

const AWESOME_API_URL = (moeda: MoedaCodigo) => `https://economia.awesomeapi.com.br/json/last/${moeda}-BRL`;
const CACHE_KEY_PREFIX = 'finplan_cambio_';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — câmbio muda mais rápido que a Selic, mas não precisa ser em tempo real

/** Usado apenas se a API e o cache local falharem simultaneamente (ex.: primeiro acesso offline). */
const FALLBACK_COTACOES: Record<MoedaCodigo, number> = {
  USD: 5.30,
  EUR: 5.70,
  GBP: 6.70,
  ARS: 0.0055,
};

interface CambioCache {
  valor: number;
  timestamp: number;
}

const lerCache = (moeda: MoedaCodigo): CambioCache | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + moeda);
    return raw ? JSON.parse(raw) as CambioCache : null;
  } catch {
    return null;
  }
};

const gravarCache = (moeda: MoedaCodigo, valor: number) => {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + moeda, JSON.stringify({ valor, timestamp: Date.now() }));
  } catch {
    // localStorage indisponível (modo privado etc.) — segue sem cache.
  }
};

export const cambioService = {
  /** Cotação de venda (BRL por 1 unidade da moeda), com cache de 30min e fallback local. */
  getCotacao: async (moeda: MoedaCodigo): Promise<number> => {
    const cache = lerCache(moeda);
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return cache.valor;
    }

    try {
      const resp = await fetch(AWESOME_API_URL(moeda));
      if (!resp.ok) throw new Error(`AwesomeAPI respondeu ${resp.status}`);
      const data = await resp.json();
      const chave = `${moeda}BRL`;
      const valor = Number(data?.[chave]?.bid);
      if (!isFinite(valor) || valor <= 0) throw new Error('Cotação inválida');
      gravarCache(moeda, valor);
      return valor;
    } catch (err) {
      console.error(`Erro ao buscar cotação de ${moeda} na AwesomeAPI:`, err);
      return cache?.valor ?? FALLBACK_COTACOES[moeda];
    }
  },
};
