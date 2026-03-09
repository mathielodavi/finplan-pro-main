
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { financeiroService, Parcela } from '../services/financeiroService';
import { formatarMoeda, formatarData } from '../utils/formatadores';
import Card from '../components/UI/Card';
import Badge from '../components/UI/Badge';
import Button from '../components/UI/Button';
import Modal from '../components/Modal';
import { CheckCircle2, Search, ArrowUpRight, CheckSquare, Square, History, CalendarDays, Calendar, AlertTriangle, Filter } from 'lucide-react';

const ConciliacaoPage: React.FC = () => {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [valoresLiquidos, setValoresLiquidos] = useState<Record<string, number>>({});
  const [datasRecebimento, setDatasRecebimento] = useState<Record<string, string>>({});
  const [buscaNome, setBuscaNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
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
      alert(`Sucesso! ${selecionadas.length} parcelas foram conciliadas.`);
      await carregarDados();
    } catch (err: any) {
      console.error("Erro no processamento de lote:", err);
      alert("Houve um erro ao processar a baixa.");
    } finally {
      setProcessing(false);
    }
  }, [selecionadas, valoresLiquidos, datasRecebimento, carregarDados, processing]);

  const handleMascaraLiquido = (id: string, rawValue: string) => {
    const cleanValue = rawValue.replace(/\D/g, "");
    const numeric = parseInt(cleanValue || "0") / 100;
    setValoresLiquidos(prev => ({ ...prev, [id]: numeric }));
  };

  const labelMesAno = (key: string) => {
    const [ano, mes] = key.split('-');
    const nomes = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
    return `${nomes[parseInt(mes) - 1]} / ${ano}`;
  };

  return (
    <div className="animate-fade-in max-w-[1400px] mx-auto pb-20 px-4 lg:px-8">
      <div className="sticky top-0 z-30 bg-[#f8fafc] pt-8 pb-8 border-b border-slate-200 shadow-sm mb-8 -mx-4 px-4 lg:-mx-8 lg:px-8">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative group flex-1 min-w-[200px] lg:flex-none">
              <Search className="absolute left-4 top-3 h-4 w-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={buscaNome}
                onChange={e => setBuscaNome(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="flex bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-10 items-center px-1 gap-1">
              <select
                value={filtro.status}
                onChange={e => setFiltro({ ...filtro, status: e.target.value as any })}
                className="bg-transparent font-black text-[9px] uppercase tracking-widest outline-none text-slate-500 px-3 py-1 hover:text-emerald-600 transition-colors"
              >
                <option value="pendente">Abertos</option>
                <option value="pago">Conciliados</option>
                <option value="todos">Todos</option>
              </select>
              <div className="w-px h-4 bg-slate-100 mx-1" />
              <select
                value={filtro.tipo}
                onChange={e => setFiltro({ ...filtro, tipo: e.target.value as any })}
                className="bg-transparent font-black text-[9px] uppercase tracking-widest outline-none text-slate-500 px-3 py-1 hover:text-emerald-600 transition-colors"
              >
                <option value="todos">Todos Tipos</option>
                <option value="planejamento">Planejamento</option>
                <option value="extra">Extras</option>
              </select>
            </div>

            <div className="flex bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <select
                value={filtro.mes}
                onChange={e => setFiltro({ ...filtro, mes: parseInt(e.target.value) })}
                className="bg-transparent font-black text-[10px] uppercase tracking-widest outline-none text-slate-700 px-4 py-2.5 border-r border-slate-100"
              >
                {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={filtro.ano}
                onChange={e => setFiltro({ ...filtro, ano: parseInt(e.target.value) })}
                className="bg-transparent font-black text-[10px] uppercase tracking-widest outline-none text-slate-700 px-4 py-2.5"
              >
                {[2024, 2025, 2026, 2027].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setFiltro({ ...filtro, apenasAbertos: !filtro.apenasAbertos })}
              className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 border transition-all ${filtro.apenasAbertos ? 'bg-amber-600 text-white border-amber-700 shadow-md' : 'bg-white text-slate-400 border-slate-200'
                }`}
            >
              <History size={12} />
              {filtro.apenasAbertos ? 'Ver Atrasados' : 'Mês Fixo'}
            </button>
          </div>

          <div className="flex-shrink-0">
            {selecionadas.length > 0 && (
              <Button
                variant="primary"
                className="px-6 py-2.5 shadow-lg shadow-emerald-500/20 animate-slide-up rounded-xl"
                onClick={() => setIsConfirmModalOpen(true)}
                type="button"
              >
                Baixar Seleção R$ {totalSelecionadoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({selecionadas.length})
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col hover:bg-slate-50 transition-colors">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-4">
              Receita Prevista (Líquida)
            </span>
            <div className="flex justify-between items-end mt-auto">
              <p className="text-xl 2xl:text-2xl font-black text-slate-900 tracking-tighter break-words xl:truncate">
                {formatarMoeda(resumo.previsto)}
              </p>
              <div className="p-2 rounded-xl transition-colors bg-emerald-50 text-emerald-600">
                <CalendarDays size={18} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className={`border p-5 rounded-2xl shadow-sm flex flex-col transition-all duration-300 ${selecionadas.length > 0 ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-100'}`}>
            <span className={`text-[9px] font-black uppercase tracking-widest block leading-none mb-4 ${selecionadas.length > 0 ? 'text-emerald-100' : 'text-slate-400'}`}>
              Líquido em Seleção
            </span>
            <div className="flex justify-between items-end mt-auto">
              <p className={`text-xl 2xl:text-2xl font-black tracking-tighter break-words xl:truncate ${selecionadas.length > 0 ? 'text-white' : 'text-slate-900'}`}>
                {formatarMoeda(totalSelecionadoLiquido)}
              </p>
              <div className={`p-2 rounded-xl transition-colors ${selecionadas.length > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-500'}`}>
                <CheckSquare size={18} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col hover:bg-slate-50 transition-colors">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-4">
              Liquidação Acumulada
            </span>
            <div className="flex justify-between items-end mt-auto">
              <p className="text-xl 2xl:text-2xl font-black text-slate-900 tracking-tighter break-words xl:truncate">
                {formatarMoeda(resumo.realizado)}
              </p>
              <div className="p-2 rounded-xl transition-colors bg-blue-50 text-blue-600">
                <ArrowUpRight size={18} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex flex-col hover:bg-slate-50 transition-colors">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-4">
              Saldo a Conciliar
            </span>
            <div className="flex justify-between items-end mt-auto">
              <p className="text-xl 2xl:text-2xl font-black text-slate-900 tracking-tighter break-words xl:truncate">
                {formatarMoeda(resumo.previsto - resumo.realizado)}
              </p>
              <div className="p-2 rounded-xl transition-colors bg-rose-50 text-rose-600">
                <AlertTriangle size={18} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8 pt-4">
        {parcelasAgrupadas.map(([periodoKey, lista]) => {
          const editaveisNoGrupo = lista.filter(p => p.status !== 'pago').map(p => p.id);
          const todosSelecionadosNoGrupo = editaveisNoGrupo.length > 0 && editaveisNoGrupo.every(id => selecionadas.includes(id));

          return (
            <div key={periodoKey} className="space-y-6">
              <div className="flex items-center gap-4 bg-slate-100/50 p-4 rounded-2xl border-l-4 border-slate-900 w-fit">
                <CalendarDays size={18} className="text-slate-900" />
                <span className="text-sm font-black text-slate-900 uppercase tracking-wider">{labelMesAno(periodoKey)}</span>
                <Badge variant="neutral" size="sm">{lista.length} Parcelas</Badge>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden transition-all">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-6 w-20 text-center">
                          {editaveisNoGrupo.length > 0 && (
                            <button
                              onClick={() => selecionarGrupo(lista)}
                              className={`p-2 transition-colors ${todosSelecionadosNoGrupo ? 'text-emerald-600' : 'text-slate-300 hover:text-emerald-600'}`}
                            >
                              {todosSelecionadosNoGrupo ? <CheckSquare size={22} strokeWidth={2.5} /> : <Square size={22} strokeWidth={2.5} />}
                            </button>
                          )}
                        </th>
                        <th className="px-4 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Cliente / Acordo</th>
                        <th className="px-4 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Vencimento</th>
                        <th className="px-4 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Líquido Previsto</th>
                        <th className="px-4 py-6 text-[10px] font-black uppercase text-emerald-600 tracking-widest text-right">Líquido Recebido</th>
                        <th className="px-4 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Recebimento</th>
                        <th className="px-8 py-6 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {lista.map(p => {
                        const fatorRepasse = (p.contratos?.repasse_percentual || 100) / 100;
                        const esperadoLiquido = p.valor_previsto * fatorRepasse;
                        const isSelecionada = selecionadas.includes(p.id);
                        const isPago = p.status === 'pago';

                        return (
                          <tr key={p.id} className={`group transition-all ${isPago ? 'bg-slate-50/20' : isSelecionada ? 'bg-emerald-50/40' : 'hover:bg-slate-50/50'}`}>
                            <td className="px-6 py-6 text-center">
                              {!isPago ? (
                                <button onClick={() => toggleSelecao(p.id)} className={`p-2 transition-colors ${isSelecionada ? 'text-emerald-600' : 'text-slate-300 hover:text-emerald-400'}`}>
                                  {isSelecionada ? <CheckSquare size={20} /> : <Square size={20} />}
                                </button>
                              ) : (
                                <div className="p-2 text-emerald-500 opacity-40 mx-auto"><CheckCircle2 size={20} /></div>
                              )}
                            </td>
                            <td className="px-4 py-6">
                              <div className="flex items-center gap-2">
                                <span className={`w-1 h-6 rounded-full ${p.contratos?.tipo === 'planejamento' ? 'bg-blue-400' : 'bg-amber-400'}`} />
                                <div>
                                  <p className="font-black text-slate-800 text-[13px] tracking-tight uppercase leading-none">{p.clientes?.nome}</p>
                                  <span className="text-[11px] text-slate-400 font-bold uppercase mt-2 block italic">{p.contratos?.descricao}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-6 font-bold text-slate-500 text-center text-[13px]">
                              {formatarData(p.data_vencimento)}
                            </td>
                            <td className="px-4 py-6 text-right">
                              <div className="flex flex-col items-end">
                                <p className="font-black text-slate-400 text-[13px] leading-none">{formatarMoeda(esperadoLiquido)}</p>
                                <span className="text-[10px] font-bold text-slate-300 uppercase mt-1 tracking-tighter">
                                  Base Bruta: {formatarMoeda(p.valor_previsto)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-6 text-right min-w-[180px]">
                              <div className="relative group/input">
                                <span className="absolute left-3 top-3 text-[10px] font-black text-slate-300 group-focus-within/input:text-emerald-500">R$</span>
                                <input
                                  type="text"
                                  disabled={isPago}
                                  value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(valoresLiquidos[p.id] || 0)}
                                  onChange={(e) => handleMascaraLiquido(p.id, e.target.value)}
                                  className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-black text-right text-emerald-700 outline-none focus:bg-white focus:border-emerald-500 transition-all text-[13px] disabled:opacity-40 disabled:bg-transparent"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-6 text-center min-w-[150px]">
                              <div className="relative">
                                <Calendar size={14} className="absolute left-3 top-2.5 text-slate-300 pointer-events-none" />
                                <input
                                  type="date"
                                  disabled={isPago}
                                  value={datasRecebimento[p.id] || ''}
                                  onChange={e => setDatasRecebimento({ ...datasRecebimento, [p.id]: e.target.value })}
                                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-[11px] outline-none focus:bg-white focus:border-emerald-500 transition-all uppercase disabled:opacity-40 disabled:bg-transparent"
                                />
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              {!isPago ? (
                                <button
                                  onClick={async () => {
                                    try {
                                      await financeiroService.registrarPagamento(p.id, valoresLiquidos[p.id], datasRecebimento[p.id]);
                                      await carregarDados();
                                    } catch (e) {
                                      alert("Erro ao baixar parcela.");
                                    }
                                  }}
                                  className="text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-xl border border-emerald-100 transition-all shadow-sm"
                                >
                                  Baixar
                                </button>
                              ) : (
                                <div className="flex flex-col items-end">
                                  <span className="text-[11px] font-black text-emerald-600 uppercase tracking-tighter">Conciliado</span>
                                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{formatarData(p.data_pagamento)}</span>
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
            <div className="h-16 w-16 bg-slate-50 rounded-2xl mx-auto flex items-center justify-center text-slate-200">
              <Filter size={32} />
            </div>
            <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Nenhum recebível encontrado para os filtros.</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => !processing && setIsConfirmModalOpen(false)}
        title="Confirmar Conciliação em Lote"
        size="md"
      >
        <div className="space-y-8">
          <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-start gap-4">
            <AlertTriangle className="text-emerald-600 shrink-0" size={24} />
            <div>
              <p className="text-sm font-black text-emerald-900 uppercase">Validação de Segurança</p>
              <p className="text-xs text-emerald-700 font-medium leading-relaxed mt-1">
                Você está prestes a liquidar múltiplas parcelas simultaneamente. Esta ação registrará as receitas no fluxo de caixa real.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total de Parcelas</span>
              <p className="text-2xl font-black text-slate-900">{selecionadas.length}</p>
            </div>
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Receita Líquida</span>
              <p className="text-xl font-black text-emerald-600">{formatarMoeda(totalSelecionadoLiquido)}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              disabled={processing}
              onClick={() => setIsConfirmModalOpen(false)}
              className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest"
            >
              Cancelar
            </button>
            <Button
              onClick={handleBaixaMassiva}
              isLoading={processing}
              className="flex-1 py-4 uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-emerald-500/20"
            >
              Confirmar Baixa
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ConciliacaoPage;
