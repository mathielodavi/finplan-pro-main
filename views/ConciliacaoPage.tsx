
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { financeiroService, Parcela } from '../services/financeiroService';
import { formatarMoeda, formatarData } from '../utils/formatadores';
import Card from '../components/UI/Card';
import Badge from '../components/UI/Badge';
import Button from '../components/UI/Button';
import Modal from '../components/Modal';
import InputMoeda from '../components/UI/InputMoeda';
import ConciliacaoOcrDrawer from '../components/Conciliacao/ConciliacaoOcrDrawer';
import { toast } from '../utils/toast';
import { CheckCircle2, Search, ArrowUpRight, CheckSquare, Square, History, CalendarDays, Calendar, AlertTriangle, Filter, ChevronLeft, ChevronRight, ScanLine } from 'lucide-react';

const ConciliacaoPage: React.FC = () => {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [valoresLiquidos, setValoresLiquidos] = useState<Record<string, number>>({});
  const [datasRecebimento, setDatasRecebimento] = useState<Record<string, string>>({});
  const [buscaNome, setBuscaNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isOcrDrawerOpen, setIsOcrDrawerOpen] = useState(false);
  const [resumo, setResumo] = useState({ previsto: 0, realizado: 0, countAtrasado: 0 });

  const hoje = new Date();
  const [filtro, setFiltro] = useState({
    mes: hoje.getMonth() + 1,
    ano: hoje.getFullYear(),
    apenasAbertos: false,
    status: 'pendente' as 'pendente' | 'pago' | 'todos',
    tipo: 'todos' as 'todos' | 'planejamento' | 'extra'
  });

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const [pData, rData] = await Promise.all([
        financeiroService.listarRecebiveis(filtro.mes, filtro.ano, filtro.apenasAbertos, filtro.status, filtro.tipo),
        financeiroService.getResumoMes(filtro.mes, filtro.ano)
      ]);

      const dados = pData || [];
      setParcelas(dados);
      setResumo(rData);
      setSelecionadas([]);

      const vMap: Record<string, number> = {};
      const dMap: Record<string, string> = {};
      const hojeStr = new Date().toISOString().split('T')[0];

      dados.forEach(p => {
        if (p.status === 'pago') {
          vMap[p.id] = p.valor_pago || 0;
          dMap[p.id] = p.data_pagamento?.split('T')[0] || hojeStr;
        } else {
          const fator = (p.contratos?.repasse_percentual || 100) / 100;
          vMap[p.id] = p.valor_previsto * fator;
          dMap[p.id] = hojeStr;
        }
      });

      setValoresLiquidos(vMap);
      setDatasRecebimento(dMap);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const totalSelecionadoLiquido = useMemo(() => {
    return selecionadas.reduce((acc, id) => acc + (valoresLiquidos[id] || 0), 0);
  }, [selecionadas, valoresLiquidos]);

  const parcelasFiltradas = useMemo(() => {
    const termo = buscaNome.toLowerCase();
    return parcelas.filter(p =>
      p.clientes?.nome.toLowerCase().includes(termo) ||
      p.contratos?.descricao.toLowerCase().includes(termo)
    );
  }, [parcelas, buscaNome]);

  const parcelasAgrupadas = useMemo(() => {
    const groups: Record<string, Parcela[]> = {};
    parcelasFiltradas.forEach(p => {
      const date = new Date(p.data_vencimento);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    Object.values(groups).forEach(group => {
      group.sort((a, b) => (a.clientes?.nome || '').localeCompare(b.clientes?.nome || ''));
    });

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [parcelasFiltradas]);

  const toggleSelecao = (id: string) => {
    setSelecionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selecionarGrupo = (listaGrupo: Parcela[]) => {
    const idsEditaveis = listaGrupo.filter(p => p.status !== 'pago').map(p => p.id);
    const todosJaSelecionados = idsEditaveis.length > 0 && idsEditaveis.every(id => selecionadas.includes(id));
    setSelecionadas(prev => todosJaSelecionados ? prev.filter(id => !idsEditaveis.includes(id)) : Array.from(new Set([...prev, ...idsEditaveis])));
  };

  const handleBaixaMassiva = useCallback(async () => {
    if (selecionadas.length === 0 || processing) return;

    setProcessing(true);
    try {
      const promises = selecionadas.map(id => {
        const valor = valoresLiquidos[id] || 0;
        const data = datasRecebimento[id] || new Date().toISOString().split('T')[0];
        return financeiroService.registrarPagamento(id, valor, data);
      });

      await Promise.all(promises);

      setIsConfirmModalOpen(false);
      toast.success(`Sucesso! ${selecionadas.length} parcelas foram conciliadas.`);
      await carregarDados();
    } catch (err: any) {
      console.error("Erro no processamento de lote:", err);
      toast.error("Houve um erro ao processar a baixa.");
    } finally {
      setProcessing(false);
    }
  }, [selecionadas, valoresLiquidos, datasRecebimento, carregarDados, processing]);

  const labelMesAno = (key: string) => {
    const [ano, mes] = key.split('-');
    const nomes = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    return `${nomes[parseInt(mes) - 1]} / ${ano}`;
  };

  const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const periodoLabel = `${NOMES_MES[filtro.mes - 1]} ${filtro.ano}`;
  const irPeriodo = (delta: number) => {
    let m = filtro.mes + delta;
    let a = filtro.ano;
    if (m < 1) { m = 12; a -= 1; }
    if (m > 12) { m = 1; a += 1; }
    setFiltro({ ...filtro, mes: m, ano: a });
  };
  const segBtn = (active: boolean) =>
    `px-3 py-1 rounded-md text-[12px] font-semibold transition-all ${active ? 'bg-surface-3 text-primary' : 'text-faint hover:text-muted'}`;

  return (
    <div className="animate-fade-in max-w-[1400px] mx-auto pb-24 px-4 lg:px-8">
      {/* -top-6 compensa o p-6 do <main> (scroll container): sem isso o painel fixa 24px abaixo
          do topo visível e as linhas da tabela aparecem na faixa acima dele ao rolar. */}
      <div className="sticky -top-6 z-30 bg-canvas pt-6 pb-6 border-b border-subtle mb-6 -mx-4 px-4 lg:-mx-8 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {/* Navegador de período */}
            <div className="flex items-center bg-surface-2 rounded-lg border border-subtle h-9 overflow-hidden">
              <button onClick={() => irPeriodo(-1)} className="h-full px-2 text-faint hover:text-main hover:bg-surface-3 transition-colors" title="Mês anterior">
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 text-[13px] font-semibold text-main min-w-[120px] text-center capitalize">{periodoLabel}</span>
              <button onClick={() => irPeriodo(1)} className="h-full px-2 text-faint hover:text-main hover:bg-surface-3 transition-colors" title="Próximo mês">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Segmented — status */}
            <div className="flex bg-surface-2 p-0.5 rounded-lg border border-subtle h-9 items-center">
              {([['pendente', 'Abertos'], ['pago', 'Conciliados'], ['todos', 'Todos']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setFiltro({ ...filtro, status: id })} className={segBtn(filtro.status === id)}>{label}</button>
              ))}
            </div>

            {/* Segmented — tipo */}
            <div className="flex bg-surface-2 p-0.5 rounded-lg border border-subtle h-9 items-center">
              {([['todos', 'Todos'], ['planejamento', 'Planej.'], ['extra', 'Extras']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setFiltro({ ...filtro, tipo: id })} className={segBtn(filtro.tipo === id)}>{label}</button>
              ))}
            </div>

            {/* Toggle atrasados */}
            <button
              onClick={() => setFiltro({ ...filtro, apenasAbertos: !filtro.apenasAbertos })}
              className="h-9 px-3 rounded-lg font-semibold text-[12px] flex items-center gap-1.5 border transition-all"
              style={filtro.apenasAbertos
                ? { backgroundColor: 'rgba(251,191,36,0.14)', color: 'var(--warning)', borderColor: 'rgba(251,191,36,0.3)' }
                : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            >
              <History size={14} />
              {filtro.apenasAbertos ? 'Atrasados' : 'Mês fixo'}
            </button>
          </div>

          {/* Busca */}
          <div className="relative group lg:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-faint group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Buscar cliente ou acordo..."
              value={buscaNome}
              onChange={e => setBuscaNome(e.target.value)}
              className="w-full pl-9 pr-3 h-9 bg-surface-2 border border-subtle rounded-lg font-medium text-[13px] outline-none focus:border-primary transition-all text-main placeholder:text-faint"
            />
          </div>

          <Button variant="outline" size="md" onClick={() => setIsOcrDrawerOpen(true)} className="h-9 gap-2 text-[12px] font-semibold shrink-0">
            <ScanLine size={15} />
            Conciliar arquivo
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-surface border border-subtle p-4 rounded-xl flex flex-col transition-colors h-[108px]">
            <span className="text-[11px] font-medium text-faint block leading-none mb-4">Receita prevista (líquida)</span>
            <div className="flex justify-between items-end mt-auto">
              <p className="text-[24px] font-bold text-main tracking-tight break-words xl:truncate leading-none">{formatarMoeda(resumo.previsto)}</p>
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(16,185,129,0.14)', color: 'var(--primary)' }}>
                <CalendarDays size={16} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl flex flex-col transition-all duration-300 h-[108px] border" style={selecionadas.length > 0
            ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' }
            : { backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <span className="text-[11px] font-medium block leading-none mb-4" style={{ color: selecionadas.length > 0 ? 'rgba(11,14,20,0.7)' : 'var(--text-faint)' }}>Líquido em seleção</span>
            <div className="flex justify-between items-end mt-auto">
              <p className="text-[24px] font-bold tracking-tight break-words xl:truncate leading-none" style={{ color: selecionadas.length > 0 ? '#0b0e14' : 'var(--text-main)' }}>{formatarMoeda(totalSelecionadoLiquido)}</p>
              <div className="p-1.5 rounded-lg" style={selecionadas.length > 0 ? { backgroundColor: 'rgba(11,14,20,0.15)', color: '#0b0e14' } : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-faint)' }}>
                <CheckSquare size={16} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="bg-surface border border-subtle p-4 rounded-xl flex flex-col transition-colors h-[108px]">
            <span className="text-[11px] font-medium text-faint block leading-none mb-4">Liquidação acumulada</span>
            <div className="flex justify-between items-end mt-auto">
              <p className="text-[24px] font-bold text-main tracking-tight break-words xl:truncate leading-none">{formatarMoeda(resumo.realizado)}</p>
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(96,165,250,0.14)', color: 'var(--info)' }}>
                <ArrowUpRight size={16} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="bg-surface border border-subtle p-4 rounded-xl flex flex-col transition-colors h-[108px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-medium text-faint block leading-none">Saldo a conciliar</span>
              {resumo.countAtrasado > 0 && (
                <Badge variant="danger" size="sm">{resumo.countAtrasado} em atraso</Badge>
              )}
            </div>
            <div className="flex justify-between items-end mt-auto">
              <p className="text-[24px] font-bold text-main tracking-tight break-words xl:truncate leading-none">{formatarMoeda(resumo.previsto - resumo.realizado)}</p>
              <div className="p-1.5 rounded-lg" style={{ backgroundColor: 'rgba(248,113,113,0.14)', color: 'var(--danger)' }}>
                <AlertTriangle size={16} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8 pt-4">
        {parcelasAgrupadas.map(([periodoKey, lista]) => {
          const editaveisNoGrupo = lista.filter(p => p.status !== 'pago').map(p => p.id);
          const todosSelecionadosNoGrupo = editaveisNoGrupo.length > 0 && editaveisNoGrupo.every(id => selecionadas.includes(id));
          const liquidoPrevistoGrupo = lista.reduce((acc, p) => acc + p.valor_previsto * ((p.contratos?.repasse_percentual || 100) / 100), 0);
          const abertasNoGrupo = lista.filter(p => p.status !== 'pago' && p.status !== 'cancelado').length;

          return (
            <div key={periodoKey} className="space-y-6">
              <div className="flex items-center gap-3 bg-surface-2 px-4 py-2.5 rounded-xl border border-subtle w-fit">
                <CalendarDays size={16} className="text-muted" />
                <span className="text-[13px] font-semibold text-main">{labelMesAno(periodoKey)}</span>
                <Badge variant="neutral" size="sm">{lista.length} parcelas</Badge>
                {abertasNoGrupo > 0 && <Badge variant="warning" size="sm">{abertasNoGrupo} abertas</Badge>}
                <span className="text-[12px] font-semibold text-muted border-l border-subtle pl-3">líq. previsto {formatarMoeda(liquidoPrevistoGrupo)}</span>
              </div>

              <div className="bg-surface rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden transition-all">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface border-b border-subtle">
                        <th className="px-4 py-2 w-12 text-center">
                          {editaveisNoGrupo.length > 0 && (
                            <button
                              onClick={() => selecionarGrupo(lista)}
                              className={`p-1 transition-colors ${todosSelecionadosNoGrupo ? 'text-primary' : 'text-faint hover:text-primary'}`}
                            >
                              {todosSelecionadosNoGrupo ? <CheckSquare size={16} strokeWidth={2.5} /> : <Square size={16} strokeWidth={2.5} />}
                            </button>
                          )}
                        </th>
                        <th className="px-4 py-2 text-[10px] font-bold uppercase text-faint tracking-wider">Cliente / Acordo</th>
                        <th className="px-4 py-2 text-[10px] font-bold uppercase text-faint tracking-wider text-center">Vencimento</th>
                        <th className="px-4 py-2 text-[10px] font-bold uppercase text-faint tracking-wider text-right">Líquido Previsto</th>
                        <th className="px-4 py-2 text-[10px] font-bold uppercase text-primary tracking-wider text-right">Líquido Recebido</th>
                        <th className="px-4 py-2 text-[10px] font-bold uppercase text-faint tracking-wider text-center">Recebimento</th>
                        <th className="px-4 py-2 text-right text-[10px] font-bold uppercase text-faint tracking-wider">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map(p => {
                        const fatorRepasse = (p.contratos?.repasse_percentual || 100) / 100;
                        const esperadoLiquido = p.valor_previsto * fatorRepasse;
                        const isSelecionada = selecionadas.includes(p.id);
                        const isPago = p.status === 'pago';

                        return (
                          <tr
                            key={p.id}
                            onClick={() => !isPago && toggleSelecao(p.id)}
                            className={`group transition-all border-b border-subtle last:border-0 ${isPago ? 'bg-surface-2/50' : isSelecionada ? 'bg-primary/10 cursor-pointer' : 'hover:bg-surface-2 cursor-pointer'}`}
                          >
                            <td className="px-4 py-2.5 text-center">
                              {!isPago ? (
                                <button onClick={(e) => { e.stopPropagation(); toggleSelecao(p.id); }} className={`p-1 transition-colors ${isSelecionada ? 'text-primary' : 'text-faint hover:text-primary'}`}>
                                  {isSelecionada ? <CheckSquare size={16} /> : <Square size={16} />}
                                </button>
                              ) : (
                                <div className="p-1 text-primary opacity-40 mx-auto"><CheckCircle2 size={16} /></div>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-1 h-5 rounded-full shrink-0 ${p.contratos?.tipo === 'planejamento' ? 'bg-info' : 'bg-warning'}`} />
                                <div>
                                  <p className="font-bold text-main text-[13px] tracking-tight leading-none mb-1">{p.clientes?.nome}</p>
                                  <span className="text-[10px] text-faint font-bold uppercase block">{p.contratos?.descricao}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 font-bold text-muted text-center text-[12px]">
                              {formatarData(p.data_vencimento)}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex flex-col items-end">
                                <p className="font-bold text-main text-[13px] leading-none mb-1">{formatarMoeda(esperadoLiquido)}</p>
                                <span className="text-[10px] font-bold text-faint uppercase tracking-wider block">
                                  Bruto: {formatarMoeda(p.valor_previsto)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right min-w-[140px] align-middle" onClick={(e) => e.stopPropagation()}>
                              <InputMoeda
                                value={valoresLiquidos[p.id] || 0}
                                onChange={(v) => setValoresLiquidos(prev => ({ ...prev, [p.id]: v }))}
                                disabled={isPago}
                                className="text-right"
                              />
                            </td>
                            <td className="px-4 py-2.5 text-center min-w-[140px] align-middle" onClick={(e) => e.stopPropagation()}>
                              <div className="relative">
                                <Calendar size={12} className="absolute left-2.5 top-2.5 text-faint pointer-events-none" />
                                <input
                                  type="date"
                                  disabled={isPago}
                                  value={datasRecebimento[p.id] || ''}
                                  onChange={e => setDatasRecebimento({ ...datasRecebimento, [p.id]: e.target.value })}
                                  className="w-full pl-7 pr-1 h-9 bg-surface-2 border border-subtle rounded-[8px] font-bold text-[11px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all uppercase disabled:opacity-50 disabled:bg-transparent text-main"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                              {!isPago ? (
                                <button
                                  onClick={async () => {
                                    try {
                                      await financeiroService.registrarPagamento(p.id, valoresLiquidos[p.id], datasRecebimento[p.id]);
                                      await carregarDados();
                                    } catch (e) {
                                      toast.error("Erro ao baixar parcela.");
                                    }
                                  }}
                                  className="text-[#0b0e14] font-bold text-[10px] uppercase tracking-wider bg-primary hover:opacity-90 px-3 h-8 rounded-[8px] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)] ml-auto"
                                >
                                  Baixar
                                </button>
                              ) : (
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">Conciliado</span>
                                  <span className="text-[10px] font-bold text-faint uppercase tracking-wider block">{formatarData(p.data_pagamento)}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}

        {parcelasFiltradas.length === 0 && !loading && (
          <div className="py-40 text-center space-y-4">
            <div className="h-16 w-16 bg-surface-2 rounded-2xl mx-auto flex items-center justify-center text-faint">
              <Filter size={32} />
            </div>
            <p className="text-faint font-black uppercase text-xs tracking-widest">Nenhum recebível encontrado para os filtros.</p>
          </div>
        )}
      </div>

      {/* Barra de ação fixa — baixa em lote */}
      {selecionadas.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
          <div className="flex items-center gap-4 bg-surface-2 border border-strong rounded-xl shadow-[var(--shadow-float)] pl-5 pr-2 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-semibold text-main">{selecionadas.length} selecionada(s)</span>
              <span className="text-[13px] text-muted">·</span>
              <span className="text-[14px] font-bold text-primary">{formatarMoeda(totalSelecionadoLiquido)}</span>
            </div>
            <button onClick={() => setSelecionadas([])} className="text-[12px] font-medium text-faint hover:text-main transition-colors px-2">Limpar</button>
            <Button variant="primary" size="md" onClick={() => setIsConfirmModalOpen(true)} type="button">
              Baixar seleção
            </Button>
          </div>
        </div>
      )}

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => !processing && setIsConfirmModalOpen(false)}
        title="Confirmar Conciliação em Lote"
        size="md"
      >
        <div className="space-y-6">
          <div className="p-5 rounded-xl flex items-start gap-4 border border-subtle" style={{ backgroundColor: 'rgba(16,185,129,0.08)' }}>
            <AlertTriangle className="text-primary shrink-0" size={22} />
            <div>
              <p className="text-[13px] font-semibold text-main">Validação de segurança</p>
              <p className="text-[13px] text-muted leading-relaxed mt-1">
                Você está prestes a liquidar múltiplas parcelas simultaneamente. Esta ação registrará as receitas no fluxo de caixa real.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-2 p-5 rounded-xl border border-subtle">
              <span className="text-[11px] font-medium text-faint block mb-1">Total de parcelas</span>
              <p className="text-[24px] font-bold text-main leading-none">{selecionadas.length}</p>
            </div>
            <div className="bg-surface-2 p-5 rounded-xl border border-subtle">
              <span className="text-[11px] font-medium text-faint block mb-1">Receita líquida</span>
              <p className="text-[24px] font-bold text-primary leading-none">{formatarMoeda(totalSelecionadoLiquido)}</p>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              disabled={processing}
              onClick={() => setIsConfirmModalOpen(false)}
              className="flex-1 h-[40px] font-semibold text-muted text-[13px] border border-subtle rounded-lg hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <Button
              onClick={handleBaixaMassiva}
              isLoading={processing}
              className="flex-1 h-[40px] uppercase text-[11px] tracking-widest shadow-sm rounded-lg"
            >
              Confirmar Baixa
            </Button>
          </div>
        </div>
      </Modal>

      <ConciliacaoOcrDrawer
        open={isOcrDrawerOpen}
        onClose={() => setIsOcrDrawerOpen(false)}
        onConcluido={carregarDados}
      />
    </div>
  );
};

export default ConciliacaoPage;
