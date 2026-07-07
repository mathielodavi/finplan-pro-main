import { DividaCredito, DividaConsorcio, ContemplationStatus, DebtType } from '../types/dividas';

// ==========================================
// 1. HELPERS GENÉRICOS
// ==========================================

export const calcularComprometimentoRenda = (valorParcela: number, rendaCliente: number): number => {
    if (!rendaCliente || rendaCliente <= 0) return 0;
    return (valorParcela / rendaCliente) * 100;
};

/** Label humano do enum de tipo de dívida — evita exibir o valor raw ("personal_loan") em telas que não passam por ele. */
export const formatarDebtType = (tipo: DebtType): string => {
    switch (tipo) {
        case 'personal_loan': return 'Crédito Pessoal';
        case 'financing': return 'Financiamento';
        case 'credit_card': return 'Cartão de Crédito / Parcelamento';
        case 'overdraft': return 'Cheque Especial';
        case 'other': return 'Outro';
        default: return tipo;
    }
};

// ==========================================
// 2. CÁLCULOS DE CRÉDITOS E EMPRÉSTIMOS
// ==========================================

// RULE A1: cet_annual must always be derived from cet_monthly
export const derivarCetAnual = (cetMensal: number): number => {
    // Formula: cet_annual = ((1 + cet_monthly)^12 - 1) * 100
    // Assumindo que cetMensal já entra como "1.5" (significando 1.5%)
    const rate = cetMensal / 100;
    return (Math.pow(1 + rate, 12) - 1) * 100;
};

// RULE A5: total_paid = (total_installments - remaining_installments) * installment_value
export const calcularTotalPagoCredito = (credito: DividaCredito): number => {
    const pagas = credito.total_installments - credito.remaining_installments;
    return Math.max(0, pagas) * credito.installment_value;
};

/** Spread do CET anual da dívida sobre a Selic vigente, em pontos percentuais (pode ser negativo). */
export const calcularSpreadSobreSelic = (credito: DividaCredito, selicAnual: number): number => {
    return (credito.cet_annual || 0) - selicAnual;
};

/**
 * Risk Score Calculator (Credit) — versão unificada (soma 100% dos pesos).
 * Inclui o spread do CET anual sobre a Selic vigente: dívidas com custo próximo ou abaixo
 * da Selic (ex.: alguns financiamentos) reduzem o risco calculado; dívidas muito acima
 * (ex.: cartão rotativo, cheque especial) aumentam — a Selic vem de `services/selicService.ts`
 * (API pública do BCB, sem custo) e é passada como parâmetro para manter esta função pura.
 */
export const calcularRiskScoreCredito = (credito: DividaCredito, selicAnual: number): number => {
    // cet_monthly_normalized : 0–100 (0% = 0, >= 15% = 100)
    let cetNorm = (credito.cet_monthly / 15) * 100;
    if (cetNorm > 100) cetNorm = 100;
    if (cetNorm < 0) cetNorm = 0;

    // income_commitment_normalized : 0–100 (0% = 0, >= 35% = 100)
    let incNorm = (credito.income_commitment / 35) * 100;
    if (incNorm > 100) incNorm = 100;
    if (incNorm < 0) incNorm = 0;

    // remaining_term_normalized : 0–100 (0m = 0, >= 60m = 100)
    let termNorm = (credito.remaining_installments / 60) * 100;
    if (termNorm > 100) termNorm = 100;
    if (termNorm < 0) termNorm = 0;

    // selic_spread_normalized : 0–100 (spread <= 0pp = 0, >= 60pp = 100)
    const spread = calcularSpreadSobreSelic(credito, selicAnual);
    let selicNorm = (spread / 60) * 100;
    if (selicNorm > 100) selicNorm = 100;
    if (selicNorm < 0) selicNorm = 0;

    // risk_score = (cetNorm × 0.30) + (incNorm × 0.30) + (termNorm × 0.20) + (selicNorm × 0.20) — soma 100%
    return (cetNorm * 0.30) + (incNorm * 0.30) + (termNorm * 0.20) + (selicNorm * 0.20);
};

// ==========================================
// 3. CÁLCULOS DE CONSÓRCIO
// ==========================================

