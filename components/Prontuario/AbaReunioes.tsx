
import React, { useState, useEffect } from 'react';
import { reuniaoService, Reuniao } from '../../services/reuniaoService';
import { formatarData } from '../../utils/formatadores';
import Modal from '../Modal';
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
      }
    }
  };

  const handleExcluir = async (id: string) => {
    if (!window.confirm("Deseja excluir este registro permanentemente?")) return;
    try {
      await reuniaoService.excluir(id);
      onRefresh();
    } catch (err) {
      alert("Erro ao excluir.");
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

  const labelStyle = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1";
  const inputStyle = "w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all text-sm";

  return (
    <div className="space-y-12 animate-fade-in">
      {/* Próximas Reuniões */}
      <section className="space-y-6">
        <div className="flex justify-between items-center px-2">
           <div className="flex items-center gap-3">
              <Calendar size={16} className="text-indigo-500" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Próximos Agendamentos</h3>
           </div>
           <button 
             onClick={() => { 
               setReuniaoEdit({ status: 'agendada', notas: '' }); 
               setModalOpen(true); 
             }}
             className="text-indigo-600 font-black text-[9px] uppercase tracking-widest bg-indigo-50 px-5 py-2.5 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
           >
             + Agendar Reunião
           </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {agendadas.length === 0 ? (
             <div className="col-span-2 py-10 bg-slate-50/50 border border-dashed border-slate-200 rounded-3xl text-center">
                <Clock size={20} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-300 font-bold uppercase text-[9px] tracking-widest">Sem compromissos pendentes</p>
             </div>
           ) : agendadas.map(r => (
             <div key={r.id} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-all">
                <div className="flex items-center gap-4">
                   <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xs">
                      {formatarData(r.data_reuniao).split('/')[0]}
                   </div>
                   <div>
                      <p className="text-sm font-black text-slate-800 tracking-tight leading-tight">{formatarData(r.data_reuniao, true)}</p>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Check-in agendado</span>
                   </div>
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                   <button onClick={() => { setReuniaoEdit(r); setModalOpen(true); }} title="Editar Agendamento" className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-200 hover:text-slate-600 transition-all"><Edit3 size={14} /></button>
                   <button onClick={() => handleAction(r.id!, 'realizada')} title="Confirmar Realização" className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-500 hover:text-white transition-all"><CheckCircle2 size={14} /></button>
                   <button onClick={() => handleAction(r.id!, 'cancelada')} title="Cancelar Reunião" className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-500 hover:text-white transition-all"><XCircle size={14} /></button>
                </div>
             </div>
           ))}
        </div>
      </section>

      {/* Histórico Timeline */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-2 gap-4">
           <div className="flex items-center gap-3">
              <History size={16} className="text-slate-400" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cronologia de Interações</h3>
           </div>
           <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative group flex-1 sm:flex-none">
                 <input 
                   type="text" 
                   placeholder="Filtrar notas..." 
                   value={busca} 
                   onChange={e => setBusca(e.target.value)}
                   className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-500/5 focus:bg-white text-[9px] font-bold uppercase tracking-tight transition-all w-full sm:w-48"
                 />
                 <Search className="h-3 w-3 absolute left-3 top-2.5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <button 
                onClick={() => { 
                  setReuniaoEdit({ status: 'realizada', notas: '' }); 
                  setModalOpen(true); 
                }}
                className="text-emerald-600 font-black text-[9px] uppercase tracking-widest bg-emerald-50 px-5 py-2.5 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm whitespace-nowrap"
              >
                + Registrar Histórico
              </button>
           </div>
        </div>

        <div className="relative pl-10 space-y-8 before:absolute before:left-4 before:top-0 before:bottom-0 before:w-0.5 before:bg-slate-100">
           {historico.length === 0 ? (
             <div className="py-10 text-center text-slate-200 font-bold uppercase text-[9px] tracking-widest italic ml-4">Sem histórico de atividades recentes.</div>
           ) : historico.map(r => (
             <div key={r.id} className="relative group">
                <div className={`absolute -left-10 h-8 w-8 rounded-xl border-4 border-white flex items-center justify-center text-white shadow-md transition-all group-hover:scale-110 z-10 ${
                  r.status === 'realizada' ? 'bg-emerald-500' : r.status === 'cancelada' ? 'bg-rose-500' : 'bg-indigo-500'
                }`}>
                   <MessageSquare size={12} strokeWidth={2.5} />
                </div>
                
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm group-hover:shadow-md group-hover:border-indigo-100 transition-all">
                   <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                         <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{formatarData(r.data_reuniao, true)}</p>
                         {getStatusBadge(r.status)}
                      </div>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => { setReuniaoEdit(r); setModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><Edit3 size={14} /></button>
                        <button onClick={() => handleExcluir(r.id!)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={14} /></button>
                      </div>
                   </div>
                   <div className={`p-5 rounded-2xl border transition-colors ${r.status === 'realizada' ? 'bg-slate-50/50 border-slate-100' : 'bg-slate-100/30 border-transparent opacity-50'}`}>
                      <p className="text-xs font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
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
              <div className="flex bg-slate-100 p-1 rounded-xl w-full border border-slate-200">
                <button 
                  type="button" 
                  onClick={() => setReuniaoEdit({ ...reuniaoEdit, status: 'agendada' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${reuniaoEdit?.status === 'agendada' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <CalendarCheck size={14} /> Agendamento
                </button>
                <button 
                  type="button" 
                  onClick={() => setReuniaoEdit({ ...reuniaoEdit, status: 'realizada' })}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${reuniaoEdit?.status === 'realizada' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
                 className={`${inputStyle} resize-none h-48 leading-relaxed font-medium placeholder:text-slate-300 transition-all focus:h-64`}
                 placeholder={reuniaoEdit?.status === 'agendada' ? "Pauta da reunião ou preparativos necessários..." : "Descreva detalhadamente o que foi conversado..."}
               />
            </div>

            <div className="flex gap-3 pt-2">
               <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Descartar</button>
               <button 
                  type="submit" 
                  disabled={loading} 
                  className={`flex-1 py-4 font-black text-white uppercase text-[10px] rounded-xl shadow-xl transition-all ${
                    reuniaoEdit?.status === 'agendada' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
               >
                  {loading ? 'Sincronizando...' : 'Confirmar Lançamento'}
               </button>
            </div>
         </form>
      </Modal>
    </div>
  );
};

export default AbaReunioes;
