
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
  const [excluindo, setExcluindo] = useState(false);
  const [salvandoManual, setSalvandoManual] = useState(false);
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
    setExcluindo(true);
    try {
      await acompanhamentoService.excluirItem(deleteTarget);
      setItens(prev => prev.filter(item => item.id !== deleteTarget));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Erro ao excluir item:', err);
    } finally {
      setExcluindo(false);
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
    setSalvandoManual(true);
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
    } finally {
      setSalvandoManual(false);
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
      <div className="bg-surface-3 p-6 rounded-[12px] text-white shadow-[var(--shadow-card)] flex flex-col sm:flex-row justify-between items-center gap-6 relative overflow-hidden">
        <div className="relative z-10 text-center sm:text-left">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest block mb-2">Execução Metodológica</span>
          <p className="text-2xl font-bold">{percentualGlobal}% <span className="text-[11px] font-medium text-faint uppercase tracking-widest ml-2">Geral Concluído</span></p>
        </div>
        <div className="relative z-10 w-full sm:w-64">
          <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-muted mb-2">
            <span>Pendente: {total - concluidos}</span>
            <span>Total: {total}</span>
          </div>
          <div className="h-1.5 bg-surface/5 rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.4)]" style={{ width: `${percentualGlobal}%` }} />
          </div>
        </div>
        <Activity size={120} className="absolute -bottom-10 -right-10 text-white/5 pointer-events-none" />
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center bg-surface p-4 rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] border border-subtle">
          <div className="flex items-center gap-2">
            <ListChecks size={16} className="text-emerald-500" />
            <h3 className="text-[11px] font-bold text-faint uppercase tracking-wider">Fluxo de Atendimento</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleAbrirModelo} className="flex items-center justify-center gap-2 text-muted font-bold text-[10px] uppercase tracking-wider bg-surface-2 px-3 h-8 rounded-[8px] hover:bg-surface-2 transition-all border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <Copy size={12} /> Aplicar Modelo
            </button>
            <button onClick={() => setModalManual(true)} className="flex items-center justify-center gap-2 font-semibold text-[12px] px-3 h-8 rounded-lg transition-all text-[color:var(--primary)] bg-[rgba(16,185,129,0.12)] hover:bg-[rgba(16,185,129,0.2)]">
              <Plus size={14} /> Atividade Avulsa
            </button>
          </div>
        </div>

        {loading && itens.length === 0 ? (
          <div className="py-20 text-center text-[color:var(--text-muted)] font-semibold uppercase text-[11px] animate-pulse">Sincronizando cronograma...</div>
        ) : itens.length === 0 ? (
          <div className="py-16 text-center bg-surface-2 border border-dashed border-[color:var(--border)] rounded-[12px]">
            <ListChecks size={32} className="mx-auto text-faint mb-4" />
            <p className="text-[color:var(--text-muted)] font-semibold uppercase text-[12px] tracking-widest">Nenhum roteiro vinculado</p>
            <p className="text-faint text-[11px] mt-2 font-medium uppercase">Selecione uma metodologia na aba Estratégia para iniciar.</p>
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
                      <div key={it.id} className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${it.concluido ? 'bg-surface-2 border-subtle opacity-60' : 'bg-surface border-subtle hover:border-emerald-300 shadow-[0_1px_2px_rgba(0,0,0,0.05)]'}`}>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleToggle(it.id, it.concluido)}
                            className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${it.concluido ? 'bg-emerald-500 text-white shadow-sm' : 'bg-surface-2 text-faint hover:text-emerald-500 hover:bg-emerald-50 border border-subtle'}`}
                          >
                            {it.concluido ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                          </button>
                          <p className={`text-[13px] font-bold tracking-tight leading-none ${it.concluido ? 'text-faint line-through' : 'text-main'}`}>{it.descricao}</p>
                        </div>
                        <button
                          onClick={() => handleExcluir(it.id)}
                          className="h-7 w-7 flex items-center justify-center text-faint hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all opacity-20 group-hover:opacity-100"
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
        <div className="fixed inset-0 bg-surface-3/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-8 shadow-2xl border border-subtle max-w-sm w-full text-center space-y-6">
            <p className="text-[13px] font-semibold text-main">Remover esta tarefa deste cliente?</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 font-semibold text-muted border border-subtle rounded-xl text-[12px]">Cancelar</button>
              <button onClick={confirmarExclusao} disabled={excluindo} className="flex-1 py-3 font-semibold text-white bg-[color:var(--danger)] rounded-xl text-[12px] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">{excluindo ? 'Removendo...' : 'Remover'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aplicar Modelo */}
      <Modal isOpen={modalModelo} onClose={() => setModalModelo(false)} title="Aplicar Modelo de Checklist">
        <div className="space-y-6">
          <p className="text-[12px] text-[color:var(--text-muted)] font-medium">Selecione um modelo de acompanhamento para copiar todas as suas tarefas para este cliente.</p>
          <div>
            <label className="block text-[12px] font-semibold text-[color:var(--text-muted)] mb-1.5 ml-1">Modelo</label>
            <select
              value={modeloSelecionadoId}
              onChange={e => setModeloSelecionadoId(e.target.value)}
              className="w-full h-[36px] px-3 bg-surface border border-subtle rounded-lg text-[13px] font-medium text-main outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
            >
              <option value="">-- Selecionar modelo --</option>
              {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
            {modelos.length === 0 && <p className="text-[11px] text-amber-600 font-medium mt-1">Nenhum modelo cadastrado. Configure em Configurações.</p>}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalModelo(false)} className="flex-1 h-[40px] font-semibold text-muted bg-surface-2 hover:bg-surface-2 rounded-lg text-[13px] transition-colors border border-subtle">Cancelar</button>
            <button onClick={handleAplicarModelo} disabled={!modeloSelecionadoId || aplicandoModelo} className="flex-1 h-[40px] font-semibold text-white bg-surface-3 rounded-lg text-[13px] hover:bg-strong transition-colors disabled:opacity-50">
              {aplicandoModelo ? 'Aplicando...' : 'Aplicar Modelo'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={modalManual} onClose={() => setModalManual(false)} title="Adicionar Atividade Customizada">
        <form onSubmit={handleAddManual} className="space-y-6">
          <div className="p-4 rounded-xl border border-subtle flex items-start gap-4" style={{ backgroundColor: 'var(--primary-soft)' }}>
            <AlertCircle className="text-[color:var(--primary)] shrink-0" size={18} />
            <p className="text-[12px] text-muted font-medium">As tarefas manuais permitem personalizar o atendimento conforme as necessidades exclusivas de cada cliente.</p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[color:var(--text-muted)] mb-1.5 ml-1">Descrição do Item</label>
            <input
              type="text"
              required
              autoFocus
              value={novoItem.descricao}
              onChange={e => setNovoItem({ ...novoItem, descricao: e.target.value })}
              className="w-full h-[36px] px-3 bg-surface border border-subtle rounded-lg text-[13px] font-medium text-main outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all"
              placeholder="Ex: Solicitar extrato de previdência complementar"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModalManual(false)} className="flex-1 h-[40px] font-semibold text-muted hover:bg-surface-2 rounded-lg text-[13px] transition-colors border border-subtle">Cancelar</button>
            <button type="submit" disabled={salvandoManual} className="flex-1 h-[40px] font-semibold text-white bg-surface-3 rounded-lg text-[13px] shadow-sm hover:bg-strong disabled:opacity-50 disabled:cursor-not-allowed transition-all">{salvandoManual ? 'Salvando...' : 'Confirmar Tarefa'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AbaAtendimento;
