import React from 'react';
import { DividaCredito, DividaConsorcio, PrioritizationMethod } from '../../types/dividas';
import { AlertTriangle, AlertCircle, Info, ChevronRight, FileDigit } from 'lucide-react';
import { alertasDividaService, Alert, AlertSeverity } from '../../services/alertasDividasService';
import { calcularRiskScoreCredito, calcularRiskScoreConsorcioCompleto, calcularCustoEmbutidoTotal, formatarContemplationStatus } from '../../utils/calculosDividas';
import Badge from '../UI/Badge';

interface Props {
    creditos: DividaCredito[];
    consorcios: DividaConsorcio[];
    rendaMensalCliente: number;
    selicAnual: number;
    prioritizationMethod: PrioritizationMethod;
    onSelectCredito: (credito: DividaCredito) => void;
    onSelectConsorcio: (consorcio: DividaConsorcio) => void;
}

const severidadeIcone: Record<AlertSeverity, React.ReactNode> = {
    CRITICAL: <AlertTriangle size={12} />,
    WARNING: <AlertCircle size={12} />,
    INFO: <Info size={12} />,
};

const severidadeVariant: Record<AlertSeverity, 'danger' | 'warning' | 'info'> = {
    CRITICAL: 'danger',
    WARNING: 'warning',
    INFO: 'info',
};

const ListaDividas: React.FC<Props> = ({
    creditos,
    consorcios,
    rendaMensalCliente,
    selicAnual,
    prioritizationMethod,
    onSelectCredito,
    onSelectConsorcio
}) => {

    const renderAlerts = (alertas: Alert[]) => {
        if (alertas.length === 0) return null;

        const porSeveridade: Record<AlertSeverity, number> = { CRITICAL: 0, WARNING: 0, INFO: 0 };
        alertas.forEach(a => porSeveridade[a.severity]++);

        return (
            <div className="flex gap-1">
                {(['CRITICAL', 'WARNING', 'INFO'] as AlertSeverity[]).map(sev => porSeveridade[sev] > 0 && (
                    <Badge key={sev} variant={severidadeVariant[sev]} size="sm">
                        <span className="inline-flex items-center gap-1">{severidadeIcone[sev]}{porSeveridade[sev]}</span>
                    </Badge>
                ))}
            </div>
        );
    };

    const riskVariant = (score: number): 'danger' | 'warning' | 'success' => {
        if (score >= 75) return 'danger';
        if (score >= 40) return 'warning';
        return 'success';
    };

    return (
        <div className="space-y-6">

            {/* Lista de Créditos e Empréstimos */}
            <div className="bg-surface rounded-xl border border-subtle overflow-hidden">
                <div className="px-5 py-4 border-b border-subtle flex justify-between items-center bg-surface-2/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 text-primary rounded-[8px]"><FileDigit size={16} /></div>
                        <div>
                            <h3 className="text-[13px] font-bold text-main tracking-tight">Créditos e Financiamentos</h3>
                            <p className="text-[10px] text-muted uppercase tracking-wider font-bold mt-0.5">Ordenado por: {prioritizationMethod === 'avalanche' ? 'Avalanche (maior taxa primeiro)' : 'Snowball (menor saldo primeiro)'}</p>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold tracking-wider text-muted bg-surface px-3 py-1.5 rounded-[8px] border border-subtle">
                        {creditos.length} REGISTROS
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-surface border-b border-subtle">
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Rank</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Dívida / Instituição</th>
                                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">CET a.a.</th>
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
                                    const score = calcularRiskScoreCredito(cred, selicAnual);

                                    return (
                                        <tr key={cred.debt_id} className="hover:bg-surface-2 transition-colors cursor-pointer group" onClick={() => onSelectCredito(cred)}>
                                            <td className="px-5 py-3">
                                                <div className="w-6 h-6 rounded-[6px] bg-surface-2 border border-subtle flex items-center justify-center text-[11px] font-bold text-muted">
                                                    {index + 1}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-[12px] font-bold text-main tracking-tight">{cred.debt_label}</div>
                                                    {cred.situacao === 'em_atraso' && <Badge variant="danger" size="sm">EM ATRASO</Badge>}
                                                </div>
                                                <div className="text-[10px] text-muted font-bold uppercase tracking-wider mt-0.5">{cred.institution}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[12px] font-bold text-danger">{Number(cred.cet_annual).toFixed(2)}% a.a.</div>
                                                <div className="text-[10px] text-muted font-bold uppercase mt-0.5">{Number(cred.cet_monthly).toFixed(2)}% a.m. <span className="text-faint">(Selic {selicAnual.toFixed(1)}%)</span></div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[12px] font-bold text-main">R$ {Number(cred.outstanding_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                <div className="text-[10px] text-muted font-bold uppercase mt-0.5">Parc: R$ {Number(cred.installment_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[12px] font-bold text-main">{cred.remaining_installments} <span className="text-[10px] text-faint font-bold uppercase">/ {cred.total_installments}</span></div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <Badge variant={riskVariant(score)} size="sm">{score.toFixed(0)}</Badge>
                                            </td>
                                            <td className="px-5 py-4">
                                                {renderAlerts(alertas)}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <ChevronRight size={16} className="text-faint group-hover:text-primary transition-colors inline-block" />
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
            <div className="bg-surface rounded-xl border border-subtle overflow-hidden">
                <div className="px-5 py-4 border-b border-subtle flex justify-between items-center bg-surface-2/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-info/10 text-info rounded-[8px]"><FileDigit size={16} /></div>
                        <div>
                            <h3 className="text-[13px] font-bold text-main tracking-tight">Consórcios</h3>
                            <p className="text-[10px] text-muted uppercase tracking-wider font-bold mt-0.5">Ordenado por: {prioritizationMethod === 'avalanche' ? 'Avalanche (custo embutido)' : 'Snowball (menor prazo)'}</p>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold tracking-wider text-muted bg-surface px-3 py-1.5 rounded-[8px] border border-subtle">
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
                                    const score = calcularRiskScoreConsorcioCompleto(cons, rendaMensalCliente);

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
                                                <div className="text-[12px] font-bold text-danger">{Number(calcularCustoEmbutidoTotal(cons)).toFixed(2)}%</div>
                                                <div className="text-[10px] text-muted font-bold uppercase tracking-wider mt-0.5">Total</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="text-[12px] font-bold text-main">R$ {Number(cons.credit_letter_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                <div className="text-[10px] text-muted font-bold uppercase tracking-wider mt-0.5">Parc: R$ {Number(cons.current_installment_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <Badge variant={cons.contemplation_status.startsWith('contemplated') ? 'success' : 'neutral'} size="sm">
                                                    {formatarContemplationStatus(cons.contemplation_status)}
                                                </Badge>
                                                <div className="text-[10px] text-muted font-bold uppercase tracking-wider mt-1.5">{cons.remaining_installments} parc. restantes</div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <Badge variant={riskVariant(score)} size="sm">{score.toFixed(0)}</Badge>
                                            </td>
                                            <td className="px-5 py-4">
                                                {renderAlerts(alertas)}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <ChevronRight size={16} className="text-faint group-hover:text-primary transition-colors inline-block" />
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
