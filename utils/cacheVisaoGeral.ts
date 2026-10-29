// Cache da Visão Geral (stale-while-revalidate): a tela pinta na hora com o último resultado e
// revalida em segundo plano a cada acesso. Escritas que afetam a Visão Geral (contratos, clientes,
// parcelas, reuniões, dívidas, proteção) chamam `invalidarVisaoGeral()` — cache invalidado nunca é
// exibido, então um número sabidamente defasado não aparece nem por um instante. O cache é marcado
// com o usuário dono e descartado no logout/troca de conta (nunca mostra dados de outra conta).

const STORAGE_KEY = 'finplan_visao_geral_v1';

interface Entrada { dono: string; dados: unknown }

let emMemoria: Entrada | null = null;
const ouvintes = new Set<() => void>();
let versao = 0;

/** Muda a cada invalidação. Quem grava o cache confere que nenhuma escrita aconteceu durante a carga. */
export const versaoVisaoGeral = () => versao;

export const lerCacheVisaoGeral = <T>(dono: string | null | undefined): T | null => {
    if (!dono) return null;
    if (!emMemoria) {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (raw) emMemoria = JSON.parse(raw) as Entrada;
        } catch {
            // sessionStorage indisponível/corrompido — segue sem cache.
        }
    }
    return emMemoria && emMemoria.dono === dono ? (emMemoria.dados as T) : null;
};

export const gravarCacheVisaoGeral = (dados: unknown, dono: string | null | undefined) => {
    if (!dono) return;
    emMemoria = { dono, dados };
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(emMemoria));
    } catch {
        // Cota cheia ou storage bloqueado — o cache em memória já basta nesta aba.
    }
};

/** Descarta o cache da Visão Geral (memória + sessão) e avisa quem mantém caches derivados. */
export const invalidarVisaoGeral = () => {
    versao++;
    emMemoria = null;
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
    ouvintes.forEach(fn => fn());
};

export const aoInvalidarVisaoGeral = (fn: () => void) => {
    ouvintes.add(fn);
    return () => { ouvintes.delete(fn); };
};
