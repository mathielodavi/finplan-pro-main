import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit2, Calculator, AlertTriangle, AlertCircle, Info, Trash2 } from 'lucide-react';
import { DividaConsorcio } from '../../types/dividas';
import { calcularRiskScoreConsorcio, calcularCustoEmbutidoTotal, calcularProbabilidadeContemplacao } from '../../utils/calculosDividas';
import { alertasDividaService } from '../../services/alertasDividasService';
import Button from '../UI/Button';

interface Props {
    open: boolean;
    onClose: () => void;
    consorcio: DividaConsorcio | null;
    onEdit: (cons: DividaConsorcio) => void;
    onDelete: (id: string) => void;
    rendaMensalCliente: number;
}

const PanelDetalheConsorcio: React.FC<Props> = ({ open, onClose, consorcio, onEdit, onDelete, rendaMensalCliente }) => {
    const [simulAmount, setSimulAmount] = useState<number | ''>('');

    if (!open || !consorcio) return null;

    const alertas = alertasDividaService.gerarAlertasConsorcio(consorcio);

    // Calcula o Risco incorporando a Renda do wrapper (Layer 2 Wrapper)
    const incNorm = rendaMensalCliente > 0 ? ((consorcio.current_installment_value / rendaMensalCliente) * 100 / 35) * 100 : 0;
    let finalInc = incNorm > 100 ? 100 : incNorm;
    const scoreBase = calcularRiskScoreConsorcio(consorcio);
    const score = scoreBase + (finalInc * 0.30);

    const custoEmbutido = calcularCustoEmbutidoTotal(consorcio);
    const probabilidade = calcularProbabilidadeContemplacao(consorcio);

    // Simulador de Lance (Consortium Bid Simulator - Layer 3.5)
    const bidPct = simulAmount && simulAmount > 0 ? (Number(simulAmount) / consorcio.credit_letter_value) * 100 : 0;
    let bidChanceIncrease = 'Baixo Incremento';
    let chanceColor = 'text-faint';
    if (bidPct > 35) {
        bidChanceIncrease = 'Alto Indício de Lances Vencedores (Requer Histórico)';
        chanceColor = 'text-emerald-400';
    } else if (bidPct > 20) {
        bidChanceIncrease = 'Média Concorrência (Lance Intermediário)';
        chanceColor = 'text-amber-400';
    }

    return createPortal(
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-surface shadow-2xl z-[9999] transform transition-transform animate-slide-left flex flex-col border-l border-subtle">
            <div className="px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2">
                <div>
                    <h2 className="text-[16px] font-bold text-main tracking-tight">Detalhes do Consórcio</h2>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mt-0.5">Visão 360 e Simulação de Lance</p>
                </div>
                <button onClick={onClose} className="p-2 text-faint hover:text-muted hover:bg-surface-3 rounded-full transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {/* Header Info */}
                <div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[20px] font-bold text-main tracking-tight leading-none">{consorcio.consortium_label}</h3>
                        <div className="bg-sky-100 text-sky-700 text-[10px] font-bold px-2 py-1 rounded-[6px] uppercase tracking-wider">{consorcio.asset_type}</div>
                    </div>
                    <p className="text-[12px] text-muted font-bold uppercase tracking-wider mt-1">Administradora: {consorcio.administrator}</p>
                </div>

                {/* KPI Bar */}
                <div className="flex gap-4 p-4 bg-surface-2 rounded-xl border border-subtle">
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Risco DCMM</p>
                        <p className="text-[20px] font-bold text-main tracking-tight leading-none">{score.toFixed(0)} <span className="text-[10px] text-faint font-bold uppercase">/ 100</span></p>
                    </div>
                    <div className="w-[1px] bg-surface-3"></div>
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Probabilidade</p>
                        <p className={`text-[20px] font-bold tracking-tight leading-none ${probabilidade === 'HIGH' ? 'text-emerald-500' : probabilidade === 'MEDIUM' ? 'text-amber-500' : 'text-rose-500'}`}>
                            {probabilidade}
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
                    <h4 className="text-[10px] font-bold text-faint uppercase tracking-wider border-b border-subtle pb-2">Dados do Grupo e Contrato</h4>
                    <div className="grid grid-cols-2 gap-y-4">
                        <div>
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Carta de Crédito</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">R$ {Number(consorcio.credit_letter_value).toLocaleString('pt-BR')}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Parcela Mensal</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">R$ {Number(consorcio.current_installment_value).toLocaleString('pt-BR')}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Custo Embutido Projetado</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">{custoEmbutido.toFixed(2)}%</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Total Pago (Equidade)</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">R$ {Number(consorcio.total_paid_to_date).toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Status e Estratégia Atuais</p>
                            <div className="flex gap-2 mt-1">
                                <span className={`px-2 py-1 rounded-[6px] text-[10px] font-bold tracking-wider ${consorcio.contemplation_status.startsWith('contemplated') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-surface-2 text-muted border border-subtle'}`}>
                                    {consorcio.contemplation_status.replace(/_/g, ' ')}
                                </span>
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-[6px] text-[10px] font-bold tracking-wider">
                                    {consorcio.bid_strategy.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <div className="flex gap-2 mt-2">
                                {consorcio.fgts_eligible && <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1 rounded-[6px] text-[9px] font-bold uppercase tracking-wider">FGTS Elegível</span>}
                                {consorcio.asset_released && <span className="bg-sky-50 text-sky-600 border border-sky-200 px-2 py-1 rounded-[6px] text-[9px] font-bold uppercase tracking-wider">Bem Adquirido</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Simulador de Lance (Layer 3.5) */}
                <div className="bg-surface-3 rounded-xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-4">
                        <Calculator size={16} className="text-sky-400" />
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-faint">Simulador de Lance</h4>
                    </div>
                    <div className="mb-4">
                        <label className="block text-[10px] font-bold text-faint uppercase tracking-wider mb-2">Valor Estimado de Lance (R$)</label>
                        <input
                            type="number"
                            className="w-full bg-strong border border-strong rounded-[8px] px-3 h-9 text-[12px] text-white focus:outline-none focus:border-sky-500 transition-colors placeholder:text-muted"
                            placeholder="Qual valor ofertará?"
                            value={simulAmount}
                            onChange={(e) => setSimulAmount(Number(e.target.value))}
                        />
                    </div>
                    {simulAmount !== '' && simulAmount > 0 && (
                        <div className="bg-strong rounded-[8px] p-4 border border-strong mt-2">
                            <h5 className="text-[10px] font-bold text-faint mb-3 tracking-wider uppercase">Análise do Lance</h5>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] text-faint">Percentual da Carta (%)</span>
                                    <span className="text-[12px] font-bold text-emerald-400">{bidPct.toFixed(2)}%</span>
                                </div>
                                <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-strong">
                                    <span className="text-[10px] text-muted uppercase tracking-wider font-bold mb-1">Indicador Predictivo de Contemplação</span>
                                    <span className={`text-[12px] font-bold ${chanceColor}`}>{bidChanceIncrease}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-6 py-4 border-t border-subtle flex justify-between gap-3 bg-surface-2">
                <Button variant="outline" onClick={() => onDelete(consorcio.consortium_id as string)} className="text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-200 h-9 px-4 text-[11px] font-bold uppercase tracking-wider">
                    <Trash2 size={14} className="mr-1.5" /> Excluir
                </Button>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => onEdit(consorcio)} className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider">
                        <Edit2 size={14} className="mr-1.5" /> Editar Dados
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PanelDetalheConsorcio;