// RULE B3: embedded_total_cost_pct = admin_fee_total + (reserve_fund_rate × duration_years) + (insurance_total se aplicável)
export const calcularCustoEmbutidoTotal = (consorcio: DividaConsorcio): number => {
    const durationYears = consorcio.total_installments / 12;
    const reserveEffect = consorcio.reserve_fund_rate * durationYears;

    // Convertendo seguro mensal em % da carta para simplificar se não foi dado em %
    // (A regra cita insurance_total_pct, vamos estimar o percentual sobre a carta se dado em valor absoluto)
    let insurancePct = 0;
    if (consorcio.insurance_monthly && consorcio.credit_letter_value > 0) {
        const insuranceTotal = consorcio.insurance_monthly * consorcio.total_installments;
        insurancePct = (insuranceTotal / consorcio.credit_letter_value) * 100;
    }

    return consorcio.admin_fee_total + reserveEffect + insurancePct;
};

// RULE B4: real_monthly_cost = (total_paid_to_date / months_elapsed) × (1 + monetary_correction_accumulated / 100)
export const calcularCustoRealMensal = (consorcio: DividaConsorcio): number => {
    const monthsElapsed = consorcio.total_installments - consorcio.remaining_installments;
    if (monthsElapsed <= 0) return 0;

    const baseCost = consorcio.total_paid_to_date / monthsElapsed;
    const correctionRate = 1 + (consorcio.monetary_correction_accumulated / 100);
    return baseCost * correctionRate;
};

// 2.3 Contemplation Probability Engine
export const calcularProbabilidadeContemplacao = (consorcio: DividaConsorcio): 'HIGH' | 'MEDIUM' | 'LOW' => {
    // Já foi contemplado? Não aplica.
    if (consorcio.contemplation_status !== 'not_contemplated') return 'LOW'; // Or N/A

    const progressoTermo = consorcio.total_installments > 0
        ? consorcio.remaining_installments / consorcio.total_installments
        : 1;

    // Condições HIGH
    if (progressoTermo <= 0.40) return 'HIGH'; // past 60% of term
    if (consorcio.group_size <= 20) return 'HIGH';
    if (consorcio.bid_strategy !== 'none' && consorcio.estimated_bid_value && consorcio.estimated_bid_value > 0) return 'HIGH';

    // Condições LOW
    if (progressoTermo > 0.70) return 'LOW';

    // Fallback: MEDIUM (0.40 < x <= 0.70)
    return 'MEDIUM';
};

/**
 * Risk Score Calculator (Consortium) — versão unificada (soma 100% dos pesos).
 * Substitui a antiga `calcularRiskScoreConsorcio`, que só somava 70% (custo 35% +
 * probabilidade 20% + prazo 15%) e exigia que cada componente da UI somasse o peso de
 * renda (30%) manualmente — isso estava duplicado em 3 arquivos (ListaDividas,
 * PanelDetalheConsorcio, DashboardDividas). Agora a renda entra como parâmetro e o
 * cálculo completo mora em um único lugar.
 */
export const calcularRiskScoreConsorcioCompleto = (consorcio: DividaConsorcio, rendaMensalCliente: number): number => {
    const embeddedCost = calcularCustoEmbutidoTotal(consorcio);

    // embedded_cost_normalized : 0–100 (0% = 0, >= 25% = 100)
    let embedNorm = (embeddedCost / 25) * 100;
    if (embedNorm > 100) embedNorm = 100;
    if (embedNorm < 0) embedNorm = 0;

    // income_commitment_normalized : 0–100 (0% = 0, >= 35% = 100)
    const comprometimento = calcularComprometimentoRenda(consorcio.current_installment_value, rendaMensalCliente);
    let incNorm = (comprometimento / 35) * 100;
    if (incNorm > 100) incNorm = 100;
    if (incNorm < 0) incNorm = 0;

    // contemplation_probability_score: H=10, M=50, L=90
    const prob = calcularProbabilidadeContemplacao(consorcio);
    const probScore = prob === 'HIGH' ? 10 : (prob === 'MEDIUM' ? 50 : 90);

    // remaining_term_normalized : 0–100 (0m = 0, >= 60m = 100)
    let termNorm = (consorcio.remaining_installments / 60) * 100;
    if (termNorm > 100) termNorm = 100;
    if (termNorm < 0) termNorm = 0;

    // risk_score = (embedNorm × 0.35) + (probScore × 0.20) + (termNorm × 0.15) + (incNorm × 0.30) — soma 100%
    return (embedNorm * 0.35) + (probScore * 0.20) + (termNorm * 0.15) + (incNorm * 0.30);
};

