
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { acompanhamentoService } from '../../services/acompanhamentoService';
import { configService } from '../../services/configuracoesService';
import Modal from '../Modal';
import Accordion from '../UI/Accordion';
import { CheckCircle2, ListChecks, Plus, Trash2, Activity, AlertCircle, Circle, Copy } from 'lucide-react';

interface AbaAtendimentoProps {
  clienteId: string;
}

const AbaAtendimento: React.FC<AbaAtendimentoProps> = ({ clienteId }) => {
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalManual, setModalManual] = useState(false);
  const [modalModelo, setModalModelo] = useState(false);
  const [modelos, setModelos] = useState<any[]>([]);
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState('');
  const [aplicandoModelo, setAplicandoModelo] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [novoItem, setNovoItem] = useState({ descricao: '', fase_id: null as string | null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const it = await acompanhamentoService.getItensCliente(clienteId);
      setItens(it || []);
    } catch (err) {
      console.error("Erro ao carregar checklist:", err);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (id: string, concluido: boolean) => {
    try {
      await acompanhamentoService.atualizarStatus(id, !concluido);
      setItens(prev => prev.map(item => item.id === id ? { ...item, concluido: !concluido } : item));
    } catch (err) {
      loadData();
    }
  };

  const handleExcluir = async (id: string) => {
    setDeleteTarget(id);
  };

  const confirmarExclusao = async () => {
    if (!deleteTarget) return;
    try {
      await acompanhamentoService.excluirItem(deleteTarget);
      setItens(prev => prev.filter(item => item.id !== deleteTarget));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Erro ao excluir item:', err);
    }
  };

  const handleAbrirModelo = async () => {
    try {
      const lista = await configService.getAcompanhamentos();
      setModelos(lista || []);
      setModalModelo(true);
    } catch { setModelos([]); }
  };

  const handleAplicarModelo = async () => {
    if (!modeloSelecionadoId) return;
    setAplicandoModelo(true);
    try {
      const modelo = modelos.find(m => m.id === modeloSelecionadoId);
      if (!modelo) return;
      const todasFases = modelo.fases || [];
      for (const fase of todasFases) {
        for (const item of fase.itens || []) {
          await acompanhamentoService.adicionarItemManual({
            descricao: item.descricao,
            fase_id: fase.id,
            cliente_id: clienteId,
            ordem: item.ordem ?? 0,
          });
        }
      }
      setModalModelo(false);
      setModeloSelecionadoId('');
      loadData();
    } catch (err: any) {
      console.error('Erro ao aplicar modelo:', err);
    } finally {
      setAplicandoModelo(false);
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoItem.descricao.trim()) return;
    try {
      await acompanhamentoService.adicionarItemManual({
        ...novoItem,
        cliente_id: clienteId,
        ordem: itens.length + 1
      });
      setModalManual(false);
      setNovoItem({ descricao: '', fase_id: null });
      loadData();
    } catch (err: any) {
      console.error('Erro ao adicionar tarefa:', err);
    }
  };

  // Agrupamento de itens por fase
  const groupedTasks = useMemo(() => {
    const groups: Record<string, { nome: string, items: any[] }> = {};

    itens.forEach(it => {
      const faseId = it.fase_id || 'avulso';
      const faseNome = it.fase?.nome_fase || 'Atividades Complementares';

      if (!groups[faseId]) {
        groups[faseId] = { nome: faseNome, items: [] };
      }
      groups[faseId].items.push(it);
    });

    return Object.entries(groups).sort((a, b) => {
      if (a[0] === 'avulso') return 1;
      if (b[0] === 'avulso') return -1;
      return 0; // Idealmente usaria a ordem da fase se disponível no objeto it.fase
    });
  }, [itens]);

  const total = itens.length;
  const concluidos = itens.filter(i => i.concluido).length;
  const percentualGlobal = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header KPI Minimalista */}
      <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl flex flex-col sm:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="relative z-10 text-center sm:text-left">
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] block mb-2">Execução Metodológica</span>
          <p className="text-2xl font-black">{percentualGlobal}% <span className="text-[10px] text-slate-500 uppercase tracking-widest ml-2">Geral Concluído</span></p>
        </div>
        <div className="relative z-10 w-full sm:w-64">
          <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-500 mb-2">
            <span>Pendente: {total - concluidos}</span>
            <span>Total: {total}</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.4)]" style={{ width: `${percentualGlobal}%` }} />
          </div>
        </div>
        <Activity size={120} className="absolute -bottom-10 -right-10 text-white/5 pointer-events-none" />
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-3">
            <ListChecks size={16} className="text-slate-400" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fluxo de Atendimento</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAbrirModelo} className="flex items-center gap-2 text-slate-500 font-black text-[9px] uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl hover:bg-slate-100 transition-all">
              <Copy size={12} strokeWidth={3} /> Aplicar Modelo
            </button>
            <button onClick={() => setModalManual(true)} className="flex items-center gap-2 text-emerald-600 font-black text-[9px] uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
              <Plus size={12} strokeWidth={4} /> Atividade Avulsa
            </button>
          </div>
        </div>

        {loading && itens.length === 0 ? (
          <div className="py-20 text-center text-slate-300 font-black uppercase text-[10px] animate-pulse">Sincronizando cronograma...</div>
        ) : itens.length === 0 ? (
          <div className="py-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
            <ListChecks size={32} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Nenhum roteiro vinculado</p>
            <p className="text-slate-300 text-[9px] mt-2 font-bold uppercase">Selecione uma metodologia na aba Estratégia para iniciar.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedTasks.map(([faseId, group]) => {
              const faseTotal = group.items.length;
              const faseConcluidos = group.items.filter(i => i.concluido).length;
              const fasePerc = Math.round((faseConcluidos / faseTotal) * 100);

              return (
                <Accordion
                  key={faseId}
                  title={group.nome}
                  subtitle={`${faseConcluidos} de ${faseTotal} tarefas liquidadas (${fasePerc}%)`}
                  defaultOpen={fasePerc < 100}
                >
                  <div className="space-y-2 mt-2">
                    {group.items.map((it: any) => (
                      <div key={it.id} className={`group flex items-center justify-between p-4 rounded-2xl border transition-all ${it.concluido ? 'bg-slate-50/50 border-transparent opacity-60' : 'bg-white border-slate-100 hover:border-emerald-200'}`}>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => handleToggle(it.id, it.concluido)}
                            className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all ${it.concluido ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-50 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
                          >
                            {it.concluido ? <CheckCircle2 size={16} strokeWidth={3} /> : <Circle size={16} strokeWidth={3} />}
                          </button>
                          <p className={`text-sm font-bold tracking-tight ${it.concluido ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{it.descricao}</p>
                        </div>
                        <button
                          onClick={() => handleExcluir(it.id)}
                          className="p-2 text-slate-200 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                          title="Remover apenas deste cliente"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </Accordion>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmação de exclusão inline */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 max-w-sm w-full text-center space-y-6">
            <p className="text-xs font-black text-slate-700 uppercase tracking-wide">Remover esta tarefa deste cliente?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 font-black text-slate-400 border border-slate-200 rounded-2xl text-[10px] uppercase">Cancelar</button>
              <button onClick={confirmarExclusao} className="flex-1 py-3 font-black text-white bg-rose-500 rounded-2xl text-[10px] uppercase hover:bg-rose-600 transition-all">Remover</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aplicar Modelo */}
      <Modal isOpen={modalModelo} onClose={() => setModalModelo(false)} title="Aplicar Modelo de Checklist">
        <div className="space-y-6">
          <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed">Selecione um modelo de acompanhamento para copiar todas as suas tarefas para este cliente.</p>
          <div>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Modelo</label>
            <select
              value={modeloSelecionadoId}
              onChange={e => setModeloSelecionadoId(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none text-xs"
            >
              <option value="">-- Selecionar modelo --</option>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            {modelos.length === 0 && <p className="text-[10px] text-amber-500 font-bold mt-1">Nenhum modelo cadastrado. Configure em Configurações.</p>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setModalModelo(false)} className="flex-1 py-3 font-black text-slate-400 border border-slate-100 rounded-2xl text-[10px] uppercase">Cancelar</button>
            <button onClick={handleAplicarModelo} disabled={!modeloSelecionadoId || aplicandoModelo} className="flex-1 py-3 font-black text-white bg-slate-900 rounded-2xl text-[10px] uppercase disabled:opacity-50">
              {aplicandoModelo ? 'Aplicando...' : 'Aplicar Modelo'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modalManual} onClose={() => setModalManual(false)} title="Adicionar Atividade Customizada">
        <form onSubmit={handleAddManual} className="space-y-6">
          <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100 flex items-start gap-4">
            <AlertCircle className="text-emerald-600 mt-0.5" size={18} />
            <p className="text-[10px] text-emerald-700 font-bold uppercase leading-relaxed">As tarefas manuais permitem personalizar o atendimento conforme as necessidades exclusivas de cada cliente.</p>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Descrição do Item</label>
            <input
              type="text"
              required
              autoFocus
              value={novoItem.descricao}
              onChange={e => setNovoItem({ ...novoItem, descricao: e.target.value })}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-600 transition-all text-sm"
              placeholder="Ex: Solicitar extrato de previdência complementar"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModalManual(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px]">Cancelar</button>
            <button type="submit" className="flex-1 py-4 font-black text-white uppercase text-[10px] bg-slate-900 rounded-xl shadow-lg hover:bg-slate-800 transition-all">Confirmar Tarefa</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AbaAtendimento;
