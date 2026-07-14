import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DividaCredito, DividaConsorcio, PrioritizationMethod } from '../../types/dividas';
import { dividasService } from '../../services/dividasService';
import { selicService } from '../../services/selicService';
import DashboardDividas from './DashboardDividas';
import ListaDividas from './ListaDividas';
import { ordenarAvalanche, ordenarSnowball, ordenarConsorcios } from '../../utils/ordenacaoDividas';
import { simularQuitacaoCarteira } from '../../utils/calculosDividas';
import { CHART_COLORS, CHART_GRID, axisTick, tooltipStyle, tooltipCursor } from '../../utils/chartTheme';
import { formatarMoeda } from '../../utils/formatadores';
import Button from '../UI/Button';
import InputMoeda from '../UI/InputMoeda';
import { Plus, FileDigit, TrendingDown } from 'lucide-react';
import ModalFormCredito from './ModalFormCredito';
import ModalFormConsorcio from './ModalFormConsorcio';
import PanelDetalheCredito from './PanelDetalheCredito';
import PanelDetalheConsorcio from './PanelDetalheConsorcio';
import Confirmacao from '../Confirmacao';
import { toast } from '../../utils/toast';

interface Props {
    clienteId: string;
    rendaMensalCliente?: number;
}

const segBtn = (active: boolean) =>
    `px-4 h-full rounded-[6px] text-[10px] font-bold uppercase tracking-wider transition-all flex items-center ${active ? 'bg-surface text-primary border border-subtle' : 'text-faint hover:text-muted'}`;

