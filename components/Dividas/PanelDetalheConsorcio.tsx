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
    let chanceColor = 'text-slate-400';
    if (bidPct > 35) {
        bidChanceIncrease = 'Alto Indício de Lances Vencedores (Requer Histórico)';
        chanceColor = 'text-emerald-400';
    } else if (bidPct > 20) {
        bidChanceIncrease = 'Média Concorrência (Lance Intermediário)';
        chanceColor = 'text-amber-400';
    }

    return createPortal(
        <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-[9999] transform transition-transform animate-slide-left flex flex-col border-l border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 tracking-tight">Detalhes do Consórcio</h2>
                    <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-0.5">Visão 360 e Simulação de Lance</p>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {/* Header Info */}
                <div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-black text-slate-800">{consorcio.consortium_label}</h3>
                        <div className="bg-sky-100 text-sky-700 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">{consorcio.asset_type}</div>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Administradora: {consorcio.administrator}</p>
                </div>

                {/* KPI Bar */}
                <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Risco DCMM</p>
                        <p className="text-lg font-black text-slate-800">{score.toFixed(0)} <span className="text-[10px] text-slate-400 font-medium">/ 100</span></p>
                    </div>
                    <div className="w-[1px] bg-slate-200"></div>
                    <div className="flex-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Probabilidade</p>
                        <p className={`text-lg font-black ${probabilidade === 'HIGH' ? 'text-emerald-500' : probabilidade === 'MEDIUM' ? 'text-amber-500' : 'text-rose-500'}`}>
                            {probabilidade}
                        </p>
                    </div>
                </div>

                {/* Alertas Ativos */}
                {alertas.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alertas Ativos</h4>
                        {alertas.map(a => (
                            <div key={a.id} className={`p-3 rounded-xl border flex gap-3 ${a.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                                a.severity === 'WARNING' ? 'bg-amber-50 border-amber-100 text-amber-700' :
                                    'bg-sky-50 border-sky-100 text-sky-700'
                                }`}>
                                <div className="mt-0.5">
                                    {a.severity === 'CRITICAL' ? <AlertTriangle size={14} /> :
                                        a.severity === 'WARNING' ? <AlertCircle size={14} /> :
                                            <Info size={14} />}
                                </div>
                                <p className="text-xs font-medium">{a.message}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Detalhes Financeiros */}
                <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Dados do Grupo e Contrato</h4>
                    <div className="grid grid-cols-2 gap-y-4">
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Carta de Crédito</p>
                            <p className="text-sm font-semibold text-slate-700">R$ {Number(consorcio.credit_letter_value).toLocaleString('pt-BR')}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Parcela Mensal</p>
                            <p className="text-sm font-semibold text-slate-700">R$ {Number(consorcio.current_installment_value).toLocaleString('pt-BR')}</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Custo Embutido Projetado</p>
                            <p className="text-sm font-semibold text-slate-700">{custoEmbutido.toFixed(2)}%</p>
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Total Pago (Equidade)</p>
                            <p className="text-sm font-semibold text-slate-700">R$ {Number(consorcio.total_paid_to_date).toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Status e Estratégia Atuais</p>
                            <div className="flex gap-2 mt-1">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-widest ${consorcio.contemplation_status.startsWith('contemplated') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {consorcio.contemplation_status.replace(/_/g, ' ')}
                                </span>
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-[10px] font-bold tracking-widest">
                                    {consorcio.bid_strategy.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <div className="flex gap-2 mt-2">
                                {consorcio.fgts_eligible && <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest">FGTS Elegível</span>}
                                {consorcio.asset_released && <span className="bg-sky-50 text-sky-600 border border-sky-200 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest">Bem Adquirido</span>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Simulador de Lance (Layer 3.5) */}
                <div className="bg-slate-900 rounded-2xl p-5 text-white">
                    <div className="flex items-center gap-2 mb-4">
                        <Calculator size={16} className="text-sky-400" />
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-200">Simulador de Lance</h4>
                    </div>
                    <div className="mb-4">
                        <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-2">Valor Estimado de Lance (R$)</label>
                        <input
                            type="number"
                            className="w-full bg-slate-800 border fill-sky-500 border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-sky-500"
                            placeholder="Qual valor ofertará?"
                            value={simulAmount}
                            onChange={(e) => setSimulAmount(Number(e.target.value))}
                        />
                    </div>
                    {simulAmount !== '' && simulAmount > 0 && (
                        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mt-2">
                            <h5 className="text-[10px] font-bold text-slate-400 mb-3 tracking-widest uppercase">Análise do Lance</h5>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-300">Percentual da Carta (%)</span>
                                    <span className="text-sm font-bold text-emerald-400">{bidPct.toFixed(2)}%</span>
                                </div>
                                <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-700">
                                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Indicador Predictivo de Contemplação</span>
                                    <span className={`text-sm font-bold ${chanceColor}`}>{bidChanceIncrease}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-between gap-3 bg-slate-50">
                <Button variant="outline" onClick={() => onDelete(consorcio.consortium_id as string)} className="text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-200">
                    <Trash2 size={16} /> Excluir
                </Button>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => onEdit(consorcio)}>
                        <Edit2 size={16} className="mr-2" /> Editar Dados
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PanelDetalheConsorcio;
