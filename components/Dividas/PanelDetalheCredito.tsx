import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit2, Calculator, AlertTriangle, AlertCircle, Info, Trash2 } from 'lucide-react';
import { DividaCredito } from '../../types/dividas';
import { calcularRiskScoreCredito } from '../../utils/calculosDividas';
import { alertasDividaService } from '../../services/alertasDividasService';
import Button from '../UI/Button';
import Input from '../UI/Input';

interface Props {
    open: boolean;
    onClose: () => void;
    credito: DividaCredito | null;
    onEdit: (cred: DividaCredito) => void;
    onDelete: (id: string) => void;
}

const PanelDetalheCredito: React.FC<Props> = ({ open, onClose, credito, onEdit, onDelete }) => {
    const [simulAmount, setSimulAmount] = useState<number | ''>('');

    if (!open || !credito) return null;

    const alertas = alertasDividaService.gerarAlertasCredito(credito);
    const score = calcularRiskScoreCredito(credito);

    // Simulador de Amortização Simplificado
    const savings = simulAmount && simulAmount > 0 ? (Number(simulAmount) * (credito.cet_monthly / 100)) : 0;
    const installmentsReduced = simulAmount && simulAmount > 0 ? Math.floor(Number(simulAmount) / credito.installment_value) : 0;

    return createPortal(
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface shadow-2xl z-[9999] transform transition-transform animate-slide-left flex flex-col border-l border-subtle">
            <div className="px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                <div>
                    <h2 className="text-[16px] font-bold text-main tracking-tight">Detalhes do Crédito</h2>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mt-0.5">Visão 360 e Simulação</p>
                </div>
                <button onClick={onClose} className="p-2 text-faint hover:text-muted hover:bg-surface-3 rounded-full transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {/* Header Info */}
                <div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[20px] font-bold text-main tracking-tight leading-none">{credito.debt_label}</h3>
                        <div className="bg-surface-2 text-muted text-[10px] font-bold px-2 py-1 rounded-[6px] uppercase tracking-wider">{credito.debt_type}</div>
                    </div>
                    <p className="text-[12px] text-muted font-bold uppercase tracking-wider mt-1">{credito.institution}</p>
                </div>

                {/* KPI Bar */}
                <div className="flex gap-4 p-4 bg-surface-2 rounded-xl border border-subtle">
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Risco DCMM</p>
                        <p className="text-[20px] font-bold text-main tracking-tight leading-none">{score.toFixed(0)} <span className="text-[10px] text-faint font-bold uppercase">/ 100</span></p>
                    </div>
                    <div className="w-[1px] bg-surface-3"></div>
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Comprometimento</p>
                        <p className={`text-[20px] font-bold tracking-tight leading-none ${credito.income_commitment > 30 ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {Number(credito.income_commitment).toFixed(1)}%
                        </p>
                    </div>
                </div>

                {/* Alertas Ativos */}
                {alertas.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-faint uppercase tracking-wider">Alertas Ativos</h4>
                        {alertas.map(a => (
                            <div key={a.id} className={`p-3 rounded-[8px] border flex gap-3 ${a.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                                a.severity === 'WARNING' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                    'bg-sky-50 border-sky-100 text-sky-700'
                                }`}>
                                <div className="mt-0.5">
                                    {a.severity === 'CRITICAL' ? <AlertTriangle size={14} /> :
                                        a.severity === 'WARNING' ? <AlertCircle size={14} /> :
                                            <Info size={14} />}
                                </div>
                                <p className="text-[11px] font-medium">{a.message}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Detalhes Financeiros */}
                <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-faint uppercase tracking-wider border-b border-subtle pb-2">Dados Contratuais</h4>
                    <div className="grid grid-cols-2 gap-y-4">
                        <div>
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Saldo Devedor</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">R$ {Number(credito.outstanding_balance).toLocaleString('pt-BR')}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Parcela</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">R$ {Number(credito.installment_value).toLocaleString('pt-BR')}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">CET (Mensal / Anual)</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">{Number(credito.cet_monthly).toFixed(2)}% <span className="text-[10px] text-faint font-bold uppercase tracking-wider">/ {Number(credito.cet_annual).toFixed(2)}%</span></p>
                        </div>
                        <div>
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Prazo Restante</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">{credito.remaining_installments} <span className="text-[10px] text-faint font-bold uppercase tracking-wider">de {credito.total_installments} meses</span></p>
                        </div>
                    </div>
                </div>

                {/* Simulador de Amortização (Layer 3.4) */}
                <div className="bg-surface-3 rounded-xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-4">
                        <Calculator size={16} className="text-indigo-400" />
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-faint">Simulador de Amortização</h4>
                    </div>
                    <div className="mb-4">
                        <label className="block text-[10px] font-bold text-faint uppercase tracking-wider mb-2">Aporte Extraordinário (R$)</label>
                        <input
                            type="number"
                            className="w-full bg-strong border border-strong rounded-[8px] px-3 h-9 text-[12px] text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-muted"
                            placeholder="Valor para simular"
                            value={simulAmount}
                            onChange={(e) => setSimulAmount(Number(e.target.value))}
                        />
                    </div>
                    {simulAmount !== '' && simulAmount > 0 && (
                        <div className="bg-strong rounded-[8px] p-4 border border-strong mt-2">
                            <h5 className="text-[10px] font-bold text-faint mb-3 tracking-wider uppercase">Projeção de Economia</h5>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] text-faint">Tempo reduzido aprox.</span>
                                    <span className="text-[12px] font-bold text-emerald-400">-{installmentsReduced} meses</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] text-faint">Juros economizados (ref. mês)</span>
                                    <span className="text-[12px] font-bold text-emerald-400">+ R$ {savings.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-6 py-4 border-t border-subtle flex justify-between gap-3 bg-surface-2">
                <Button variant="outline" onClick={() => onDelete(credito.debt_id as string)} className="text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-200 h-9 px-4 text-[11px] font-bold uppercase tracking-wider">
                    <Trash2 size={14} className="mr-1.5" /> Excluir
                </Button>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => onEdit(credito)} className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider">
                        <Edit2 size={14} className="mr-1.5" /> Editar Dados
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PanelDetalheCredito;