/** Label humano do enum de contemplação — evita exibir o valor raw ("not_contemplated") em telas que não passam por ele. */
export const formatarContemplationStatus = (status: ContemplationStatus): string => {
    switch (status) {
        case 'not_contemplated': return 'Não Contemplado';
        case 'contemplated_by_draw': return 'Contemplado por Sorteio';
        case 'contemplated_by_bid': return 'Contemplado por Lance';
        case 'awaiting_confirmation': return 'Aguardando Confirmação';
        default: return status;
    }
};

// ==========================================
// 4. AMORTIZAÇÃO REAL (Price / SAC + correção monetária)
// ==========================================

export interface ParcelaCronograma {
    mes: number;
    parcela: number;
    juros: number;
    amortizacao: number;
    saldo: number;
}

export interface CronogramaAmortizacao {
    parcelas: ParcelaCronograma[];
    jurosTotais: number;
    mesesTotais: number;
}

interface ParametrosCronograma {
    saldo: number;
    meses: number;
    taxaMensal: number; // decimal (ex.: 0.02)
    sistema: 'price' | 'sac';
    /** Obrigatório para Price: valor da parcela fixa a manter. Se omitido, é calculado (PMT) para amortizar `saldo` em `meses`. */
    parcelaFixa?: number;
    /** Correção monetária mensal-equivalente (decimal), aplicada ao saldo antes do cálculo de juros do mês. */
    correcaoMensal?: number;
}

/** PMT (parcela) de uma série Price dado saldo, taxa e número de parcelas. */
const calcularParcelaPrice = (saldo: number, taxaMensal: number, meses: number): number => {
    if (meses <= 0) return saldo;
    if (taxaMensal <= 0) return saldo / meses;
    return (saldo * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -meses));
};

/**
 * Gera o cronograma de amortização restante mês a mês, respeitando o sistema (Price =
 * parcela fixa; SAC = amortização constante, parcela decrescente) e aplicando a correção
 * monetária ao saldo antes de calcular os juros do mês, quando configurada.
 */
export const gerarCronogramaAmortizacao = (params: ParametrosCronograma): CronogramaAmortizacao => {
    const { sistema, taxaMensal, meses, correcaoMensal = 0 } = params;
    let saldo = params.saldo;
    const parcelas: ParcelaCronograma[] = [];
    let jurosTotais = 0;

    if (sistema === 'price') {
        const parcelaFixa = params.parcelaFixa ?? calcularParcelaPrice(saldo, taxaMensal, meses);
        for (let mes = 1; mes <= meses && saldo > 0.01; mes++) {
            const saldoCorrigido = saldo * (1 + correcaoMensal);
            const juros = saldoCorrigido * taxaMensal;
            const amortizacao = Math.min(saldoCorrigido, parcelaFixa - juros);
            saldo = Math.max(0, saldoCorrigido - amortizacao);
            jurosTotais += juros;
            parcelas.push({ mes, parcela: amortizacao + juros, juros, amortizacao, saldo });
        }
    } else {
        // SAC: amortização constante calculada uma vez a partir do saldo/prazo informados.
        const amortizacaoConstante = params.saldo / meses;
        for (let mes = 1; mes <= meses && saldo > 0.01; mes++) {
            const saldoCorrigido = saldo * (1 + correcaoMensal);
            const juros = saldoCorrigido * taxaMensal;
            const amortizacao = Math.min(saldoCorrigido, amortizacaoConstante);
            saldo = Math.max(0, saldoCorrigido - amortizacao);
            jurosTotais += juros;
            parcelas.push({ mes, parcela: amortizacao + juros, juros, amortizacao, saldo });
        }
    }

    return { parcelas, jurosTotais, mesesTotais: parcelas.length };
};

export interface SaldoAtualEstimado {
    mesesDecorridos: number;
    saldoEstimado: number;
    parcelasRestantesEstimadas: number;
    /** true quando o valor estimado diverge do cadastrado em mais de R$ 50 ou 5%. */
    divergente: boolean;
}

