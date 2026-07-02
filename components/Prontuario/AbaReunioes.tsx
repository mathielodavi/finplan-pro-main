
import React, { useState, useEffect } from 'react';
import { reuniaoService, Reuniao } from '../../services/reuniaoService';
import { formatarData } from '../../utils/formatadores';
import Modal from '../Modal';
import Confirmacao from '../Confirmacao';
import { Calendar, CheckCircle2, XCircle, Clock, Search, MessageSquare, History, Edit3, Trash2, CalendarCheck, FileText } from 'lucide-react';
import Badge from '../UI/Badge';

interface AbaReunioesProps {
  clienteId: string;
  reunioes: Reuniao[];
  onRefresh: () => void;
}

const AbaReunioes: React.FC<AbaReunioesProps> = ({ clienteId, reunioes, onRefresh }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [reuniaoEdit, setReuniaoEdit] = useState<Partial<Reuniao> | null>(null);
  const [rawDate, setRawDate] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [acaoEmCurso, setAcaoEmCurso] = useState<string | null>(null);
  const [excluirTarget, setExcluirTarget] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [busca, setBusca] = useState('');

  /**
   * Converte uma string ISO ou Date para o formato YYYY-MM-DDTHH:mm
   * respeitando o fuso horário de Brasília para exibição correta no input.
   */
  const formatToInput = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    // O locale sv-SE retorna naturalmente YYYY-MM-DD HH:mm:ss, perfeito para datetime-local
    const bsb = date.toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" })
                   .replace(' ', 'T')
                   .substring(0, 16);
    return bsb;
  };

  useEffect(() => {
    if (modalOpen && reuniaoEdit) {
      if (reuniaoEdit.data_reuniao) {
        setRawDate(formatToInput(reuniaoEdit.data_reuniao));
      } else {
        // Para novos registros, inicializa com o horário "facial" de Brasília agora
        const agoraBsb = new Date().toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" })
                                   .replace(' ', 'T')
                                   .substring(0, 16);
        setRawDate(agoraBsb);
      }
    }
  }, [modalOpen, reuniaoEdit]);

  const agendadas = reunioes
    .filter(r => r.status === 'agendada')
    .sort((a, b) => new Date(a.data_reuniao).getTime() - new Date(b.data_reuniao).getTime());
  
  const historico = reunioes
    .filter(r => r.status !== 'agendada' && (
      (r.notas?.toLowerCase().includes(busca.toLowerCase()) || formatarData(r.data_reuniao, true).includes(busca))
    ))
    .sort((a, b) => new Date(b.data_reuniao).getTime() - new Date(a.data_reuniao).getTime());

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawDate) return alert("A data é obrigatória.");
    
    setLoading(true);
    try {
      // O valor do input está no formato YYYY-MM-DDTHH:mm representando Brasília
      const dateParts = rawDate.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!dateParts) throw new Error("Formato de data inválido. Use AAAA-MM-DD HH:MM");

      const [_, y, m, d, h, min] = dateParts;
      // Reconstruímos a string ISO forçando o offset de Brasília (-03:00)
      const isoWithOffset = `${y}-${m}-${d}T${h}:${min}:00-03:00`;
      const dateToSave = new Date(isoWithOffset);

      if (isNaN(dateToSave.getTime())) {
        throw new Error("Falha ao converter data e horário. Verifique os valores informados.");
      }

      // Removemos campos de auditoria que podem estar no objeto reuniaoEdit
      const { criado_em, ...dadosLimpos } = reuniaoEdit as any;
      
      await reuniaoService.salvar({ 
        ...dadosLimpos, 
        data_reuniao: dateToSave.toISOString(), // Enviamos o UTC absoluto
        cliente_id: clienteId 
      });
      
      onRefresh();
      setModalOpen(false);
    } catch (err: any) {
      alert("Erro ao salvar: " + (err.message || "Tente novamente."));
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, status: Reuniao['status']) => {
    // Para ações rápidas, preservamos a data original para evitar fallback do banco para now()
    const original = reunioes.find(r => r.id === id);
    if (original) {
      setAcaoEmCurso(id);
      try {
        await reuniaoService.salvar({
            id: original.id,
            status,
            data_reuniao: original.data_reuniao,
            cliente_id: original.cliente_id,
            notas: original.notas
        });
        onRefresh();
      } catch (err) {
        alert("Erro ao atualizar status.");
      } finally {
        setAcaoEmCurso(null);
      }
    }
  };

  const confirmarExclusao = async () => {
    if (!excluirTarget) return;
    setExcluindo(true);
    try {
      await reuniaoService.excluir(excluirTarget);
      setExcluirTarget(null);
      onRefresh();
    } catch (err) {
      alert("Erro ao excluir.");
    } finally {
      setExcluindo(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'realizada': return <Badge variant="success" size="sm">REALIZADA</Badge>;
      case 'cancelada': return <Badge variant="danger" size="sm">CANCELADA</Badge>;
      case 'reagendada': return <Badge variant="info" size="sm">REAGENDADA</Badge>;
      default: return <Badge variant="neutral" size="sm">AGENDADA</Badge>;
    }
  };

  const labelStyle = "block text-[12px] font-semibold text-[color:var(--text-muted)] mb-1.5 ml-1";
  const inputStyle = "w-full h-[36px] px-3 bg-surface border border-subtle rounded-lg font-medium text-main outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all text-[13px]";

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Próximas Reuniões */}
      <section className="space-y-4">
        <div className="flex justify-between items-center bg-surface p-4 rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] border border-subtle">
           <div className="flex items-center gap-2">
              <Calendar size={16} className="text-indigo-500" />
              <h3 className="text-[11px] font-bold text-faint uppercase tracking-wider">Próximos Agendamentos</h3>
           </div>
           <button 
             onClick={() => {
               setReuniaoEdit({ status: 'agendada', notas: '' });
               setModalOpen(true);
             }}
             className="h-8 px-3 font-semibold text-[12px] flex items-center justify-center rounded-lg transition-all text-[color:var(--info)] bg-[rgba(96,165,250,0.12)] hover:bg-[rgba(96,165,250,0.2)]"
           >
             + Agendar Reunião
           </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {agendadas.length === 0 ? (
             <div className="col-span-2 py-6 bg-surface-2 border border-dashed border-subtle rounded-xl text-center">
                <Clock size={16} className="mx-auto text-faint mb-2" />
                <p className="text-faint font-bold uppercase text-[10px] tracking-wider">Sem compromissos pendentes</p>
             </div>
           ) : agendadas.map(r => (
             <div key={r.id} className="p-4 bg-surface border border-subtle rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] flex justify-between items-center group hover:border-indigo-300 hover:shadow-[0_2px_4px_rgba(99,102,241,0.1)] transition-all">
                <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-lg flex items-center justify-center font-bold text-[14px] text-[color:var(--info)] bg-[rgba(96,165,250,0.12)]">
                      {formatarData(r.data_reuniao).split('/')[0]}
                   </div>
                   <div>
                      <p className="text-[13px] font-bold text-main tracking-tight leading-none mb-1">{formatarData(r.data_reuniao, true)}</p>
                      <span className="text-[10px] font-bold text-faint uppercase tracking-wider block">Check-in agendado</span>
                   </div>
                </div>
                <div className="flex gap-1 opacity-20 group-hover:opacity-100 transition-all">
                   <button onClick={() => { setReuniaoEdit(r); setModalOpen(true); }} title="Editar Agendamento" className="h-7 w-7 flex items-center justify-center bg-surface-2 text-faint rounded-md hover:bg-surface-3 hover:text-muted transition-all"><Edit3 size={14} /></button>
                   <button onClick={() => handleAction(r.id!, 'realizada')} disabled={acaoEmCurso === r.id} title="Confirmar Realização" className="h-7 w-7 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"><CheckCircle2 size={14} /></button>
                   <button onClick={() => handleAction(r.id!, 'cancelada')} disabled={acaoEmCurso === r.id} title="Cancelar Reunião" className="h-7 w-7 flex items-center justify-center bg-rose-50 text-rose-600 rounded-md hover:bg-rose-500 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"><XCircle size={14} /></button>
                </div>
             </div>
           ))}
        </div>
      </section>

      {/* Histórico Timeline */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface p-4 rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] border border-subtle">
           <div className="flex items-center gap-2">
              <History size={16} className="text-faint" />
              <h3 className="text-[11px] font-bold text-faint uppercase tracking-wider">Cronologia de Interações</h3>
           </div>
           <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative group flex-1 sm:flex-none">
                 <input 
                   type="text" 
                   placeholder="Filtrar notas..." 
                   value={busca} 
                   onChange={e => setBusca(e.target.value)}
                   className="pl-9 pr-3 h-9 bg-surface-2 border border-subtle rounded-[8px] outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-surface focus:border-indigo-500 text-[12px] font-medium transition-all w-full sm:w-48 shadow-sm"
                 />
                 <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-faint group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <button 
                onClick={() => {
                  setReuniaoEdit({ status: 'realizada', notas: '' });
                  setModalOpen(true);
                }}
                className="font-semibold text-[12px] px-3 h-9 flex items-center justify-center rounded-lg transition-all whitespace-nowrap text-[color:var(--primary)] bg-[rgba(16,185,129,0.12)] hover:bg-[rgba(16,185,129,0.2)]"
              >
                + Registrar Histórico
              </button>
           </div>
        </div>

        <div className="relative pl-10 space-y-8 before:absolute before:left-4 before:top-0 before:bottom-0 before:w-0.5 before:bg-surface-3">
           {historico.length === 0 ? (
             <div className="py-8 text-center text-[color:var(--text-muted)] font-medium text-[11px] uppercase tracking-widest italic ml-4">Sem histórico de atividades recentes.</div>
           ) : historico.map(r => (
             <div key={r.id} className="relative group">
                <div className={`absolute -left-10 h-8 w-8 rounded-full border-4 border-surface flex items-center justify-center text-white shadow-sm transition-all group-hover:scale-110 z-10 ${
                  r.status === 'realizada' ? 'bg-emerald-500' : r.status === 'cancelada' ? 'bg-rose-500' : 'bg-indigo-500'
                }`}>
                   <MessageSquare size={12} />
                </div>
                
                <div className="bg-surface p-4 rounded-xl border border-subtle shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] group-hover:shadow-[0_2px_4px_rgba(99,102,241,0.1)] group-hover:border-indigo-200 transition-all">
                   <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                         <p className="text-[13px] font-bold text-main tracking-tight leading-none">{formatarData(r.data_reuniao, true)}</p>
                         {getStatusBadge(r.status)}
                      </div>
                      <div className="flex gap-0.5 opacity-20 group-hover:opacity-100 transition-all">
                        <button onClick={() => { setReuniaoEdit(r); setModalOpen(true); }} className="h-7 w-7 flex items-center justify-center text-faint hover:bg-surface-2 hover:text-indigo-600 rounded-md transition-colors"><Edit3 size={14} /></button>
                        <button onClick={() => setExcluirTarget(r.id!)} className="h-7 w-7 flex items-center justify-center text-faint hover:bg-surface-2 hover:text-rose-500 rounded-md transition-colors"><Trash2 size={14} /></button>
                      </div>
                   </div>
                   <div className={`p-3 rounded-lg border transition-colors ${r.status === 'realizada' ? 'bg-surface-2 border-subtle' : 'bg-surface-2/50 border-transparent opacity-60'}`}>
                      <p className="text-[13px] font-medium text-main leading-relaxed whitespace-pre-wrap">
                        {r.notas || 'Nenhuma nota tática registrada para esta interação.'}
                      </p>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={reuniaoEdit?.id ? "Editar Registro" : "Nova Interação"} size="lg">
         <form onSubmit={handleSalvar} className="space-y-8 animate-fade-in">
            {!reuniaoEdit?.id && (
              <div className="flex bg-surface-2 p-1 rounded-xl w-full border border-subtle">
                <button 
                  type="button" 
                  onClick={() => setReuniaoEdit({ ...reuniaoEdit, status: 'agendada' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${reuniaoEdit?.status === 'agendada' ? 'bg-surface text-indigo-600 shadow-sm' : 'text-faint hover:text-muted'}`}
                >
                  <CalendarCheck size={14} /> Agendamento
                </button>
                <button 
                  type="button" 
                  onClick={() => setReuniaoEdit({ ...reuniaoEdit, status: 'realizada' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${reuniaoEdit?.status === 'realizada' ? 'bg-surface text-emerald-600 shadow-sm' : 'text-faint hover:text-muted'}`}
                >
                  <FileText size={14} /> Histórico
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <label className={labelStyle}>Data e Horário</label>
                  <input 
                    type="datetime-local" 
                    required 
                    value={rawDate} 
                    onChange={e => setRawDate(e.target.value)}
                    className={inputStyle} 
                  />
               </div>
               <div>
                  <label className={labelStyle}>Status Operacional</label>
                  <select 
                    value={reuniaoEdit?.status || 'agendada'} 
                    onChange={e => setReuniaoEdit({...reuniaoEdit, status: e.target.value as any})}
                    className={`${inputStyle} uppercase text-[10px]`}
                  >
                     <option value="agendada">PENDENTE / AGENDADA</option>
                     <option value="realizada">CONCLUÍDA / REALIZADA</option>
                     <option value="cancelada">CANCELADA</option>
                     <option value="reagendada">REAGENDADA</option>
                  </select>
               </div>
            </div>

            <div>
               <label className={labelStyle}>Anotações Estratégicas</label>
               <textarea 
                 rows={6}
                 value={reuniaoEdit?.notas || ''} 
                 onChange={e => setReuniaoEdit({...reuniaoEdit, notas: e.target.value})}
                 className="w-full p-3 bg-surface border border-subtle rounded-lg text-[13px] font-medium text-main outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 resize-none min-h-[160px] leading-relaxed placeholder:text-faint transition-all"
                 placeholder={reuniaoEdit?.status === 'agendada' ? "Pauta da reunião ou preparativos necessários..." : "Descreva detalhadamente o que foi conversado..."}
               />
            </div>

            <div className="flex gap-3 pt-2">
               <button type="button" onClick={() => setModalOpen(false)} className="flex-1 h-9 font-semibold text-[color:var(--text-muted)] text-[12px] hover:bg-surface-2 rounded-lg transition-colors">Descartar</button>
               <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-9 font-semibold text-[#0b0e14] text-[12px] rounded-lg shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--primary)' }}
               >
                  {loading ? 'Sincronizando...' : 'Confirmar Lançamento'}
               </button>
            </div>
         </form>
      </Modal>

      <Confirmacao
        isOpen={!!excluirTarget}
        onClose={() => setExcluirTarget(null)}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir registro"
        message="Deseja excluir este registro de reunião permanentemente?"
      />
    </div>
  );
};

export default AbaReunioes;
