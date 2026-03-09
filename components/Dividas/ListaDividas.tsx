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
        if (score >= 75) return 'bg-rose-100 text-rose-700';
        if (score >= 40) return 'bg-amber-100 text-amber-700';
        return 'bg-emerald-100 text-emerald-700';
    };

    return (
        <div className="space-y-6">

            {/* Lista de Créditos e Empréstimos */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg"><FileDigit size={18} /></div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Créditos e Financiamentos</h3>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Ordenado por: {prioritizationMethod === 'avalanche' ? 'Avalanche (Taxa Menor Saldo)' : 'Snowball (Menor Saldo)'}</p>
                        </div>
                    </div>
                    <div className="text-[11px] font-black tracking-widest text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-200">
                        {creditos.length} REGISTROS
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white border-b border-slate-100">
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Rank</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Dívida / Instituição</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">CET a.m.</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Saldo Devedor</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Parcelas</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Risco</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Alertas</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {creditos.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-sm">Nenhuma dívida de crédito registrada.</td></tr>
                            ) : (
                                creditos.map((cred, index) => {
                                    const alertas = alertasDividaService.gerarAlertasCredito(cred);
                                    const score = calcularRiskScoreCredito(cred);

                                    return (
                                        <tr key={cred.debt_id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => onSelectCredito(cred)}>
                                            <td className="px-5 py-4">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                                    {index + 1}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="text-sm font-bold text-slate-700">{cred.debt_label}</div>
                                                <div className="text-[11px] text-slate-400 font-medium">{cred.institution}</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="text-sm font-semibold text-rose-600">{Number(cred.cet_monthly).toFixed(2)}%</div>
                                                <div className="text-[10px] text-slate-400">{(cred.cet_annual).toFixed(2)}% a.a.</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="text-sm font-semibold text-slate-700">R$ {Number(cred.outstanding_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                <div className="text-[10px] text-slate-400">Parc: R$ {Number(cred.installment_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="text-sm font-medium text-slate-700">{cred.remaining_installments} <span className="text-[11px] text-slate-400">/ {cred.total_installments}</span></div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-widest ${getRiskVariant(score)}`}>
                                                    {score.toFixed(0)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {renderAlerts(alertas)}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500 transition-colors inline-block" />
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
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-50 text-sky-500 rounded-lg"><FileDigit size={18} /></div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Consórcios</h3>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Ordenado por: {prioritizationMethod === 'avalanche' ? 'Avalanche (Custo Embutido)' : 'Snowball (Menor Prazo)'}</p>
                        </div>
                    </div>
                    <div className="text-[11px] font-black tracking-widest text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-200">
                        {consorcios.length} REGISTROS
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white border-b border-slate-100">
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Rank</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Consórcio / Adm</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Custo Embutido</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Carta de Crédito</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Risco</th>
                                <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Alertas</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {consorcios.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-slate-400 text-sm">Nenhum consórcio registrado.</td></tr>
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
                                        if (st === 'not_contemplated') return { label: 'Não Contemplado', bg: 'bg-slate-100 text-slate-600' };
                                        if (st === 'contemplated_by_draw') return { label: 'Contemp. por Sorteio', bg: 'bg-emerald-100 text-emerald-700' };
                                        if (st === 'contemplated_by_bid') return { label: 'Contemp. por Lance', bg: 'bg-emerald-100 text-emerald-700' };
                                        return { label: 'Aguardando', bg: 'bg-amber-100 text-amber-700' };
                                    };
                                    const stTag = parseStatus(cons.contemplation_status);

                                    return (
                                        <tr key={cons.consortium_id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => onSelectConsorcio(cons)}>
                                            <td className="px-5 py-4">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                                    {index + 1}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="text-sm font-bold text-slate-700">{cons.consortium_label}</div>
                                                <div className="text-[11px] text-slate-400 font-medium">{cons.administrator}</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="text-sm font-semibold text-rose-600">{Number(calcularCustoEmbutidoTotal(cons)).toFixed(2)}%</div>
                                                <div className="text-[10px] text-slate-400">Total</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="text-sm font-semibold text-slate-700">R$ {Number(cons.credit_letter_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                <div className="text-[10px] text-slate-400">Parc: R$ {Number(cons.current_installment_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap ${stTag.bg}`}>
                                                    {stTag.label}
                                                </span>
                                                <div className="text-[10px] text-slate-400 mt-1">{cons.remaining_installments} parc. restantes</div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-widest ${getRiskVariant(score)}`}>
                                                    {score.toFixed(0)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {renderAlerts(alertas)}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500 transition-colors inline-block" />
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
