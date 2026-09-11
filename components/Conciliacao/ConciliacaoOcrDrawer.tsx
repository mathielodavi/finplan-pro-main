import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Split, Layers, Repeat, Plus, Trash2 } from 'lucide-react';
import SidePanel from '../UI/SidePanel';
import Button from '../UI/Button';
import Badge from '../UI/Badge';
import Confirmacao from '../Confirmacao';
import { formatarMoeda, formatarData } from '../../utils/formatadores';
import { Parcela } from '../../services/financeiroService';
import { ClienteResumo, SugestaoMatch } from '../../utils/matchingConciliacao';
import { conciliacaoOcrService, Frente, AlvoBaixa, LinhaConfirmacao } from '../../services/conciliacaoOcrService';
import { toast } from '../../utils/toast';

interface Props {
    open: boolean;
    onClose: () => void;
    onConcluido: () => void;
}

type Etapa = 'colar' | 'processando' | 'confirmacao';

interface LinhaEditavel extends SugestaoMatch {
    ignorada: boolean;
    // Parcelas a baixar por esta linha, cada uma com o valor rateado (Dividir/Agregar).
    alvos: AlvoBaixa[];
}

const EXEMPLO = `{
  "recebimentos": [
    { "frente": "planejamento", "nome_cliente": "Ana Zellner", "valor_repasse": 450.00 },
    { "frente": "extra", "nome_cliente": "Pedro Camargo", "valor_repasse": 1200.00,
      "canal_recebimento": "pix" }
  ]
}`;

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
    const [etapa, setEtapa] = useState<Etapa>('colar');
    const [jsonTexto, setJsonTexto] = useState('');
    const [erros, setErros] = useState<string[]>([]);
    const [erro, setErro] = useState<string | null>(null);
    const [processando, setProcessando] = useState(false);
    const [confirmando, setConfirmando] = useState(false);

    const [linhas, setLinhas] = useState<LinhaEditavel[]>([]);
    const [clientes, setClientes] = useState<ClienteResumo[]>([]);
    // Uma frente pode ter parcelas em aberto diferentes das da outra para o mesmo cliente — por
    // isso o mapa é por frente, não só por cliente (ver `conciliacaoOcrService.processarJson`).
    const [parcelasPorClienteFrente, setParcelasPorClienteFrente] = useState<Record<Frente, Map<string, Parcela[]>>>(
        { planejamento: new Map(), extra: new Map() }
    );

    // Alvo pendente de confirmação para "Replicar" (grava valor esperado nas parcelas seguintes).
    const [replicarAlvo, setReplicarAlvo] = useState<{ idx: number; alvoIdx: number } | null>(null);
    const [replicando, setReplicando] = useState(false);

    const resetar = () => {
        setEtapa('colar');
        setJsonTexto('');
        setErros([]);
        setErro(null);
        setLinhas([]);
    };

    const fechar = () => {
        resetar();
        onClose();
    };

    const handleProcessar = async () => {
        if (!jsonTexto.trim()) return;
        setEtapa('processando');
        setErro(null);
        setErros([]);
        try {
            const { sugestoes, clientes: clientesCarregados, parcelasPorClienteFrente: mapa, erros: errosParse } = await conciliacaoOcrService.processarJson(jsonTexto);
            if (errosParse.length > 0) {
                setErros(errosParse);
                setEtapa('colar');
                return;
            }
            setClientes(clientesCarregados);
            setParcelasPorClienteFrente(mapa);
            const editaveis = sugestoes.map(s => ({
                ...s,
                ignorada: !s.parcelaId,
                alvos: s.parcelaId ? [{ parcelaId: s.parcelaId, valorAlocado: s.linha.valor }] : [],
            }));
            // Reordena por cliente (A-Z) para facilitar a conferência quando há mais de um
            // recebimento do mesmo cliente no arquivo — ficam agrupados lado a lado. Linhas sem
            // cliente identificado vão para o fim.
            editaveis.sort((a, b) => {
                if (!a.clienteNome && !b.clienteNome) return 0;
                if (!a.clienteNome) return 1;
                if (!b.clienteNome) return -1;
                return a.clienteNome.localeCompare(b.clienteNome, 'pt-BR');
            });
            setLinhas(editaveis);
            setEtapa('confirmacao');
        } catch (err: any) {
            setErro(err?.message || 'Erro ao processar o JSON.');
            setEtapa('colar');
        }
    };

    const atualizarLinha = (idx: number, patch: Partial<LinhaEditavel>) => {
        setLinhas(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    };

    const frenteDaLinha = (l: LinhaEditavel): Frente => l.linha.frente || 'planejamento';
    const parcelasDoCliente = (l: LinhaEditavel): Parcela[] => {
        if (!l.clienteId) return [];
        return parcelasPorClienteFrente[frenteDaLinha(l)]?.get(l.clienteId) || [];
    };
    const parcelaPorId = (l: LinhaEditavel, parcelaId: string): Parcela | undefined =>
        parcelasDoCliente(l).find(p => p.id === parcelaId);

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
        const l = linhas[idx];
        const parcelas = novoClienteId ? (parcelasPorClienteFrente[frenteDaLinha(l)]?.get(novoClienteId) || []) : [];
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
        return parcelasDoCliente(l).find(p => !usadas.has(p.id));
    };

    // Dividir: reparte o recebimento entre 2 parcelas, rateado pelo líquido esperado de cada uma.
    const dividir = (idx: number) => {
        const l = linhas[idx];
        const proxima = proximaParcelaLivre(l);
        if (!proxima || l.alvos.length !== 1) return;
        const p1 = parcelaPorId(l, l.alvos[0].parcelaId);
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
        const parcela = parcelaPorId(l, alvo.parcelaId);
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
            const frenteL = frenteDaLinha(l);
            setParcelasPorClienteFrente(prev => {
                const novoMapa = new Map(prev[frenteL]);
                const lista = (novoMapa.get(l.clienteId!) || []).map(p =>
                    p.contrato_id === parcela.contrato_id &&
                    ['pendente', 'atrasado'].includes(p.status) &&
                    p.data_vencimento > parcela.data_vencimento
                        ? { ...p, valor_previsto: brutoCorrigido }
                        : p
                );
                novoMapa.set(l.clienteId!, lista);
                return { ...prev, [frenteL]: novoMapa };
            });
            setReplicarAlvo(null);
            toast.success(`Valor líquido replicado para ${atualizadas} parcela(s) seguinte(s) em aberto do contrato.`);
        } catch {
            toast.error('Erro ao replicar o valor para as parcelas seguintes.');
        } finally {
            setReplicando(false);
        }
    };

    const handleConfirmar = async () => {
        setConfirmando(true);
        try {
            const itens: LinhaConfirmacao[] = linhas
                .filter(l => !l.ignorada && l.clienteId && l.alvos.some(a => a.parcelaId))
                .map(l => ({ linha: l.linha, clienteId: l.clienteId!, alvos: l.alvos.filter(a => a.parcelaId), frente: frenteDaLinha(l) }));
            const { confirmadas } = await conciliacaoOcrService.confirmarConciliacao(itens, 'Import JSON');
            const totalValor = itens.reduce((acc, i) => acc + i.alvos.reduce((s, a) => s + a.valorAlocado, 0), 0);
            fechar();
            onConcluido();
            toast.success(`Conciliação concluída: ${confirmadas} parcela(s) baixada(s), totalizando ${formatarMoeda(totalValor)}.`);
        } catch (err) {
            toast.error('Erro ao confirmar a conciliação.');
        } finally {
            setConfirmando(false);
        }
    };

    const linhasAceitas = linhas.filter(l => !l.ignorada && l.alvos.some(a => a.parcelaId));
    const totalLinhasAceitas = linhasAceitas.length;
    const totalParcelas = linhasAceitas.reduce((acc, l) => acc + l.alvos.filter(a => a.parcelaId).length, 0);
    const valorTotalAceitas = linhasAceitas.reduce((acc, l) => acc + l.alvos.reduce((s, a) => s + a.valorAlocado, 0), 0);
    const clientesOrdenados = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome));

    const selCls = 'bg-surface-2 border border-subtle text-main font-semibold rounded-[8px] px-2 h-8 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-40';
    const acaoBtn = 'flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold text-muted border border-subtle hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-40 disabled:hover:text-muted disabled:hover:border-subtle';

    return (
        <SidePanel
            open={open}
            onClose={fechar}
            title="Conciliar Arquivo"
            subtitle={etapa === 'confirmacao' ? 'Revise e confirme antes de consolidar' : 'Cole o JSON de recebimentos para conciliação automática'}
            widthClass={etapa === 'confirmacao' ? 'max-w-4xl' : 'max-w-md'}
            footer={
                etapa === 'colar' ? (
                    <Button variant="primary" className="w-full h-10" disabled={!jsonTexto.trim() || processando} isLoading={processando} onClick={handleProcessar}>
                        Analisar dados
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
            {etapa === 'colar' && (
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Colar dados (JSON)</label>
                        <textarea
                            value={jsonTexto}
                            onChange={(e) => { setJsonTexto(e.target.value); if (erros.length) setErros([]); }}
                            placeholder={EXEMPLO}
                            spellCheck={false}
                            className="w-full h-56 bg-surface-2 border border-subtle rounded-lg px-3 py-2.5 text-main text-[12px] font-mono leading-relaxed outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y placeholder:text-faint"
                        />
                        <p className="text-[11px] text-faint mt-1.5 leading-relaxed">
                            Cada recebimento aponta sua própria <b>frente</b> ("planejamento" ou "extra") — um único JSON
                            pode misturar as duas. Para "extra", <b>canal_recebimento</b> é obrigatório (pix, transferencia,
                            boleto, cartao ou outro). Nada é gravado até a confirmação final na próxima etapa.
                        </p>
                    </div>

                    {erros.length > 0 && (
                        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 space-y-1">
                            {erros.slice(0, 8).map((e, i) => (
                                <p key={i} className="flex items-start gap-2 text-[12px] text-danger font-medium">
                                    <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {e}
                                </p>
                            ))}
                        </div>
                    )}

                    {erro && (
                        <div className="p-3 rounded-lg bg-danger/10 border border-subtle flex items-start gap-2.5">
                            <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
                            <p className="text-[12px] text-main">{erro}</p>
                        </div>
                    )}
                </div>
            )}

            {etapa === 'processando' && (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    <p className="text-[12px] font-semibold text-muted uppercase tracking-wider">Relacionando dados...</p>
                </div>
            )}

            {etapa === 'confirmacao' && (
                <div className="space-y-3">
                    {linhas.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-[12px] font-semibold text-faint">Nenhum recebimento foi extraído do JSON.</p>
                        </div>
                    ) : (
                        linhas.map((l, idx) => {
                            const frenteL = frenteDaLinha(l);
                            const parcelas = parcelasDoCliente(l);
                            const somaAlvos = l.alvos.reduce((s, a) => s + a.valorAlocado, 0);
                            const diff = Math.round((somaAlvos - l.linha.valor) * 100) / 100;
                            const semParcelaLivre = !proximaParcelaLivre(l);
                            return (
                                <div key={idx} className={`border border-subtle rounded-xl p-3.5 space-y-3 ${l.ignorada ? 'opacity-50' : ''}`}>
                                    {/* Cabeçalho: dado extraído + frente + confiança + ignorar */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-[12px] font-bold text-main truncate">{l.linha.nomeOriginal}</p>
                                                <Badge variant={frenteL === 'extra' ? 'warning' : 'neutral'} size="sm">
                                                    {frenteL === 'extra' ? 'Extra' : 'Planejamento'}
                                                </Badge>
                                            </div>
                                            <p className="text-[11px] text-muted">
                                                Recebido: <span className="font-semibold text-main">{formatarMoeda(l.linha.valor)}</span>
                                                {frenteL === 'extra' && l.linha.canalRecebimento && (
                                                    <span className="text-faint"> · {l.linha.canalRecebimento}</span>
                                                )}
                                            </p>
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
                                                <span>{frenteL === 'extra' ? 'Vencimento/Contrato' : 'Vencimento'}</span>
                                                <span className="text-right">Esperado líq.</span>
                                                <span className="text-right">Valor conciliado</span>
                                                <span className="text-right">Ações</span>
                                            </div>
                                            {l.alvos.map((alvo, ai) => {
                                                const parcela = parcelaPorId(l, alvo.parcelaId);
                                                return (
                                                    <div key={ai} className="grid grid-cols-[1fr_6rem_7rem_4rem] gap-2 px-2.5 py-2 items-center border-t border-subtle">
                                                        <select
                                                            value={alvo.parcelaId}
                                                            onChange={(e) => trocarParcelaAlvo(idx, ai, e.target.value)}
                                                            className={`w-full text-[11px] ${selCls}`}
                                                        >
                                                            <option value="">— selecionar —</option>
                                                            {parcelas.map(p => (
                                                                <option key={p.id} value={p.id}>
                                                                    {frenteL === 'extra' ? `${formatarData(p.data_vencimento)} · ${p.contratos?.descricao || 'sem contrato'}` : formatarData(p.data_vencimento)}
                                                                </option>
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
