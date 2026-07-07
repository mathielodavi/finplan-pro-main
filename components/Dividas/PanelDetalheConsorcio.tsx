import React, { useState } from 'react';
import { Edit2, Calculator, AlertTriangle, AlertCircle, Info, Trash2 } from 'lucide-react';
import { DividaConsorcio } from '../../types/dividas';
import { calcularRiskScoreConsorcioCompleto, calcularCustoEmbutidoTotal, calcularCustoRealMensal, calcularProbabilidadeContemplacao, formatarContemplationStatus } from '../../utils/calculosDividas';
import { alertasDividaService, AlertSeverity } from '../../services/alertasDividasService';
import Button from '../UI/Button';
import Badge from '../UI/Badge';
import SidePanel from '../UI/SidePanel';

interface Props {
    open: boolean;
    onClose: () => void;
    consorcio: DividaConsorcio | null;
    onEdit: (cons: DividaConsorcio) => void;
    onDelete: (id: string) => void;
    rendaMensalCliente: number;
}

const variantePorSeveridade: Record<AlertSeverity, 'danger' | 'warning' | 'info'> = {
    CRITICAL: 'danger',
    WARNING: 'warning',
    INFO: 'info',
};

const iconePorSeveridade: Record<AlertSeverity, React.ReactNode> = {
    CRITICAL: <AlertTriangle size={14} />,
    WARNING: <AlertCircle size={14} />,
    INFO: <Info size={14} />,
};

const variantePorProbabilidade: Record<'HIGH' | 'MEDIUM' | 'LOW', 'success' | 'warning' | 'danger'> = {
    HIGH: 'success',
    MEDIUM: 'warning',
    LOW: 'danger',
};

