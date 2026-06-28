import React from 'react';
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, PieChart, Activity } from 'lucide-react';
import { DividaCredito, DividaConsorcio } from '../../types/dividas';
import { calcularRiskScoreCredito, calcularRiskScoreConsorcio, calcularCustoEmbutidoTotal } from '../../utils/calculosDividas';

interface Props {
    creditos: DividaCredito[];
    consorcios: DividaConsorcio[];
    rendaMensalCliente: number;
}

const formatarMoedaLocal = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

const DashboardDividas: React.FC<Props> = ({ creditos, consorcios, rendaMensalCliente }) => {
    // KPI-01: Total Active Debts
    const totalActiveCreditos = creditos.length;
    const totalActiveConsorcios = consorcios.length;
    const totalActiveDebts = totalActiveCreditos + totalActiveConsorcios;

    // KPI-02: Total Outstanding Balance
    const totalCreditoBalance = creditos.reduce((acc, c) => acc + c.outstanding_balance, 0);
    const totalConsorcioBalance = consorcios.reduce((acc, c) => {
        // formula: total credit letters - total paid
        return acc + Math.max(0, c.credit_letter_value - c.total_paid_to_date);
    }, 0);
    const totalOutstandingBalance = totalCreditoBalance + totalConsorcioBalance;

    // KPI-03: Total Income Commitment
    const totalCreditoInstallments = creditos.reduce((acc, c) => acc + c.installment_value, 0);
    const totalConsorcioInstallments = consorcios.reduce((acc, c) => acc + c.current_installment_value, 0);
    const totalInstallments = totalCreditoInstallments + totalConsorcioInstallments;
    const incomeCommitment = rendaMensalCliente > 0 ? (totalInstallments / rendaMensalCliente) * 100 : 0;

    // KPI-04: Weighted Average Cost (Credits Only)
    let weightedAverageCost = 0;
    if (totalCreditoBalance > 0) {
        weightedAverageCost = creditos.reduce((acc, c) => {
            const weight = c.outstanding_balance / totalCreditoBalance;
            return acc + (c.cet_monthly * weight);
        }, 0);
    }

    // KPI-05: Highest Risk Debt
    let highestRiskDebtLabel = '—';
    let highestRiskScore = 0;

    creditos.forEach(c => {
        const score = calcularRiskScoreCredito(c);
        if (score > highestRiskScore) {
            highestRiskScore = score;
            highestRiskDebtLabel = c.debt_label;
        }
    });

    consorcios.forEach(c => {
        // Precisamos do score: o wrapper incNorm será calculado aqui para consorcio
        const incNorm = rendaMensalCliente > 0 ? ((c.current_installment_value / rendaMensalCliente) * 100 / 35) * 100 : 0;
        let finalInc = incNorm > 100 ? 100 : incNorm;
        const scoreBase = calcularRiskScoreConsorcio(c);
        const score = scoreBase + (finalInc * 0.30);

        if (score > highestRiskScore) {
            highestRiskScore = score;
            highestRiskDebtLabel = c.consortium_label;
        }
    });

    const getRiskTier = (score: number) => {
        if (score >= 75) return { label: 'CRÍTICO', color: 'text-rose-600 bg-rose-50 border-rose-100' };
        if (score >= 40) return { label: 'ATENÇÃO', color: 'text-amber-600 bg-amber-50 border-amber-100' };
        if (score > 0) return { label: 'CONTROLADO', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
        return { label: '—', color: 'text-faint bg-surface-2 border-subtle' };
    };
    const riskBadge = getRiskTier(highestRiskScore);

    // KPI-06: Closest to Payoff
    let closestPayoffLabel = '—';
    let closestRemaining = Infinity;

    [...creditos, ...consorcios].forEach(d => {
        if (d.remaining_installments < closestRemaining && d.remaining_installments > 0) {
            closestRemaining = d.remaining_installments;
            closestPayoffLabel = ('debt_label' in d) ? d.debt_label : d.consortium_label;
        }
    });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* KPI 01 */}
            <div className="bg-surface rounded-xl border border-subtle p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-[6px] bg-indigo-50 flex items-center justify-center text-indigo-500">
                        <CreditCard size={12} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-faint">Total Ativas</span>
                </div>
                <div>
                    <div className="text-[20px] font-bold text-main tracking-tight mb-1 leading-none">
                        {totalActiveDebts}
                    </div>
                    <div className="flex gap-2">
                        <span className="text-[11px] font-bold text-muted">{totalActiveCreditos} créditos</span>
                        <span className="text-[11px] text-faint">•</span>
                        <span className="text-[11px] font-bold text-muted">{totalActiveConsorcios} consórcios</span>
                    </div>
                </div>
            </div>

            {/* KPI 02 */}
            <div className="bg-surface rounded-xl border border-subtle p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-[6px] bg-emerald-50 flex items-center justify-center text-emerald-500">
                        <TrendingUp size={12} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-faint">Saldo Devedor</span>
                </div>
                <div>
                    <div className="text-[20px] font-bold text-main tracking-tight mb-1 leading-none">
                        {formatarMoedaLocal(totalOutstandingBalance)}
                    </div>
                    <div className="text-[11px] font-bold text-muted">Saldo pendente somado</div>
                </div>
            </div>

            {/* KPI 03 */}
            <div className="bg-surface rounded-xl border border-subtle p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-[6px] bg-amber-50 flex items-center justify-center text-amber-500">
                        <PieChart size={12} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-faint">Compromet.</span>
                </div>
                <div>
                    <div className="text-[20px] font-bold text-main tracking-tight mb-1 leading-none">
                        {incomeCommitment.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </div>
                    <div className="text-[11px] font-bold text-muted block truncate max-w-full">{formatarMoedaLocal(totalInstallments)} / mês</div>
                </div>
            </div>

            {/* KPI 04 */}
            <div className="bg-surface rounded-xl border border-subtle p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-[6px] bg-violet-50 flex items-center justify-center text-violet-500">
                        <Activity size={12} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-faint">Custo Médio</span>
                </div>
                <div>
                    <div className="text-[20px] font-bold text-main tracking-tight mb-1 leading-none">
                        {weightedAverageCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% <span className="text-[10px] text-faint tracking-wider font-bold uppercase">a.m.</span>
                    </div>
                    <div className="text-[11px] font-bold text-muted">Média pond. créditos</div>
                </div>
            </div>

            {/* KPI 05 */}
            <div className="bg-surface rounded-xl border border-subtle p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-[6px] bg-rose-50 flex items-center justify-center text-rose-500">
                        <AlertTriangle size={12} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-faint">Maior Risco</span>
                </div>
                <div className="mt-auto">
                    <div className="text-[11px] font-bold text-main uppercase tracking-tight truncate mb-2">{highestRiskDebtLabel}</div>
                    <div className={`inline-flex items-center border px-2 py-0.5 rounded-[4px] text-[9px] font-bold tracking-wider ${riskBadge.color}`}>
                        {riskBadge.label} ({highestRiskScore.toFixed(0)})
                    </div>
                </div>
            </div>

            {/* KPI 06 */}
            <div className="bg-surface rounded-xl border border-subtle p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-[6px] bg-sky-50 flex items-center justify-center text-sky-500">
                        <CheckCircle size={12} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-faint">Próx. Quitação</span>
                </div>
                <div className="mt-auto">
                    <div className="text-[11px] font-bold text-main uppercase tracking-tight truncate mb-1">{closestPayoffLabel}</div>
                    <div className="text-[11px] text-muted font-bold">
                        {closestRemaining === Infinity ? 'N/D' : `${closestRemaining} parcelas restantes`}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardDividas;
