import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Split, Layers, Repeat, Plus, Trash2 } from 'lucide-react';
import SidePanel from '../UI/SidePanel';
import Button from '../UI/Button';
import Badge from '../UI/Badge';
import Confirmacao from '../Confirmacao';
import { formatarMoeda, formatarData } from '../../utils/formatadores';
import { Parcela } from '../../services/financeiroService';
import { ClienteResumo, SugestaoMatch } from '../../utils/matchingConciliacao';
import { conciliacaoOcrService, Frente, AlvoBaixa, LinhaConfirmacao } from '../../services/conciliacaoOcrService';

interface Props {
    open: boolean;
    onClose: () => void;
    onConcluido: () => void;
}

type Etapa = 'upload' | 'processando' | 'confirmacao';

interface LinhaEditavel extends SugestaoMatch {
    ignorada: boolean;
    // Parcelas a baixar por esta linha, cada uma com o valor rateado (Dividir/Agregar).
    alvos: AlvoBaixa[];
}

// Valor líquido esperado (pós-repasse) da parcela — é com ele que o valor extraído se relaciona.
const liquidoEsperado = (p: Parcela): number => p.valor_previsto * ((p.contratos?.repasse_percentual || 100) / 100);

const badgeConfianca = (s: LinhaEditavel) => {
    if (s.ignorada) return <Badge variant="neutral" size="sm">Ignorada</Badge>;
    if (s.alvos.length === 0) return <Badge variant="danger" size="sm">Sem correspondência</Badge>;
    if (s.alvos.length > 1) return <Badge variant="neutral" size="sm">{s.alvos.length} parcelas</Badge>;
    if (s.confianca === 'historico') return <Badge variant="success" size="sm">Alta (histórico)</Badge>;
    return <Badge variant="warning" size="sm">Média (nome)</Badge>;
};

