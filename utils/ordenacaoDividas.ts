import { DividaCredito, DividaConsorcio, PrioritizationMethod } from '../types/dividas';

/**
 * METHOD 1 — AVALANCHE (default for cost optimization):
 * Primary sort   : cet_monthly DESC (highest rate first)
 * Secondary sort : outstanding_balance DESC (tiebreaker)
 */
export const ordenarAvalanche = (dividas: DividaCredito[]): DividaCredito[] => {
    return [...dividas].sort((a, b) => {
        if (b.cet_monthly !== a.cet_monthly) {
            return b.cet_monthly - a.cet_monthly; // Highest rate first
        }
        return b.outstanding_balance - a.outstanding_balance; // Highest balance first
    });
};

/**
 * METHOD 2 — SNOWBALL (for behavioral motivation):
 * Primary sort   : outstanding_balance ASC (smallest balance first)
 * Secondary sort : remaining_installments ASC (tiebreaker)
 */
export const ordenarSnowball = (dividas: DividaCredito[]): DividaCredito[] => {
    return [...dividas].sort((a, b) => {
        if (a.outstanding_balance !== b.outstanding_balance) {
            return a.outstanding_balance - b.outstanding_balance; // Smallest balance first
        }
        return a.remaining_installments - b.remaining_installments; // Fewest installments first
    });
};

/**
 * Consórcios são ordenados separadamente conforme a regra 2.2:
 * "Consortiums are ranked separately from credit debts and must always appear in their own section".
 * Vamos ordená-los por Custo Real Mensal ou Embutido (Avalanche) ou Menor Saldo Restante (Snowball)
 */
import { calcularCustoEmbutidoTotal } from './calculosDividas';

export const ordenarConsorcios = (consorcios: DividaConsorcio[], method: PrioritizationMethod): DividaConsorcio[] => {
    return [...consorcios].sort((a, b) => {
        if (method === 'avalanche') {
            // Maior custo embutido primeiro
            const custoA = calcularCustoEmbutidoTotal(a);
            const custoB = calcularCustoEmbutidoTotal(b);
            return custoB - custoA;
        } else {
            // Menor prazo restante primeiro
            return a.remaining_installments - b.remaining_installments;
        }
    });
};
