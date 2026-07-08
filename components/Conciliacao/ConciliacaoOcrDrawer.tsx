import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import SidePanel from '../UI/SidePanel';
import Button from '../UI/Button';
import Badge from '../UI/Badge';
import { formatarMoeda, formatarData } from '../../utils/formatadores';
import { Parcela } from '../../services/financeiroService';
import { ClienteResumo, SugestaoMatch } from '../../utils/matchingConciliacao';
import { conciliacaoOcrService, Frente } from '../../services/conciliacaoOcrService';

interface Props {
    open: boolean;
    onClose: () => void;
    onConcluido: () => void;
}

type Etapa = 'upload' | 'processando' | 'confirmacao';

interface LinhaEditavel extends SugestaoMatch {
    ignorada: boolean;
}

const badgeConfianca = (s: LinhaEditavel) => {
    if (s.ignorada) return <Badge variant="neutral" size="sm">Ignorada</Badge>;
    if (!s.parcelaId) return <Badge variant="danger" size="sm">Sem correspondência</Badge>;
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
            setLinhas(sugestoes.map(s => ({ ...s, ignorada: !s.parcelaId })));
            setEtapa('confirmacao');
        } catch (err: any) {
            setErro(err?.message || 'Erro ao processar o(s) arquivo(s). Verifique o formato.');
            setEtapa('upload');
        }
    };

    const atualizarLinha = (idx: number, patch: Partial<LinhaEditavel>) => {
        setLinhas(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
    };

    const trocarCliente = (idx: number, novoClienteId: string) => {
        const parcelas = parcelasPorCliente.get(novoClienteId) || [];
        const clienteNome = clientes.find(c => c.id === novoClienteId)?.nome || null;
        atualizarLinha(idx, {
            clienteId: novoClienteId || null,
            clienteNome,
            parcelaId: parcelas[0]?.id || null,
            confianca: 'nome',
            ignorada: !novoClienteId || parcelas.length === 0,
        });
    };

    const handleConfirmar = async () => {
        setConfirmando(true);
        try {
            const aceitas = linhas.filter(l => !l.ignorada && l.parcelaId && l.clienteId);
            const nomeArquivo = arquivos.map(f => f.name).join(', ');
            const { confirmadas } = await conciliacaoOcrService.confirmarConciliacao(aceitas, frente, nomeArquivo);
            const totalValor = aceitas.reduce((acc, l) => acc + l.linha.valor, 0);
            fechar();
            onConcluido();
            alert(`Conciliação concluída: ${confirmadas} parcela(s) baixada(s), totalizando ${formatarMoeda(totalValor)}.`);
        } catch (err) {
            alert('Erro ao confirmar a conciliação.');
        } finally {
            setConfirmando(false);
        }
    };

    const linhasAceitas = linhas.filter(l => !l.ignorada && l.parcelaId);
    const totalAceitas = linhasAceitas.length;
    const valorTotalAceitas = linhasAceitas.reduce((acc, l) => acc + l.linha.valor, 0);
    const clientesOrdenados = [...clientes].sort((a, b) => a.nome.localeCompare(b.nome));

    const segBtn = (active: boolean) =>
        `flex-1 h-9 rounded-lg text-[12px] font-semibold transition-all ${active ? 'bg-surface-3 text-primary' : 'text-faint hover:text-muted'}`;

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
                            {totalAceitas} de {linhas.length} linha(s) serão conciliadas
                            {totalAceitas > 0 && <span className="font-bold text-primary"> · {formatarMoeda(valorTotalAceitas)}</span>}
                        </span>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={resetar} disabled={confirmando}>Voltar</Button>
                            <Button variant="primary" onClick={handleConfirmar} isLoading={confirmando} disabled={totalAceitas === 0}>
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
                <div className="space-y-4">
                    {linhas.length === 0 ? (
                        <div className="py-16 text-center">
                            <p className="text-[12px] font-semibold text-faint">Nenhuma linha foi extraída do(s) arquivo(s).</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-subtle rounded-xl">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-surface-2 border-b border-subtle">
                                        <th className="px-3 py-2 text-[10px] font-bold uppercase text-faint tracking-wider">Extraído</th>
                                        <th className="px-3 py-2 text-[10px] font-bold uppercase text-faint tracking-wider">Cliente</th>
                                        <th className="px-3 py-2 text-[10px] font-bold uppercase text-faint tracking-wider">Parcela</th>
                                        <th className="px-3 py-2 text-[10px] font-bold uppercase text-faint tracking-wider">Confiança</th>
                                        <th className="px-3 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-subtle">
                                    {linhas.map((l, idx) => {
                                        const parcelasDoCliente = l.clienteId ? (parcelasPorCliente.get(l.clienteId) || []) : [];
                                        return (
                                            <tr key={idx} className={l.ignorada ? 'opacity-50' : ''}>
                                                <td className="px-3 py-2.5">
                                                    <p className="text-[12px] font-bold text-main">{l.linha.nomeOriginal}</p>
                                                    <p className="text-[11px] text-muted">{formatarMoeda(l.linha.valor)}</p>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <select
                                                        value={l.clienteId || ''}
                                                        onChange={(e) => trocarCliente(idx, e.target.value)}
                                                        className="w-full bg-surface-2 border border-subtle text-main text-[12px] font-semibold rounded-[8px] px-2 h-8 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                    >
                                                        <option value="">— selecionar —</option>
                                                        {clientesOrdenados.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <select
                                                        value={l.parcelaId || ''}
                                                        disabled={!l.clienteId}
                                                        onChange={(e) => atualizarLinha(idx, { parcelaId: e.target.value || null, ignorada: !e.target.value })}
                                                        className="w-full bg-surface-2 border border-subtle text-main text-[11px] font-semibold rounded-[8px] px-2 h-8 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-40"
                                                    >
                                                        <option value="">— selecionar —</option>
                                                        {parcelasDoCliente.map(p => {
                                                            // Valor líquido esperado (pós-repasse) — é com ele que o valor extraído
                                                            // do arquivo se relaciona, não com o bruto do contrato.
                                                            const liquido = p.valor_previsto * ((p.contratos?.repasse_percentual || 100) / 100);
                                                            return (
                                                                <option key={p.id} value={p.id}>
                                                                    {formatarData(p.data_vencimento)} · líq. {formatarMoeda(liquido)}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2.5">{badgeConfianca(l)}</td>
                                                <td className="px-3 py-2.5 text-right">
                                                    <button
                                                        onClick={() => atualizarLinha(idx, { ignorada: !l.ignorada })}
                                                        className={`p-1.5 rounded-lg transition-colors ${l.ignorada ? 'text-faint hover:text-primary' : 'text-faint hover:text-danger'}`}
                                                        title={l.ignorada ? 'Reativar linha' : 'Ignorar linha'}
                                                    >
                                                        {l.ignorada ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </SidePanel>
    );
};

export default ConciliacaoOcrDrawer;