const AbaDividas: React.FC<Props> = ({ clienteId, rendaMensalCliente = 10000 }) => {
    const [creditos, setCreditos] = useState<DividaCredito[]>([]);
    const [consorcios, setConsorcios] = useState<DividaConsorcio[]>([]);
    const [prioritizationMethod, setPrioritizationMethod] = useState<PrioritizationMethod>('avalanche');
    const [loading, setLoading] = useState(true);

    const [showOptionsNovo, setShowOptionsNovo] = useState(false);
    const [modalCreditoOpen, setModalCreditoOpen] = useState(false);
    const [modalConsorcioOpen, setModalConsorcioOpen] = useState(false);
    const [editingCredito, setEditingCredito] = useState<DividaCredito | null>(null);
    const [editingConsorcio, setEditingConsorcio] = useState<DividaConsorcio | null>(null);

    const [selectedCredito, setSelectedCredito] = useState<DividaCredito | null>(null);
    const [selectedConsorcio, setSelectedConsorcio] = useState<DividaConsorcio | null>(null);
    const [excluirAlvo, setExcluirAlvo] = useState<{ tipo: 'credito' | 'consorcio'; id: string } | null>(null);
    const [excluindoDivida, setExcluindoDivida] = useState(false);

    const [aporteExtraSimulacao, setAporteExtraSimulacao] = useState<number | ''>('');
    const [selicAnual, setSelicAnual] = useState(10.5);

    useEffect(() => {
        selicService.getSelicAnual().then(setSelicAnual).catch(() => {});
    }, []);

    const loadDados = useCallback(async () => {
        setLoading(true);
        try {
            const [metodo, crData, coData] = await Promise.all([
                dividasService.getPrioritizationMethod(clienteId),
                dividasService.getCreditos(clienteId),
                dividasService.getConsorcios(clienteId)
            ]);

            setPrioritizationMethod(metodo);
            setCreditos(crData);
            setConsorcios(coData);
        } catch (err) {
            console.error('Erro ao carregar dívidas do cliente', err);
        } finally {
            setLoading(false);
        }
    }, [clienteId]);

    useEffect(() => {
        loadDados();
    }, [loadDados]);

    const handleMethodChange = async (method: PrioritizationMethod) => {
        setPrioritizationMethod(method);
        await dividasService.updatePrioritizationMethod(clienteId, method);
    };

    const sortedCreditos = prioritizationMethod === 'avalanche'
        ? ordenarAvalanche(creditos)
        : ordenarSnowball(creditos);

    const sortedConsorcios = ordenarConsorcios(consorcios, prioritizationMethod);

    const handleSaveCredito = async (credito: Partial<DividaCredito>) => {
        try {
            if (editingCredito?.debt_id) {
                await dividasService.updateCredito(editingCredito.debt_id, credito);
            } else {
                await dividasService.createCredito(credito as Omit<DividaCredito, 'debt_id'>);
            }
            setModalCreditoOpen(false);
            setEditingCredito(null);
            loadDados();
        } catch (err) {
            toast.error('Erro ao salvar crédito');
        }
    };

    const handleSaveConsorcio = async (consorcio: Partial<DividaConsorcio>) => {
        try {
            if (editingConsorcio?.consortium_id) {
                await dividasService.updateConsorcio(editingConsorcio.consortium_id, consorcio);
            } else {
                await dividasService.createConsorcio(consorcio as Omit<DividaConsorcio, 'consortium_id'>);
            }
            setModalConsorcioOpen(false);
            setEditingConsorcio(null);
            loadDados();
        } catch (err) {
            toast.error('Erro ao salvar consórcio');
        }
    };

    const handleDeleteCredito = (id: string) => setExcluirAlvo({ tipo: 'credito', id });
    const handleDeleteConsorcio = (id: string) => setExcluirAlvo({ tipo: 'consorcio', id });

    const confirmarExclusaoDivida = async () => {
        if (!excluirAlvo) return;
        setExcluindoDivida(true);
        try {
            if (excluirAlvo.tipo === 'credito') {
                await dividasService.deleteCredito(excluirAlvo.id);
                setSelectedCredito(null);
            } else {
                await dividasService.deleteConsorcio(excluirAlvo.id);
                setSelectedConsorcio(null);
            }
            setExcluirAlvo(null);
            loadDados();
        } catch {
            toast.error('Erro ao excluir.');
        } finally {
            setExcluindoDivida(false);
        }
    };

    // Simulação de quitação agregada da carteira (créditos), comparando Avalanche vs Snowball
    // para o mesmo aporte extra mensal informado.
    const quitacaoCarteira = useMemo(() => {
        const aporte = Number(aporteExtraSimulacao) || 0;
        if (creditos.length === 0) return null;

        const ordemAvalanche = ordenarAvalanche(creditos);
        const ordemSnowball = ordenarSnowball(creditos);
        // Quando a taxa e o saldo decrescem na mesma sequência entre as dívidas, as duas
        // estratégias produzem literalmente a mesma ordem de prioridade — nesse caso a
        // simulação É idêntica para qualquer aporte extra, por construção matemática (não é bug).
        const ordensIdenticas = ordemAvalanche.length > 1 && ordemAvalanche.every((d, i) => d.debt_id === ordemSnowball[i].debt_id);

        const resultadoAvalanche = simularQuitacaoCarteira(ordemAvalanche, aporte);
        const resultadoSnowball = simularQuitacaoCarteira(ordemSnowball, aporte);
        const mesesMax = Math.max(resultadoAvalanche.serie.length, resultadoSnowball.serie.length, 1);
        const serie = Array.from({ length: mesesMax }, (_, i) => ({
            mes: i + 1,
            avalanche: resultadoAvalanche.serie[i]?.saldoTotal ?? 0,
            snowball: resultadoSnowball.serie[i]?.saldoTotal ?? 0,
        }));

        return { resultadoAvalanche, resultadoSnowball, serie, ordensIdenticas, ordemPrioridade: ordemAvalanche.map(d => d.debt_label) };
    }, [creditos, aporteExtraSimulacao]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-40 gap-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[color:var(--primary)]"></div>
                <p className="text-faint font-bold uppercase tracking-[0.2em] text-[10px]">Carregando dívidas...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in relative">

            {/* Header / Ações */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface px-5 py-4 rounded-xl border border-subtle">
                <div>
                    <h2 className="text-[16px] font-bold text-main tracking-tight">Gestão de Passivos e Consórcios</h2>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mt-0.5">Central de dívidas e simulações de melhoria</p>
                </div>

                <div className="flex gap-3">
                    <div className="flex bg-surface-2 p-1 rounded-[8px] border border-subtle h-9">
                        <button
                            className={segBtn(prioritizationMethod === 'avalanche')}
                            onClick={() => handleMethodChange('avalanche')}
                            title="Avalanche: foca em quitar as dívidas com maiores taxas antes"
                        >
                            Avalanche
                        </button>
                        <button
                            className={segBtn(prioritizationMethod === 'snowball')}
                            onClick={() => handleMethodChange('snowball')}
                            title="Snowball: foca em quitar as dívidas com menores saldos antes (motivacional)"
                        >
                            Snowball
                        </button>
                    </div>

                    <div className="relative">
                        <Button
                            variant="primary"
                            className="text-[10px] px-4 font-bold tracking-wider uppercase gap-2 h-9"
                            onClick={() => setShowOptionsNovo(!showOptionsNovo)}
                        >
                            <Plus size={14} />
                            Novo Registro
                        </Button>

                        {showOptionsNovo && (
                            <div className="absolute right-0 top-full mt-2 bg-surface rounded-xl shadow-[var(--shadow-float)] border border-subtle p-2 w-48 z-10 flex flex-col gap-1">
                                <button
                                    className="flex items-center justify-start gap-3 w-full text-left px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-muted hover:bg-surface-2 rounded-lg transition-colors"
                                    onClick={() => { setEditingCredito(null); setModalCreditoOpen(true); setShowOptionsNovo(false); }}
                                >
                                    <FileDigit size={14} className="text-primary" />
                                    Crédito Simples
                                </button>
                                <button
                                    className="flex items-center justify-start gap-3 w-full text-left px-3 py-2 text-[10px] font-bold tracking-widest uppercase text-muted hover:bg-surface-2 rounded-lg transition-colors"
                                    onClick={() => { setEditingConsorcio(null); setModalConsorcioOpen(true); setShowOptionsNovo(false); }}
                                >
                                    <FileDigit size={14} className="text-info" />
                                    Consórcio
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <DashboardDividas
                creditos={sortedCreditos}
                consorcios={sortedConsorcios}
                rendaMensalCliente={rendaMensalCliente}
                selicAnual={selicAnual}
            />

            <ListaDividas
                creditos={sortedCreditos}
                consorcios={sortedConsorcios}
                prioritizationMethod={prioritizationMethod}
                rendaMensalCliente={rendaMensalCliente}
                selicAnual={selicAnual}
                onSelectCredito={(cred) => setSelectedCredito(cred)}
                onSelectConsorcio={(cons) => setSelectedConsorcio(cons)}
            />

            {/* Simulação de quitação agregada da carteira */}
            {creditos.length > 0 && (
                <div className="bg-surface rounded-xl border border-subtle overflow-hidden">
                    <div className="px-5 py-4 border-b border-subtle flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-surface-2/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 text-primary rounded-[8px]"><TrendingDown size={16} /></div>
                            <div>
                                <h3 className="text-[13px] font-bold text-main tracking-tight">Simulação de Quitação da Carteira</h3>
                                <p className="text-[10px] text-muted uppercase tracking-wider font-bold mt-0.5">Avalanche vs Snowball com o mesmo aporte extra mensal — a lista acima já está ordenada pelo método selecionado ({prioritizationMethod === 'avalanche' ? 'Avalanche' : 'Snowball'})</p>
                            </div>
                        </div>
                        <div className="w-40">
                            <InputMoeda
                                label="Aporte Extra Mensal"
                                value={aporteExtraSimulacao === '' ? 0 : aporteExtraSimulacao}
                                onChange={(v) => setAporteExtraSimulacao(v)}
                            />
                        </div>
                    </div>

                    {quitacaoCarteira && (
                        <div className="p-5 space-y-5">
                            <div className="h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={quitacaoCarteira.serie} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                                        <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(v) => `${v}m`} />
                                        <YAxis hide domain={[0, 'dataMax']} />
                                        <Tooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={(v: any) => formatarMoeda(Number(v))} labelFormatter={(v) => `Mês ${v}`} />
                                        <Legend />
                                        <Area
                                            type="monotone" dataKey="avalanche" name={`Avalanche${prioritizationMethod === 'avalanche' ? ' (selecionado)' : ''}`}
                                            stroke={CHART_COLORS.danger} fill={CHART_COLORS.danger}
                                            fillOpacity={prioritizationMethod === 'avalanche' ? 0.22 : 0.06}
                                            strokeWidth={prioritizationMethod === 'avalanche' ? 3 : 1.5}
                                            strokeDasharray={prioritizationMethod === 'avalanche' ? undefined : '4 3'}
                                        />
                                        <Area
                                            type="monotone" dataKey="snowball" name={`Snowball${prioritizationMethod === 'snowball' ? ' (selecionado)' : ''}`}
                                            stroke={CHART_COLORS.info} fill={CHART_COLORS.info}
                                            fillOpacity={prioritizationMethod === 'snowball' ? 0.22 : 0.06}
                                            strokeWidth={prioritizationMethod === 'snowball' ? 3 : 1.5}
                                            strokeDasharray={prioritizationMethod === 'snowball' ? undefined : '4 3'}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-surface-2 rounded-[8px] p-4 border border-subtle">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-danger mb-2">Avalanche</p>
                                    <p className="text-[13px] font-bold text-main">{quitacaoCarteira.resultadoAvalanche.meses} meses até a quitação total</p>
                                    <p className="text-[11px] text-muted mt-1">Juros totais pagos: {formatarMoeda(quitacaoCarteira.resultadoAvalanche.jurosTotaisPagos)}</p>
                                </div>
                                <div className="bg-surface-2 rounded-[8px] p-4 border border-subtle">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-info mb-2">Snowball</p>
                                    <p className="text-[13px] font-bold text-main">{quitacaoCarteira.resultadoSnowball.meses} meses até a quitação total</p>
                                    <p className="text-[11px] text-muted mt-1">Juros totais pagos: {formatarMoeda(quitacaoCarteira.resultadoSnowball.jurosTotaisPagos)}</p>
                                </div>
                            </div>

                            {quitacaoCarteira.ordensIdenticas ? (
                                <p className="text-[11px] text-faint">
                                    Para esta carteira, as duas estratégias chegam à mesma ordem de prioridade — <span className="text-main font-semibold">{quitacaoCarteira.ordemPrioridade.join(' → ')}</span> —, ou seja, a dívida de maior taxa também é a de menor saldo (e assim por diante). Por isso os resultados de Avalanche e Snowball coincidem para qualquer aporte extra: não há divergência a mostrar aqui, não é uma limitação da simulação.
                                </p>
                            ) : (
                                <p className="text-[11px] text-faint">
                                    {quitacaoCarteira.resultadoAvalanche.jurosTotaisPagos < quitacaoCarteira.resultadoSnowball.jurosTotaisPagos
                                        ? `Escolher Avalanche economiza ${formatarMoeda(quitacaoCarteira.resultadoSnowball.jurosTotaisPagos - quitacaoCarteira.resultadoAvalanche.jurosTotaisPagos)} em juros comparado ao Snowball, para o mesmo aporte extra.`
                                        : quitacaoCarteira.resultadoSnowball.jurosTotaisPagos < quitacaoCarteira.resultadoAvalanche.jurosTotaisPagos
                                            ? `Escolher Snowball economiza ${formatarMoeda(quitacaoCarteira.resultadoAvalanche.jurosTotaisPagos - quitacaoCarteira.resultadoSnowball.jurosTotaisPagos)} em juros comparado ao Avalanche, para o mesmo aporte extra.`
                                            : (Number(aporteExtraSimulacao) || 0) === 0
                                                ? 'Sem aporte extra mensal, os dois métodos pagam apenas os mínimos e resultam no mesmo total de meses e juros — a diferença entre Avalanche e Snowball só aparece a partir de um aporte extra, pela ordem em que cada dívida é priorizada. Informe um valor acima para ver o impacto.'
                                                : 'Os dois métodos resultam no mesmo total de juros pagos para este aporte extra (pode ocorrer quando há poucas dívidas ou saldos/taxas muito próximos entre elas).'}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            <ModalFormCredito
                open={modalCreditoOpen}
                onClose={() => { setModalCreditoOpen(false); setEditingCredito(null); }}
                onSave={handleSaveCredito}
                initialData={editingCredito}
                clienteId={clienteId}
            />

            <ModalFormConsorcio
                open={modalConsorcioOpen}
                onClose={() => { setModalConsorcioOpen(false); setEditingConsorcio(null); }}
                onSave={handleSaveConsorcio}
                initialData={editingConsorcio}
                clienteId={clienteId}
            />

            <PanelDetalheCredito
                open={!!selectedCredito}
                onClose={() => setSelectedCredito(null)}
                credito={selectedCredito}
                selicAnual={selicAnual}
                onDelete={handleDeleteCredito}
                onEdit={(c) => {
                    setSelectedCredito(null);
                    setEditingCredito(c);
                    setModalCreditoOpen(true);
                }}
            />

            <PanelDetalheConsorcio
                open={!!selectedConsorcio}
                onClose={() => setSelectedConsorcio(null)}
                consorcio={selectedConsorcio}
                onDelete={handleDeleteConsorcio}
                rendaMensalCliente={rendaMensalCliente}
                onEdit={(c) => {
                    setSelectedConsorcio(null);
                    setEditingConsorcio(c);
                    setModalConsorcioOpen(true);
                }}
            />

            <Confirmacao
                isOpen={!!excluirAlvo}
                onClose={() => setExcluirAlvo(null)}
                onConfirm={confirmarExclusaoDivida}
                loading={excluindoDivida}
                title={excluirAlvo?.tipo === 'consorcio' ? 'Excluir consórcio' : 'Excluir dívida de crédito'}
                message={excluirAlvo?.tipo === 'consorcio' ? 'Deseja realmente excluir este consórcio?' : 'Deseja realmente excluir esta dívida de crédito?'}
            />

        </div>
    );
};

export default AbaDividas;
