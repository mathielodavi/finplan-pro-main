import React, { useState, useMemo } from 'react';
import { Edit2, Calculator, AlertTriangle, AlertCircle, Info, Trash2 } from 'lucide-react';
import { DividaCredito } from '../../types/dividas';
import { calcularRiskScoreCredito, simularAporteExtra, EstrategiaAporteExtra, calcularSpreadSobreSelic, calcularSaldoAtualEstimado, formatarDebtType } from '../../utils/calculosDividas';
import { alertasDividaService, AlertSeverity } from '../../services/alertasDividasService';
import Button from '../UI/Button';
import Badge from '../UI/Badge';
import SidePanel from '../UI/SidePanel';
import InputMoeda from '../UI/InputMoeda';

interface Props {
    open: boolean;
    onClose: () => void;
    credito: DividaCredito | null;
    selicAnual: number;
    onEdit: (cred: DividaCredito) => void;
    onDelete: (id: string) => void;
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

const PanelDetalheCredito: React.FC<Props> = ({ open, onClose, credito, selicAnual, onEdit, onDelete }) => {
    const [simulAmount, setSimulAmount] = useState<number | ''>('');
    const [estrategia, setEstrategia] = useState<EstrategiaAporteExtra>('reduzir_prazo');

    const alertas = credito ? alertasDividaService.gerarAlertasCredito(credito) : [];
    const score = credito ? calcularRiskScoreCredito(credito, selicAnual) : 0;
    const spreadSelic = credito ? calcularSpreadSobreSelic(credito, selicAnual) : 0;
    const saldoAtualEstimado = credito ? calcularSaldoAtualEstimado(credito) : null;

    const simulacao = useMemo(() => {
        if (!credito || !simulAmount || simulAmount <= 0) return null;
        return simularAporteExtra(credito, Number(simulAmount), estrategia);
    }, [credito, simulAmount, estrategia]);

    if (!credito) return null;

    return (
        <SidePanel
            open={open}
            onClose={onClose}
            title="Detalhes do Crédito"
            subtitle="Visão geral e simulação de amortização"
            widthClass="max-w-md"
            footer={
                <div className="flex justify-between gap-3">
                    <Button variant="outline" onClick={() => onDelete(credito.debt_id as string)} className="text-danger hover:bg-danger/10 border-transparent hover:border-danger/30 h-9 px-4 text-[11px] font-bold uppercase tracking-wider">
                        <Trash2 size={14} className="mr-1.5" /> Excluir
                    </Button>
                    <Button variant="outline" onClick={() => onEdit(credito)} className="h-9 px-4 text-[11px] font-bold uppercase tracking-wider">
                        <Edit2 size={14} className="mr-1.5" /> Editar Dados
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                {/* Header Info */}
                <div>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-[20px] font-bold text-main tracking-tight leading-none">{credito.debt_label}</h3>
                        <Badge variant="neutral" size="sm">{formatarDebtType(credito.debt_type)}</Badge>
                    </div>
                    <p className="text-[12px] text-muted font-bold uppercase tracking-wider mt-1">{credito.institution}</p>
                </div>

                {/* KPI Bar */}
                <div className="flex gap-4 p-4 bg-surface-2 rounded-xl border border-subtle">
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Score de Risco</p>
                        <p className="text-[20px] font-bold text-main tracking-tight leading-none">{score.toFixed(0)} <span className="text-[10px] text-faint font-bold uppercase">/ 100</span></p>
                    </div>
                    <div className="w-[1px] bg-surface-3"></div>
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Comprometimento</p>
                        <p className={`text-[20px] font-bold tracking-tight leading-none ${credito.income_commitment > 30 ? 'text-warning' : 'text-success'}`}>
                            {Number(credito.income_commitment).toFixed(1)}%
                        </p>
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
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Spread vs. Selic ({selicAnual.toFixed(2)}% a.a.)</p>
                            <p className={`text-[13px] font-bold mt-0.5 ${spreadSelic > 30 ? 'text-danger' : spreadSelic > 10 ? 'text-warning' : 'text-success'}`}>
                                {spreadSelic >= 0 ? '+' : ''}{spreadSelic.toFixed(1)}pp
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Prazo Restante</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">{credito.remaining_installments} <span className="text-[10px] text-faint font-bold uppercase tracking-wider">de {credito.total_installments} meses</span></p>
                        </div>
                        <div>
                            <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Sistema de Amortização</p>
                            <p className="text-[13px] font-bold text-main mt-0.5">{credito.amortization_system === 'sac' ? 'SAC' : 'Price'}</p>
                        </div>
                        {!!credito.monetary_correction_annual && (
                            <div>
                                <p className="text-[10px] text-faint uppercase tracking-wider font-bold">Correção Monetária</p>
                                <p className="text-[13px] font-bold text-main mt-0.5">{Number(credito.monetary_correction_annual).toFixed(2)}% a.a.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Saldo atual estimado (a partir da data de início do contrato) */}
                {saldoAtualEstimado && (
                    <div className={`rounded-[8px] p-4 border ${saldoAtualEstimado.divergente ? 'bg-warning/10 border-warning/30' : 'bg-surface-2 border-subtle'}`}>
                        <h4 className="text-[10px] font-bold text-faint uppercase tracking-wider mb-2">Saldo Estimado Hoje (pela data de início)</h4>
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[11px] text-muted">Saldo devedor estimado</span>
                            <span className="text-[12px] font-bold text-main">R$ {saldoAtualEstimado.saldoEstimado.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] text-muted">Parcelas restantes estimadas</span>
                            <span className="text-[12px] font-bold text-main">{saldoAtualEstimado.parcelasRestantesEstimadas}</span>
                        </div>
                        <p className="text-[9px] text-faint mt-2">
                            {saldoAtualEstimado.divergente
                                ? 'Diverge do valor cadastrado — considere atualizar o cadastro para refletir pagamentos reais (o valor oficial continua sendo o cadastrado manualmente).'
                                : 'Calculado a partir da data de início e do cronograma real de amortização — apenas informativo, não altera o cadastro.'}
                        </p>
                    </div>
                )}

                {/* Simulador de Amortização Real */}
                <div className="bg-surface-2 rounded-xl p-5 border border-subtle">
                    <div className="flex items-center gap-2 mb-4">
                        <Calculator size={16} className="text-primary" />
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-faint">Simulador de Amortização</h4>
                    </div>

                    <div className="mb-4">
                        <InputMoeda
                            label="Aporte Extraordinário (R$)"
                            value={simulAmount || 0}
                            onChange={(v) => setSimulAmount(v)}
                        />
                    </div>

                    <div className="flex bg-surface p-0.5 rounded-lg border border-subtle mb-2">
                        <button
                            onClick={() => setEstrategia('reduzir_prazo')}
                            className={`flex-1 px-3 h-8 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${estrategia === 'reduzir_prazo' ? 'bg-surface-3 text-primary' : 'text-faint hover:text-muted'}`}
                        >
                            Reduzir Prazo
                        </button>
                        <button
                            onClick={() => setEstrategia('reduzir_parcela')}
                            className={`flex-1 px-3 h-8 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${estrategia === 'reduzir_parcela' ? 'bg-surface-3 text-primary' : 'text-faint hover:text-muted'}`}
                        >
                            Reduzir Parcela
                        </button>
                    </div>

                    {simulacao && (
                        <div className="bg-surface rounded-[8px] p-4 border border-subtle mt-2">
                            <h5 className="text-[10px] font-bold text-faint mb-3 tracking-wider uppercase">Projeção Real de Amortização</h5>
                            <div className="space-y-3">
                                {estrategia === 'reduzir_prazo' ? (
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] text-muted">Prazo reduzido</span>
                                        <span className="text-[12px] font-bold text-primary">-{simulacao.mesesReduzidos} meses</span>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] text-muted">Nova parcela</span>
                                        <span className="text-[12px] font-bold text-primary">R$ {(simulacao.novaParcela || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] text-muted">Juros economizados (total do contrato)</span>
                                    <span className="text-[12px] font-bold text-primary">R$ {simulacao.jurosEconomizadosReais.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                            <p className="text-[9px] text-faint mt-3">Cálculo baseado no cronograma real de amortização ({credito.amortization_system === 'sac' ? 'SAC' : 'Price'}), não em estimativa linear.</p>
                        </div>
                    )}
                </div>
            </div>
        </SidePanel>
    );
};

export default PanelDetalheCredito;