/**
 * Estima o saldo devedor e as parcelas restantes "hoje", a partir da data de início do
 * contrato e do cronograma real de amortização (Price/SAC) — apenas para exibição/alerta;
 * NUNCA sobrescreve os valores cadastrados manualmente (`outstanding_balance`/
 * `remaining_installments` continuam sendo a fonte oficial, editável pelo usuário).
 * Retorna `null` quando não há dados suficientes (sem `start_date`, prazo zerado, ou o
 * contrato ainda não começou).
 */
export const calcularSaldoAtualEstimado = (credito: DividaCredito, hoje: Date = new Date()): SaldoAtualEstimado | null => {
    if (!credito.start_date || !credito.total_installments || credito.total_installments <= 0) return null;

    const inicio = new Date(credito.start_date);
    if (isNaN(inicio.getTime())) return null;

    const mesesDecorridos = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
    if (mesesDecorridos <= 0) return null;

    const mesesClamped = Math.min(mesesDecorridos, credito.total_installments);
    const taxaMensal = (credito.cet_monthly || 0) / 100;
    const correcaoMensal = credito.monetary_correction_annual
        ? Math.pow(1 + credito.monetary_correction_annual / 100, 1 / 12) - 1
        : 0;
    const sistema = credito.amortization_system || 'price';

    const cronogramaCompleto = gerarCronogramaAmortizacao({
        saldo: credito.contracted_value,
        meses: credito.total_installments,
        taxaMensal,
        sistema,
        parcelaFixa: sistema === 'price' ? credito.installment_value : undefined,
        correcaoMensal,
    });

    const pontoAtual = cronogramaCompleto.parcelas[mesesClamped - 1];
    const saldoEstimado = pontoAtual ? pontoAtual.saldo : 0;
    const parcelasRestantesEstimadas = Math.max(0, credito.total_installments - mesesClamped);

    const diffAbsoluta = Math.abs(saldoEstimado - credito.outstanding_balance);
    const diffRelativa = credito.outstanding_balance > 0 ? diffAbsoluta / credito.outstanding_balance : (saldoEstimado > 0 ? 1 : 0);
    const divergente = diffAbsoluta > 50 && diffRelativa > 0.05;

    return { mesesDecorridos: mesesClamped, saldoEstimado, parcelasRestantesEstimadas, divergente };
};

export type EstrategiaAporteExtra = 'reduzir_prazo' | 'reduzir_parcela';

export interface ResultadoSimulacaoAporte {
    jurosEconomizadosReais: number;
    mesesReduzidos: number;
    novaParcela: number | null;
    cronogramaBase: CronogramaAmortizacao;
    cronogramaComAporte: CronogramaAmortizacao;
}

/**
 * Simula o efeito real de um aporte extraordinário sobre o cronograma de um crédito,
 * comparando o total de juros do cronograma original com o do cronograma pós-aporte —
 * substitui a estimativa linear anterior (`aporte × taxa`, que não representava uma
 * amortização de verdade).
 */
export const simularAporteExtra = (
    credito: DividaCredito,
    valorAporte: number,
    estrategia: EstrategiaAporteExtra
): ResultadoSimulacaoAporte => {
    const taxaMensal = (credito.cet_monthly || 0) / 100;
    const correcaoMensal = credito.monetary_correction_annual
        ? Math.pow(1 + credito.monetary_correction_annual / 100, 1 / 12) - 1
        : 0;
    const sistema = credito.amortization_system || 'price';

    const cronogramaBase = gerarCronogramaAmortizacao({
        saldo: credito.outstanding_balance,
        meses: credito.remaining_installments,
        taxaMensal,
        sistema,
        parcelaFixa: sistema === 'price' ? credito.installment_value : undefined,
        correcaoMensal,
    });

    const novoSaldo = Math.max(0, credito.outstanding_balance - valorAporte);
    let cronogramaComAporte: CronogramaAmortizacao;
    let novaParcela: number | null = null;

    if (estrategia === 'reduzir_parcela') {
        // Mesmo prazo, parcela recalculada para o saldo menor.
        const parcelaFixa = sistema === 'price'
            ? calcularParcelaPrice(novoSaldo, taxaMensal, credito.remaining_installments)
            : undefined;
        cronogramaComAporte = gerarCronogramaAmortizacao({
            saldo: novoSaldo,
            meses: credito.remaining_installments,
            taxaMensal,
            sistema,
            parcelaFixa,
            correcaoMensal,
        });
        novaParcela = sistema === 'price' ? (parcelaFixa as number) : (cronogramaComAporte.parcelas[0]?.parcela ?? null);
    } else {
        // Mesma parcela (Price) / mesma amortização constante (SAC), prazo recalculado.
        cronogramaComAporte = gerarCronogramaAmortizacao({
            saldo: novoSaldo,
            // Limite superior generoso — o loop de geração já para quando o saldo zera.
            meses: credito.remaining_installments,
            taxaMensal,
            sistema,
            parcelaFixa: sistema === 'price' ? credito.installment_value : undefined,
            correcaoMensal,
        });
    }

    return {
        jurosEconomizadosReais: Math.max(0, cronogramaBase.jurosTotais - cronogramaComAporte.jurosTotais),
        mesesReduzidos: Math.max(0, cronogramaBase.mesesTotais - cronogramaComAporte.mesesTotais),
        novaParcela,
        cronogramaBase,
        cronogramaComAporte,
    };
};