const PanelDetalheConsorcio: React.FC<Props> = ({ open, onClose, consorcio, onEdit, onDelete, rendaMensalCliente }) => {
    const [simulAmount, setSimulAmount] = useState<number | ''>('');

    if (!consorcio) return null;

    const alertas = alertasDividaService.gerarAlertasConsorcio(consorcio);
    const score = calcularRiskScoreConsorcioCompleto(consorcio, rendaMensalCliente);
    const custoEmbutido = calcularCustoEmbutidoTotal(consorcio);
    const custoRealMensal = calcularCustoRealMensal(consorcio);
    const probabilidade = calcularProbabilidadeContemplacao(consorcio);

    // Simulador de Lance
    const bidPct = simulAmount && simulAmount > 0 ? (Number(simulAmount) / consorcio.credit_letter_value) * 100 : 0;
    let bidChanceIncrease = 'Baixo incremento';
    let chanceVariant: 'success' | 'warning' | 'neutral' = 'neutral';
    if (bidPct > 35) {
        bidChanceIncrease = 'Alto indício de lance vencedor (requer histórico do grupo)';
        chanceVariant = 'success';
    } else if (bidPct > 20) {
        bidChanceIncrease = 'Concorrência intermediária';
        chanceVariant = 'warning';
    }

    return (
        <SidePanel
            open={open}
            onClose={onClose}
            title="Detalhes do Consórcio"
            subtitle="Visão geral e simulação de lance"
            widthClass="max-w-md"
            footer={
                <div className="flex justify-between gap-3">
                    <Button variant="outline" onClick={() => onDelete(consorcio.consortium_id as string)} className="text-danger hover:bg-danger/10 border-transparent hover:border-danger/30 h-9 px-4 text-[11px] font-bold uppercase tracking-wider">
                        <Trash2 size={14} className="mr-1.5" /> Excluir
                    </Button>
                    <Button variant="outline" onClick={() => onEdit(consorcio)} className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider">
                        <Edit2 size={14} className="mr-1.5" /> Editar Dados
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                {/* Header Info */}
                <div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[20px] font-bold text-main tracking-tight leading-none">{consorcio.consortium_label}</h3>
                        <Badge variant="info" size="sm">{consorcio.asset_type}</Badge>
                    </div>
                    <p className="text-[12px] text-muted font-bold uppercase tracking-wider mt-1">Administradora: {consorcio.administrator}</p>
                </div>

                {/* KPI Bar */}
                <div className="flex gap-4 p-4 bg-surface-2 rounded-xl border border-subtle">
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Score de Risco</p>
                        <p className="text-[20px] font-bold text-main tracking-tight leading-none">{score.toFixed(0)} <span className="text-[10px] text-faint font-bold uppercase">/ 100</span></p>
                    </div>
                    <div className="w-[1px] bg-surface-3"></div>
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Probabilidade</p>
                        <Badge variant={variantePorProbabilidade[probabilidade]} size="sm">{probabilidade}</Badge>
                    </div>
                </div>

                {/* Alertas Ativos */}
                {alertas.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-faint uppercase tracking-wider">Alertas Ativos</h4>
                        {alertas.map(a => (
                            <div key={a.id} className="p-3 rounded-[8px] border border-subtle bg-surface-2 flex gap-3">
                                <div className={`mt-0.5 ${a.severity === 'CRITICAL' ? 'text-danger' : a.severity === 'WARNING' ? 'text-warning' : 'text-info'}`}>
                                    {iconePorSeveridade[a.severity]}
                                </div>
                                <p className="text-[11px] font-medium text-main flex-1">{a.message}</p>
                                <Badge variant={variantePorSeveridade[a.severity]} size="sm">{a.severity}</Badge>
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
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Custo Real Mensal</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">{custoRealMensal > 0 ? `R$ ${custoRealMensal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` : '—'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Total Pago (Equidade)</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">R$ {Number(consorcio.total_paid_to_date).toLocaleString('pt-BR')}</p>
                        </div>
                        <div className="col-span-2">
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Status e Estratégia Atuais</p>
                            <div className="flex gap-2 mt-1 flex-wrap">
                                <Badge variant={consorcio.contemplation_status.startsWith('contemplated') ? 'success' : 'neutral'} size="sm">
                                    {formatarContemplationStatus(consorcio.contemplation_status)}
                                </Badge>
                                <Badge variant="info" size="sm">{consorcio.bid_strategy.replace(/_/g, ' ')}</Badge>
                            </div>
                            <div className="flex gap-2 mt-2 flex-wrap">
                                {consorcio.fgts_eligible && <Badge variant="success" size="sm">FGTS Elegível</Badge>}
                                {consorcio.asset_released && <Badge variant="info" size="sm">Bem Adquirido</Badge>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Simulador de Lance */}
                <div className="bg-surface-2 rounded-xl p-5 border border-subtle">
                    <div className="flex items-center gap-2 mb-4">
                        <Calculator size={16} className="text-primary" />
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-faint">Simulador de Lance</h4>
                    </div>
                    <div className="mb-4">
                        <label className="block text-[10px] font-bold text-faint uppercase tracking-wider mb-2">Valor Estimado de Lance (R$)</label>
                        <input
                            type="number"
                            className="w-full bg-surface border border-subtle rounded-[8px] px-3 h-9 text-[12px] text-main focus:outline-none focus:border-primary transition-colors placeholder:text-faint"
                            placeholder="Qual valor ofertará?"
                            value={simulAmount}
                            onChange={(e) => setSimulAmount(Number(e.target.value))}
                        />
                    </div>
                    {simulAmount !== '' && simulAmount > 0 && (
                        <div className="bg-surface rounded-[8px] p-4 border border-subtle mt-2">
                            <h5 className="text-[10px] font-bold text-faint mb-3 tracking-wider uppercase">Análise do Lance</h5>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] text-muted">Percentual da Carta</span>
                                    <span className="text-[12px] font-bold text-primary">{bidPct.toFixed(2)}%</span>
                                </div>
                                <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-subtle">
                                    <span className="text-[10px] text-faint uppercase tracking-wider font-bold">Indicador qualitativo (heurística, sem histórico do grupo)</span>
                                    <Badge variant={chanceVariant} size="sm">{bidChanceIncrease}</Badge>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </SidePanel>
    );
};

export default PanelDetalheConsorcio;
