import React from 'react';
import { CreditCard, TrendingUp, AlertTriangle, CheckCircle, PieChart, Activity } from 'lucide-react';
import { DividaCredito, DividaConsorcio } from '../../types/dividas';
import { calcularRiskScoreCredito, calcularRiskScoreConsorcio, calcularCustoEmbutidoTotal } from '../../utils/calculosDividas';

interface Props {
    creditos: DividaCredito[];
    consorcios: DividaConsorcio[];
    rendaMensalCliente: number;
}

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
        return { label: '—', color: 'text-slate-400 bg-slate-50 border-slate-100' };
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
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center text-indigo-500">
                        <CreditCard size={14} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total Ativas</span>
                </div>
                <div>
                    <div className="text-xl text-slate-900 tracking-tighter mb-1 border-b-[3px] border-indigo-500 pb-0.5 inline-block pr-2">
                        {totalActiveDebts}
                    </div>
                    <div className="flex gap-2">
                        <span className="text-[10px] text-slate-500">{totalActiveCreditos} créditos</span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[10px] text-slate-500">{totalActiveConsorcios} consórcios</span>
                    </div>
                </div>
            </div>

            {/* KPI 02 */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-500">
                        <TrendingUp size={14} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Saldo Devedor</span>
                </div>
                <div>
                    <div className="text-xl text-slate-900 tracking-tighter mb-1 border-b-[3px] border-emerald-500 pb-0.5 inline-block pr-2">
                        R$ {totalOutstandingBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-slate-500">Saldo pendente somado</div>
                </div>
            </div>

            {/* KPI 03 */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-amber-50 flex items-center justify-center text-amber-500">
                        <PieChart size={14} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Compromet.</span>
                </div>
                <div>
                    <div className="text-xl text-slate-900 tracking-tighter mb-1 border-b-[3px] border-amber-500 pb-0.5 inline-block pr-2">
                        {incomeCommitment.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </div>
                    <div className="text-[10px] text-slate-500 block truncate max-w-full">R$ {totalInstallments.toLocaleString('pt-BR')} / mês</div>
                </div>
            </div>

            {/* KPI 04 */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-violet-50 flex items-center justify-center text-violet-500">
                        <Activity size={14} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Custo Médio</span>
                </div>
                <div>
                    <div className="text-xl text-slate-900 tracking-tighter mb-1 border-b-[3px] border-violet-500 pb-0.5 inline-block pr-2">
                        {weightedAverageCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% <span className="text-[10px] text-slate-400 tracking-normal font-normal uppercase">a.m.</span>
                    </div>
                    <div className="text-[10px] text-slate-500">Média pond. créditos</div>
                </div>
            </div>

            {/* KPI 05 */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md bg-rose-50 flex items-center justify-center text-rose-500">
                        <AlertTriangle size={14} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Maior Risco</span>
                </div>
                <div className="mt-auto">
                    <div className="text-[11px] font-bold text-slate-700 truncate mb-2">{highestRiskDebtLabel}</div>
                    <div className={`inline-flex items-center border px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest ${riskBadge.color}`}>
                        {riskBadge.label} ({highestRiskScore.toFixed(0)})
                    </div>
                </div>
            </div>

            {/* KPI 06 */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md bg-sky-50 flex items-center justify-center text-sky-500">
                        <CheckCircle size={14} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Próx. Quitação</span>
                </div>
                <div className="mt-auto">
                    <div className="text-[11px] font-bold text-slate-700 truncate mb-1">{closestPayoffLabel}</div>
                    <div className="text-[10px] text-slate-500 font-medium">
                        {closestRemaining === Infinity ? 'N/D' : `${closestRemaining} parcelas restantes`}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardDividas;
