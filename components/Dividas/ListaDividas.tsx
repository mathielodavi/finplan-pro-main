import React from 'react';
import { DividaCredito, DividaConsorcio, PrioritizationMethod } from '../../types/dividas';
import { AlertTriangle, AlertCircle, Info, ChevronRight, FileDigit } from 'lucide-react';
import { alertasDividaService, Alert } from '../../services/alertasDividasService';
import { calcularRiskScoreCredito, calcularRiskScoreConsorcio, calcularCustoEmbutidoTotal } from '../../utils/calculosDividas';
import { format } from 'date-fns';

interface Props {
    creditos: DividaCredito[];
    consorcios: DividaConsorcio[];
    rendaMensalCliente: number;
    prioritizationMethod: PrioritizationMethod;
    onSelectCredito: (credito: DividaCredito) => void;
    onSelectConsorcio: (consorcio: DividaConsorcio) => void;
}

const ListaDividas: React.FC<Props> = ({
    creditos,
    consorcios,
    rendaMensalCliente,
    prioritizationMethod,
    onSelectCredito,
    onSelectConsorcio
}) => {

    // Função auxiliar para renderizar pílulas de alerta
    const renderAlerts = (alertas: Alert[]) => {
        if (alertas.length === 0) return null;

        const crit = alertas.filter(a => a.severity === 'CRITICAL').length;
        const warn = alertas.filter(a => a.severity === 'WARNING').length;
        const info = alertas.filter(a => a.severity === 'INFO').length;

        return (
            <div className="flex gap-1">
                {crit > 0 && <span className="bg-rose-100 text-rose-700 p-1 rounded flex items-center gap-1 text-[10px] font-bold"><AlertTriangle size={12} />{crit}</span>}
                {warn > 0 && <span className="bg-amber-100 text-amber-700 p-1 rounded flex items-center gap-1 text-[10px] font-bold"><AlertCircle size={12} />{warn}</span>}
                {info > 0 && <span className="bg-sky-100 text-sky-700 p-1 rounded flex items-center gap-1 text-[10px] font-bold"><Info size={12} />{info}</span>}
            </div>
        );
    };

    const getRiskVariant = (score: number) => {
        if (score >= 75) return 'bg-rose-50 border border-rose-100 text-rose-700';
        if (score >= 40) return 'bg-amber-50 border border-amber-100 text-amber-700';
        return 'bg-emerald-50 border border-emerald-100 text-emerald-700';
    };

    return (
        <div className="space-y-6">

            {/* Lista de Créditos e Empréstimos */}
            <div className="bg-surface rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
                <div className="px-5 py-4 border-b border-subtle flex justify-between items-center bg-surface-2/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-500 rounded-[8px]"><FileDigit size={16} /></div>
                        <div>
                            <h3 className="text-[13px] font-bold text-main tracking-tight">Créditos e Financiamentos</h3>
                            <p className="text-[10px] text-muted uppercase tracking-wider font-bold mt-0.5">Ordenado por: {prioritizationMethod === 'avalanche' ? 'Avalanche (Taxa Menor Saldo)' : 'Snowball (Menor Saldo)'}</p>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold tracking-wider text-muted bg-surface px-3 py-1.5 rounded-[8px] border border-subtle shadow-sm">
                        {creditos.length} REGISTROS
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface border-b border-subtle">
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Rank</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Dívida / Instituição</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">CET a.m.</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Saldo Devedor</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Parcelas</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Risco</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Alertas</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {creditos.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-faint text-sm">Nenhuma dívida de crédito registrada.</td></tr>
                            ) : (
                                creditos.map((cred, index) => {
                                    const alertas = alertasDividaService.gerarAlertasCredito(cred);
                                    const score = calcularRiskScoreCredito(cred);

                                    return (
                                        <tr key={cred.debt_id} className="hover:bg-surface-2 transition-colors cursor-pointer group" onClick={() => onSelectCredito(cred)}>
                                            <td className="px-5 py-3">
                                                <div className="w-6 h-6 rounded-[6px] bg-surface-2 border border-subtle flex items-center justify-center text-[11px] font-bold text-muted">
                                                    {index + 1}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[12px] font-bold text-main tracking-tight">{cred.debt_label}</div>
                                                <div className="text-[10px] text-muted font-bold uppercase tracking-wider mt-0.5">{cred.institution}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[12px] font-bold text-rose-600">{Number(cred.cet_monthly).toFixed(2)}%</div>
                                                <div className="text-[10px] text-muted font-bold uppercase mt-0.5">{(cred.cet_annual).toFixed(2)}% a.a.</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[12px] font-bold text-main">R$ {Number(cred.outstanding_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                <div className="text-[10px] text-muted font-bold uppercase mt-0.5">Parc: R$ {Number(cred.installment_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[12px] font-bold text-main">{cred.remaining_installments} <span className="text-[10px] text-faint font-bold uppercase">/ {cred.total_installments}</span></div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-1 rounded-[6px] text-[10px] font-bold tracking-wider ${getRiskVariant(score)}`}>
                                                    {score.toFixed(0)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {renderAlerts(alertas)}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <ChevronRight size={16} className="text-faint group-hover:text-emerald-500 transition-colors inline-block" />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Lista de Consórcios */}
            <div className="bg-surface rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
                <div className="px-5 py-4 border-b border-subtle flex justify-between items-center bg-surface-2/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-50 text-sky-500 rounded-[8px]"><FileDigit size={16} /></div>
                        <div>
                            <h3 className="text-[13px] font-bold text-main tracking-tight">Consórcios</h3>
                            <p className="text-[10px] text-muted uppercase tracking-wider font-bold mt-0.5">Ordenado por: {prioritizationMethod === 'avalanche' ? 'Avalanche (Custo Embutido)' : 'Snowball (Menor Prazo)'}</p>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold tracking-wider text-muted bg-surface px-3 py-1.5 rounded-[8px] border border-subtle shadow-sm">
                        {consorcios.length} REGISTROS
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface border-b border-subtle">
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Rank</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Consórcio / Adm</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Custo Embutido</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Carta de Crédito</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Status</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Risco</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Alertas</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                            {consorcios.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-faint text-sm">Nenhum consórcio registrado.</td></tr>
                            ) : (
                                consorcios.map((cons, index) => {
                                    const alertas = alertasDividaService.gerarAlertasConsorcio(cons);

                                    // wrapper local pra calcular o Risco do Consórcio incluindo a renda
                                    const calcRisco = () => {
                                        const incNorm = rendaMensalCliente > 0 ? ((cons.current_installment_value / rendaMensalCliente) * 100 / 35) * 100 : 0;
                                        let finalInc = incNorm > 100 ? 100 : incNorm;
                                        return calcularRiskScoreConsorcio(cons) + (finalInc * 0.30);
                                    };
                                    const score = calcRisco();

                                    // Status tag logic
                                    const parseStatus = (st: string) => {
                                        if (st === 'not_contemplated') return { label: 'Não Contemplado', bg: 'bg-surface-2 text-muted border border-subtle' };
                                        if (st === 'contemplated_by_draw') return { label: 'Contemp. por Sorteio', bg: 'bg-emerald-50 text-emerald-700 border border-emerald-100' };
                                        if (st === 'contemplated_by_bid') return { label: 'Contemp. por Lance', bg: 'bg-emerald-50 text-emerald-700 border border-emerald-100' };
                                        return { label: 'Aguardando', bg: 'bg-amber-50 text-amber-700 border border-amber-100' };
                                    };
                                    const stTag = parseStatus(cons.contemplation_status);

                                    return (
                                        <tr key={cons.consortium_id} className="hover:bg-surface-2 transition-colors cursor-pointer group" onClick={() => onSelectConsorcio(cons)}>
                                            <td className="px-5 py-3">
                                                <div className="w-6 h-6 rounded-[6px] bg-surface-2 border border-subtle flex items-center justify-center text-[11px] font-bold text-muted">
                                                    {index + 1}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[12px] font-bold text-main tracking-tight">{cons.consortium_label}</div>
                                                <div className="text-[10px] text-muted font-bold uppercase tracking-wider mt-0.5">{cons.administrator}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[12px] font-bold text-rose-600">{Number(calcularCustoEmbutidoTotal(cons)).toFixed(2)}%</div>
                                                <div className="text-[10px] text-muted font-bold uppercase tracking-wider mt-0.5">Total</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[12px] font-bold text-main">R$ {Number(cons.credit_letter_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                <div className="text-[10px] text-muted font-bold uppercase tracking-wider mt-0.5">Parc: R$ {Number(cons.current_installment_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-1 rounded-[6px] text-[10px] font-bold whitespace-nowrap tracking-wider ${stTag.bg}`}>
                                                    {stTag.label}
                                                </span>
                                                <div className="text-[10px] text-muted font-bold uppercase tracking-wider mt-1.5">{cons.remaining_installments} parc. restantes</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-1 rounded-[6px] text-[10px] font-bold tracking-wider ${getRiskVariant(score)}`}>
                                                    {score.toFixed(0)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {renderAlerts(alertas)}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <ChevronRight size={16} className="text-faint group-hover:text-emerald-500 transition-colors inline-block" />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ListaDividas;
