// Contrato herdado: regra única de corte dos recebimentos, usada pelo gerador de parcelas
// (services/contratoService.ts) e pelo preview do drawer (ContratoFormDrawer).

const dataLocal = (iso: string): Date => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
};

/** Competência da parcela de índice `i` (0 = primeira): data-base + i meses, antes do prazo de recebimento. */
export const competenciaParcela = (dataBase: string, i: number): Date => {
    const competencia = dataLocal(dataBase);
    competencia.setMonth(competencia.getMonth() + i);
    return competencia;
};

/**
 * A parcela pertence ao planejador atual? Sem herança, sempre. Com herança, só se a competência é
 * igual ou posterior à data de herança — o que equivale a receber a partir do primeiro vencimento
 * que uma venda feita na data de herança teria; as anteriores ficaram com o dono anterior.
 */
export const parcelaDoHerdeiro = (dataBase: string, i: number, dataHeranca?: string | null): boolean => {
    if (!dataHeranca) return true;
    return competenciaParcela(dataBase, i).getTime() >= dataLocal(dataHeranca).getTime();
};

/** Data de entrada efetiva do contrato na base (herança, se houver; senão a data-base). */
export const inicioEfetivoContrato = (c: { data_inicio: string; data_heranca?: string | null }): string =>
    c.data_heranca || c.data_inicio;
