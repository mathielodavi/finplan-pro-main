import { DividaCredito, DividaConsorcio } from '../types/dividas';
import { calcularProbabilidadeContemplacao } from '../utils/calculosDividas';

export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface Alert {
    id: string; // ex: 'CL-01'
    recordId: string; // debt_id ou consortium_id
    severity: AlertSeverity;
    message: string;
}

export const alertasDividaService = {
    gerarAlertasCredito: (credito: DividaCredito): Alert[] => {
        const alertas: Alert[] = [];

        // ALERT CL-01: Taxa mensal acima de 10%
        if (credito.cet_monthly > 10) {
            alertas.push({
                id: 'CL-01',
                recordId: credito.debt_id as string,
                severity: 'CRITICAL',
                message: 'Taxa mensal acima de 10%. Avaliar portabilidade ou quitação antecipada com urgência.'
            });
        }

        // ALERT CL-02: Comprometimento de renda acima de 30%
        if (credito.income_commitment > 30) {
            alertas.push({
                id: 'CL-02',
                recordId: credito.debt_id as string,
                severity: 'WARNING',
                message: 'Comprometimento de renda acima de 30%. Risco de desequilíbrio orçamentário.'
            });
        }

        // ALERT CL-03: Dívida próxima do encerramento (<= 3 parcelas)
        if (credito.remaining_installments > 0 && credito.remaining_installments <= 3) {
            alertas.push({
                id: 'CL-03',
                recordId: credito.debt_id as string,
                severity: 'INFO',
                message: 'Dívida próxima do encerramento. Considerar realocação do valor liberado.'
            });
        }

        // ALERT CL-04: payoff_balance < outstanding_balance × 0.70
        if (credito.payoff_balance > 0 && credito.payoff_balance < (credito.outstanding_balance * 0.70)) {
            alertas.push({
                id: 'CL-04',
                recordId: credito.debt_id as string,
                severity: 'WARNING',
                message: 'Desconto significativo para quitação antecipada disponível. Avaliar oportunidade.'
            });
        }

        return alertas;
    },

    gerarAlertasConsorcio: (consorcio: DividaConsorcio): Alert[] => {
        const alertas: Alert[] = [];

        // ALERT CO-01: Taxa de administração acima de 18%
        if (consorcio.admin_fee_total > 18) {
            alertas.push({
                id: 'CO-01',
                recordId: consorcio.consortium_id as string,
                severity: 'CRITICAL',
                message: 'Taxa de administração acima de 18%. Custo embutido elevado. Avaliar viabilidade de continuidade.'
            });
        }

        // ALERT CO-02: Correção monetária acumulada YoY delta > 15% 
        // Assumindo monetary_correction_accumulated como proxy pra verificar
        if (consorcio.monetary_correction_accumulated > 15 && consorcio.monetary_index !== 'none' && consorcio.monetary_index !== 'fixed') {
            alertas.push({
                id: 'CO-02',
                recordId: consorcio.consortium_id as string,
                severity: 'CRITICAL',
                message: 'Correção monetária acumulada com variação anual acima de 15%. Impacto significativo no valor real das parcelas.'
            });
        }

        // ALERT CO-03: probability = LOW AND progresso > 0.70 AND no strategy
        const progressoTermo = consorcio.total_installments > 0 ? consorcio.remaining_installments / consorcio.total_installments : 0;
        const probab = calcularProbabilidadeContemplacao(consorcio);
        if (probab === 'LOW' && progressoTermo > 0.70 && consorcio.bid_strategy === 'none') {
            alertas.push({
                id: 'CO-03',
                recordId: consorcio.consortium_id as string,
                severity: 'WARNING',
                message: 'Baixa probabilidade de contemplação e sem estratégia de lance definida. Revisar planejamento do consórcio.'
            });
        }

        // ALERT CO-04: fgts_eligible = true AND contemplation_status = not_contemplated
        if (consorcio.fgts_eligible && consorcio.contemplation_status === 'not_contemplated') {
            alertas.push({
                id: 'CO-04',
                recordId: consorcio.consortium_id as string,
                severity: 'INFO',
                message: 'FGTS elegível para lance. Avaliar estratégia de contemplação por lance com recursos do FGTS.'
            });
        }

        // ALERT CO-05: status == contemplated
        if (consorcio.contemplation_status === 'contemplated_by_draw' || consorcio.contemplation_status === 'contemplated_by_bid') {
            // Regra B7 e CO-05: alerta info se ainda não foi released
            if (!consorcio.asset_released) {
                alertas.push({
                    id: 'CO-05',
                    recordId: consorcio.consortium_id as string,
                    severity: 'INFO',
                    message: 'Consórcio contemplado. Verificar liberação da carta de crédito e prazo para uso do recurso.'
                });
            }
        }

        return alertas;
    }
};