// ==========================================
// 5. SIMULAÇÃO DE QUITAÇÃO AGREGADA DA CARTEIRA
// ==========================================

export interface PontoQuitacaoCarteira {
    mes: number;
    saldoTotal: number;
}

export interface ResultadoQuitacaoCarteira {
    meses: number;
    jurosTotaisPagos: number;
    serie: PontoQuitacaoCarteira[];
}

/**
 * Simula, mês a mês, a quitação de toda a carteira de créditos pagando o mínimo de cada
 * dívida e direcionando o aporte extra mensal (mais o valor liberado pelas dívidas já
 * quitadas, em cascata — efeito "bola de neve") para a primeira dívida ainda aberta na
 * ordem recebida (já ordenada pelo chamador via `ordenarAvalanche`/`ordenarSnowball`).
 */
export const simularQuitacaoCarteira = (
    dividasOrdenadas: DividaCredito[],
    aporteExtraMensal: number
): ResultadoQuitacaoCarteira => {
    const LIMITE_MESES = 600; // 50 anos — guarda de segurança contra loop infinito
    const saldos = dividasOrdenadas.map(d => d.outstanding_balance);
    const taxas = dividasOrdenadas.map(d => (d.cet_monthly || 0) / 100);
    const parcelasMinimas = dividasOrdenadas.map(d => d.installment_value);
    const quitada = saldos.map(s => s <= 0.01);

    const serie: PontoQuitacaoCarteira[] = [];
    let jurosTotaisPagos = 0;
    let mes = 0;
    let orcamentoLiberado = 0; // parcelas de dívidas já quitadas, redirecionadas em cascata

    while (saldos.some(s => s > 0.01) && mes < LIMITE_MESES) {
        mes++;
        let aporteDisponivel = aporteExtraMensal + orcamentoLiberado;
        orcamentoLiberado = 0;

        // 1. Juros do mês + parcela mínima em cada dívida ainda aberta.
        for (let i = 0; i < saldos.length; i++) {
            if (quitada[i]) continue;
            const juros = saldos[i] * taxas[i];
            jurosTotaisPagos += juros;
            saldos[i] = saldos[i] + juros - parcelasMinimas[i];
        }

        // 2. Direciona o aporte disponível (extra + liberado de dívidas já quitadas) à primeira
        //    dívida ainda aberta, na ordem de prioridade — efeito cascata "bola de neve".
        for (let i = 0; i < saldos.length && aporteDisponivel > 0; i++) {
            if (quitada[i]) continue;
            const abatimento = Math.min(saldos[i], aporteDisponivel);
            saldos[i] -= abatimento;
            aporteDisponivel -= abatimento;
        }

        // 3. Dívidas que zeraram neste mês — por mínimo, por aporte extra, ou por ambos — liberam
        //    sua parcela mínima (+ eventual excedente pago a mais) para o mês seguinte. Antes desta
        //    correção, uma dívida quitada só pelo aporte extra (o caso mais comum) nunca liberava
        //    sua parcela mínima para as próximas na fila — subestimando o efeito cascata.
        for (let i = 0; i < saldos.length; i++) {
            if (!quitada[i] && saldos[i] <= 0.01) {
                quitada[i] = true;
                orcamentoLiberado += parcelasMinimas[i] + Math.max(0, -saldos[i]);
                saldos[i] = 0;
            }
        }

        serie.push({ mes, saldoTotal: saldos.reduce((acc, s) => acc + s, 0) });
    }

    return { meses: mes, jurosTotaisPagos, serie };
};