const ConciliacaoOcrDrawer: React.FC<Props> = ({ open, onClose, onConcluido }) => {
    const [etapa, setEtapa] = useState<Etapa>('upload');
    const [frente, setFrente] = useState<Frente>('planejamento');
    const [arquivos, setArquivos] = useState<File[]>([]);
    const [erro, setErro] = useState<string | null>(null);
    const [processando, setProcessando] = useState(false);
    const [confirmando, setConfirmando] = useState(false);

    const [linhas, setLinhas] = useState<LinhaEditavel[]>([]);
    const [clientes, setClientes] = useState<ClienteResumo[]>([]);
    const [parcelasPorCliente, setParcelasPorCliente] = useState<Map<string, Parcela[]>>(new Map());

    // Alvo pendente de confirmação para "Replicar" (grava valor esperado nas parcelas seguintes).
    const [replicarAlvo, setReplicarAlvo] = useState<{ idx: number; alvoIdx: number } | null>(null);
    const [replicando, setReplicando] = useState(false);

    const resetar = () => {
        setEtapa('upload');
        setArquivos([]);
        setErro(null);
        setLinhas([]);
    };

    const fechar = () => {
        resetar();
        onClose();
    };

    const handleProcessar = async () => {
        if (arquivos.length === 0) return;
        setEtapa('processando');
        setErro(null);
        try {
            const { sugestoes, clientes: clientesCarregados, parcelasPorCliente: mapa } = await conciliacaoOcrService.processarArquivos(arquivos, frente);
            setClientes(clientesCarregados);
            setParcelasPorCliente(mapa);
            setLinhas(sugestoes.map(s => ({
                ...s,
                ignorada: !s.parcelaId,
                alvos: s.parcelaId ? [{ parcelaId: s.parcelaId, valorAlocado: s.linha.valor }] : [],
            })));
            setEtapa('confirmacao');
        } catch (err: any) {
            setErro(err?.message || 'Erro ao processar o(s) arquivo(s). Verifique o formato.');
            setEtapa('upload');
        }
    };

    const atualizarLinha = (idx: number, patch: Partial<LinhaEditavel>) => {
        setLinhas(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    };

    const parcelasDoCliente = (clienteId: string | null): Parcela[] => (clienteId ? (parcelasPorCliente.get(clienteId) || []) : []);
    const parcelaPorId = (clienteId: string | null, parcelaId: string): Parcela | undefined =>
        parcelasDoCliente(clienteId).find(p => p.id === parcelaId);

    // Rateia `total` entre as parcelas pela proporção do líquido esperado (fallback: partes iguais).
    // O ajuste de centavos vai na última parcela para fechar a soma exata.
    const ratearPorLiquido = (parcelas: Parcela[], total: number): number[] => {
        if (parcelas.length === 0) return [];
        const pesos = parcelas.map(liquidoEsperado);
        const soma = pesos.reduce((a, b) => a + b, 0);
        const base = pesos.map(p =>
            soma > 0 ? Math.round((total * p / soma) * 100) / 100 : Math.round((total / parcelas.length) * 100) / 100
        );
        const somaBase = base.reduce((a, b) => a + b, 0);
        base[base.length - 1] = Math.round((base[base.length - 1] + (total - somaBase)) * 100) / 100;
        return base;
    };

    const trocarCliente = (idx: number, novoClienteId: string) => {
        const parcelas = novoClienteId ? (parcelasPorCliente.get(novoClienteId) || []) : [];
        const clienteNome = clientes.find(c => c.id === novoClienteId)?.nome || null;
        const primeira = parcelas[0];
        atualizarLinha(idx, {
            clienteId: novoClienteId || null,
            clienteNome,
            parcelaId: primeira?.id || null,
            confianca: 'nome',
            ignorada: !novoClienteId || !primeira,
            alvos: primeira ? [{ parcelaId: primeira.id, valorAlocado: linhas[idx].linha.valor }] : [],
        });
    };

    const trocarParcelaAlvo = (idx: number, alvoIdx: number, novaParcelaId: string) => {
        const alvos = linhas[idx].alvos.map((a, i) => (i === alvoIdx ? { ...a, parcelaId: novaParcelaId } : a));
        atualizarLinha(idx, { alvos, parcelaId: alvos[0]?.parcelaId || null, ignorada: !novaParcelaId && alvos.length === 1 });
    };

    const atualizarValorAlvo = (idx: number, alvoIdx: number, valor: number) => {
        const alvos = linhas[idx].alvos.map((a, i) => (i === alvoIdx ? { ...a, valorAlocado: valor } : a));
        atualizarLinha(idx, { alvos });
    };

    // Próxima parcela em aberto do cliente ainda não usada por esta linha.
    const proximaParcelaLivre = (l: LinhaEditavel): Parcela | undefined => {
        const usadas = new Set(l.alvos.map(a => a.parcelaId));
        return parcelasDoCliente(l.clienteId).find(p => !usadas.has(p.id));
    };

    // Dividir: reparte o recebimento entre 2 parcelas, rateado pelo líquido esperado de cada uma.
    const dividir = (idx: number) => {
        const l = linhas[idx];
        const proxima = proximaParcelaLivre(l);
        if (!proxima || l.alvos.length !== 1) return;
        const p1 = parcelaPorId(l.clienteId, l.alvos[0].parcelaId);
        const parcelasPar = [p1, proxima].filter(Boolean) as Parcela[];
        const valores = ratearPorLiquido(parcelasPar, l.linha.valor);
        atualizarLinha(idx, {
            alvos: [
                { parcelaId: l.alvos[0].parcelaId, valorAlocado: valores[0] },
                { parcelaId: proxima.id, valorAlocado: valores[1] },
            ],
        });
    };

    // Agregar: adiciona mais uma parcela ao recebimento, com o valor = seu líquido esperado.
    const agregar = (idx: number) => {
        const l = linhas[idx];
        const proxima = proximaParcelaLivre(l);
        if (!proxima) return;
        atualizarLinha(idx, {
            alvos: [...l.alvos, { parcelaId: proxima.id, valorAlocado: Math.round(liquidoEsperado(proxima) * 100) / 100 }],
        });
    };

    const removerAlvo = (idx: number, alvoIdx: number) => {
        const alvos = linhas[idx].alvos.filter((_, i) => i !== alvoIdx);
        atualizarLinha(idx, { alvos, parcelaId: alvos[0]?.parcelaId || null, ignorada: alvos.length === 0 });
    };

    const confirmarReplicar = async () => {
        if (!replicarAlvo) return;
        const { idx, alvoIdx } = replicarAlvo;
        const l = linhas[idx];
        const alvo = l.alvos[alvoIdx];
        const parcela = parcelaPorId(l.clienteId, alvo.parcelaId);
        if (!parcela) { setReplicarAlvo(null); return; }
        setReplicando(true);
        try {
            const { atualizadas } = await conciliacaoOcrService.replicarValorLiquido(
                parcela.contrato_id,
                parcela.data_vencimento,
                alvo.valorAlocado
            );
            // Reflete localmente o novo valor esperado nas parcelas seguintes já carregadas.
            const repasse = (parcela.contratos?.repasse_percentual || 100) / 100;
            const brutoCorrigido = repasse > 0 ? alvo.valorAlocado / repasse : alvo.valorAlocado;
            setParcelasPorCliente(prev => {
                const novo = new Map(prev);
                const lista = (novo.get(l.clienteId!) || []).map(p =>
                    p.contrato_id === parcela.contrato_id &&
                    ['pendente', 'atrasado'].includes(p.status) &&
                    p.data_vencimento > parcela.data_vencimento
                        ? { ...p, valor_previsto: brutoCorrigido }
                        : p
                );
                novo.set(l.clienteId!, lista);
                return novo;
            });
            setReplicarAlvo(null);
            alert(`Valor líquido replicado para ${atualizadas} parcela(s) seguinte(s) em aberto do contrato.`);
        } catch {
            alert('Erro ao replicar o valor para as parcelas seguintes.');
        } finally {
            setReplicando(false);
        }
    };

    const handleConfirmar = async () => {
        setConfirmando(true);
        try {
            const itens: LinhaConfirmacao[] = linhas
                .filter(l => !l.ignorada && l.clienteId && l.alvos.some(a => a.parcelaId))
                .map(l => ({ linha: l.linha, clienteId: l.clienteId!, alvos: l.alvos.filter(a => a.parcelaId) }));
            const nomeArquivo = arquivos.map(f => f.name).join(', ');
            const { confirmadas } = await conciliacaoOcrService.confirmarConciliacao(itens, frente, nomeArquivo);
            const totalValor = itens.reduce((acc, i) => acc + i.alvos.reduce((s, a) => s + a.valorAlocado, 0), 0);
            fechar();
            onConcluido();
            alert(`Conciliação concluída: ${confirmadas} parcela(s) baixada(s), totalizando ${formatarMoeda(totalValor)}.`);
        } catch (err) {
            alert('Erro ao confirmar a conciliação.');
        } finally {
            setConfirmando(false);
        }
    };

    const linhasAceitas = linhas.filter(l => !l.ignorada && l.alvos.some(a => a.parcelaId));
    const totalLinhasAceitas = linhasAceitas.length;
    const totalParcelas = linhasAceitas.reduce((acc, l) => acc + l.alvos.filter(a => a.parcelaId).length, 0);
    const valorTotalAceitas = linhasAceitas.reduce((acc, l) => acc + l.alvos.reduce((s, a) => s + a.valorAlocado, 0), 0);
    const clientesOrdenados = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome));

    const segBtn = (active: boolean) =>
        `flex-1 h-9 rounded-lg text-[12px] font-semibold transition-all ${active ? 'bg-surface-3 text-primary' : 'text-faint hover:text-muted'}`;

    const selCls = 'bg-surface-2 border border-subtle text-main font-semibold rounded-[8px] px-2 h-8 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-40';
    const acaoBtn = 'flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold text-muted border border-subtle hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-40 disabled:hover:text-muted disabled:hover:border-subtle';

    return (
        <SidePanel
            open={open}
            onClose={fechar}
            title="Conciliar Arquivo"
            subtitle={etapa === 'confirmacao' ? 'Revise e confirme antes de consolidar' : 'Upload de repasse/extrato para conciliação automática'}
            widthClass={etapa === 'confirmacao' ? 'max-w-4xl' : 'max-w-md'}
            footer={
                etapa === 'upload' ? (
                    <Button variant="primary" className="w-full h-10" disabled={arquivos.length === 0 || processando} isLoading={processando} onClick={handleProcessar}>
                        Processar {arquivos.length > 0 ? `(${arquivos.length} arquivo${arquivos.length > 1 ? 's' : ''})` : ''}
                    </Button>
                ) : etapa === 'confirmacao' ? (
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-[12px] text-muted">
                            {totalLinhasAceitas} linha(s) · {totalParcelas} parcela(s)
                            {totalParcelas > 0 && <span className="font-bold text-primary"> · {formatarMoeda(valorTotalAceitas)}</span>}
                        </span>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={resetar} disabled={confirmando}>Voltar</Button>
                            <Button variant="primary" onClick={handleConfirmar} isLoading={confirmando} disabled={totalParcelas === 0}>
                                Confirmar Conciliação
                            </Button>
                        </div>
                    </div>
                ) : null
            }
        >
            {etapa === 'upload' && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Frente de recebimento</label>
                        <div className="flex bg-surface-2 p-1 rounded-lg border border-subtle">
                            <button className={segBtn(frente === 'planejamento')} onClick={() => setFrente('planejamento')}>Planejamento</button>
                            <button className={segBtn(frente === 'extra')} onClick={() => setFrente('extra')}>Extras</button>
                        </div>
                    </div>

                    <div className="border border-dashed border-subtle bg-surface-2/50 rounded-xl p-10 text-center hover:border-primary hover:bg-primary/5 transition-all group">
                        <input
                            type="file"
                            id="up-conciliacao"
                            className="hidden"
                            multiple
                            accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                            onChange={(e) => e.target.files && setArquivos(Array.from(e.target.files))}
                        />
                        <label htmlFor="up-conciliacao" className="cursor-pointer block space-y-3">
                            <div className="h-12 w-12 bg-surface rounded-xl border border-subtle flex items-center justify-center mx-auto group-hover:scale-105 transition-transform">
                                <Upload className={arquivos.length > 0 ? 'text-primary' : 'text-faint'} size={20} />
                            </div>
                            <div>
                                <p className="text-[13px] font-bold text-main">
                                    {arquivos.length > 0 ? `${arquivos.length} arquivo(s) selecionado(s)` : 'Selecionar arquivo(s)'}
                                </p>
                                <p className="text-[10px] text-faint font-bold uppercase mt-1 tracking-wider">PDF, planilha ou imagem</p>
                            </div>
                        </label>
                    </div>

                    {arquivos.length > 0 && (
                        <ul className="space-y-1.5">
                            {arquivos.map((f, i) => (
                                <li key={i} className="flex items-center gap-2 text-[12px] text-muted bg-surface-2 rounded-lg px-3 py-2">
                                    <FileText size={14} className="text-faint shrink-0" />
                                    <span className="truncate">{f.name}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {erro && (
                        <div className="p-3 rounded-lg bg-danger/10 border border-subtle flex items-start gap-2.5">
                            <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
                            <p className="text-[12px] text-main">{erro}</p>
                        </div>
                    )}

                    <p className="text-[11px] text-faint leading-relaxed">
                        A extração roda localmente (sem custo por uso). Nada é gravado até a confirmação final na próxima etapa.
                    </p>
                </div>
            )}

            {etapa === 'processando' && (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    <p className="text-[12px] font-semibold text-muted uppercase tracking-wider">Extraindo e relacionando dados...</p>
                </div>
            )}

            {etapa === 'confirmacao' && (
                <div className="space-y-3">
                    {linhas.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-[12px] font-semibold text-faint">Nenhuma linha foi extraída do(s) arquivo(s).</p>
                        </div>
                    ) : (
                        linhas.map((l, idx) => {
                            const parcelas = parcelasDoCliente(l.clienteId);
                            const somaAlvos = l.alvos.reduce((s, a) => s + a.valorAlocado, 0);
                            const diff = Math.round((somaAlvos - l.linha.valor) * 100) / 100;
                            const semParcelaLivre = !proximaParcelaLivre(l);
                            return (
                                <div key={idx} className={`border border-subtle rounded-xl p-3.5 space-y-3 ${l.ignorada ? 'opacity-50' : ''}`}>
                                    {/* Cabeçalho: dado extraído + confiança + ignorar */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[12px] font-bold text-main truncate">{l.linha.nomeOriginal}</p>
                                            <p className="text-[11px] text-muted">Recebido: <span className="font-semibold text-main">{formatarMoeda(l.linha.valor)}</span></p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {badgeConfianca(l)}
                                            <button
                                                onClick={() => atualizarLinha(idx, { ignorada: !l.ignorada })}
                                                className={`p-1.5 rounded-lg transition-colors ${l.ignorada ? 'text-faint hover:text-primary' : 'text-faint hover:text-danger'}`}
                                                title={l.ignorada ? 'Reativar linha' : 'Ignorar linha'}
                                            >
                                                {l.ignorada ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <select
                                        value={l.clienteId || ''}
                                        onChange={(e) => trocarCliente(idx, e.target.value)}
                                        className={`w-full text-[12px] ${selCls}`}
                                    >
                                        <option value="">— selecionar cliente —</option>
                                        {clientesOrdenados.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                    </select>

                                    {l.clienteId && l.alvos.length > 0 && (
                                        <div className="rounded-lg border border-subtle overflow-hidden">
                                            <div className="grid grid-cols-[1fr_6rem_7rem_4rem] gap-2 px-2.5 py-1.5 bg-surface-2 text-[9px] font-bold uppercase text-faint tracking-wider">
                                                <span>Vencimento</span>
                                                <span className="text-right">Esperado líq.</span>
                                                <span className="text-right">Valor conciliado</span>
                                                <span className="text-right">Ações</span>
                                            </div>
                                            {l.alvos.map((alvo, ai) => {
                                                const parcela = parcelaPorId(l.clienteId, alvo.parcelaId);
                                                return (
                                                    <div key={ai} className="grid grid-cols-[1fr_6rem_7rem_4rem] gap-2 px-2.5 py-2 items-center border-t border-subtle">
                                                        <select
                                                            value={alvo.parcelaId}
                                                            onChange={(e) => trocarParcelaAlvo(idx, ai, e.target.value)}
                                                            className={`w-full text-[11px] ${selCls}`}
                                                        >
                                                            <option value="">— selecionar —</option>
                                                            {parcelas.map(p => (
                                                                <option key={p.id} value={p.id}>{formatarData(p.data_vencimento)}</option>
                                                            ))}
                                                        </select>
                                                        <span className="text-right text-[11px] text-muted">
                                                            {parcela ? formatarMoeda(liquidoEsperado(parcela)) : '—'}
                                                        </span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={alvo.valorAlocado}
                                                            onChange={(e) => atualizarValorAlvo(idx, ai, parseFloat(e.target.value) || 0)}
                                                            className={`w-full text-right text-[11px] ${selCls}`}
                                                        />
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                onClick={() => setReplicarAlvo({ idx, alvoIdx: ai })}
                                                                disabled={!parcela}
                                                                className="p-1 rounded-md text-faint hover:text-primary transition-colors disabled:opacity-30"
                                                                title="Replicar este valor líquido para as parcelas seguintes do contrato"
                                                            >
                                                                <Repeat size={14} />
                                                            </button>
                                                            {l.alvos.length > 1 && (
                                                                <button
                                                                    onClick={() => removerAlvo(idx, ai)}
                                                                    className="p-1 rounded-md text-faint hover:text-danger transition-colors"
                                                                    title="Remover esta parcela"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {l.clienteId && l.alvos.length > 0 && (
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex gap-2">
                                                {l.alvos.length === 1 && (
                                                    <button onClick={() => dividir(idx)} disabled={semParcelaLivre} className={acaoBtn}>
                                                        <Split size={13} /> Dividir
                                                    </button>
                                                )}
                                                <button onClick={() => agregar(idx)} disabled={semParcelaLivre} className={acaoBtn}>
                                                    {l.alvos.length === 1 ? <Layers size={13} /> : <Plus size={13} />} Agregar
                                                </button>
                                            </div>
                                            {Math.abs(diff) >= 0.01 && (
                                                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[color:var(--warning)]">
                                                    <AlertTriangle size={12} />
                                                    {diff > 0 ? 'Excede' : 'Falta'} {formatarMoeda(Math.abs(diff))} vs. recebido
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            <Confirmacao
                isOpen={replicarAlvo !== null}
                onClose={() => setReplicarAlvo(null)}
                onConfirm={confirmarReplicar}
                loading={replicando}
                danger
                confirmLabel="Replicar valor"
                title="Replicar valor líquido"
                message="O valor líquido conciliado será gravado como valor esperado de TODAS as parcelas seguintes em aberto deste contrato, corrigindo ruídos de cálculo/regra. As parcelas já vencidas antes desta não são afetadas."
            />
        </SidePanel>
    );
};

export default ConciliacaoOcrDrawer;
