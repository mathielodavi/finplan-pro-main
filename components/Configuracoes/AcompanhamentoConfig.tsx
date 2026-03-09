
import React, { useState, useEffect } from 'react';
import { configService } from '../../services/configuracoesService';
import Modal from '../Modal';
import Button from '../UI/Button';
import { Activity, Plus, Edit3, Trash2, ListChecks, Layout, CheckCircle, GripVertical } from 'lucide-react';

const AcompanhamentoConfig: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await configService.getAcompanhamentos();
      setData(res || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja remover este checklist padrão?")) return;
    // Implementação real de delete no service se desejado
    loadData();
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight leading-none">Metodologia & Roteiros</h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Padronize o atendimento através de checklists</p>
         </div>
         <Button 
          onClick={() => { setEditingItem(null); setModalOpen(true); }}
          leftIcon={<Plus size={16} />}
          className="text-[10px] uppercase tracking-widest px-8 shadow-xl shadow-emerald-500/10"
         >
           Novo Template
         </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 py-20 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px] animate-pulse">Sincronizando processos...</div>
        ) : data.length === 0 ? (
          <div className="col-span-2 py-20 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
             <ListChecks size={32} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Crie seu primeiro roteiro padrão</p>
          </div>
        ) : data.map(item => (
          <div key={item.id} className="p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:scale-[1.01] hover:border-emerald-200 transition-all group relative overflow-hidden">
             <div className="relative z-10 flex justify-between items-start mb-6">
                <div className="h-14 w-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                   <Activity size={28} />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => { setEditingItem(item); setModalOpen(true); }} className="p-3 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                   <button onClick={() => handleDelete(item.id)} className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                </div>
             </div>
             <div className="relative z-10">
                <h4 className="font-black text-slate-800 uppercase text-lg tracking-tight leading-none mb-3">{item.nome}</h4>
                <div className="flex gap-3">
                   <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-tighter">{item.fases?.length || 0} Etapas</span>
                   <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-tighter">{item.itens?.length || 0} Tarefas</span>
                </div>
             </div>
             <div className="absolute -bottom-8 -right-8 text-slate-50 opacity-20 transition-all group-hover:scale-110 group-hover:rotate-12 group-hover:opacity-40">
                <Layout size={120} />
             </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`${editingItem ? 'Editar' : 'Novo'} Roteiro Padrão`}>
         <FormAcompanhamento item={editingItem} onSave={() => { setModalOpen(false); loadData(); }} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
};

const FormAcompanhamento = ({ item, onSave, onCancel }: any) => {
  const [nome, setNome] = useState(item?.nome || '');
  const [temFases, setTemFases] = useState(item?.tem_fases || false);
  const [fases, setFases] = useState<any[]>(item?.fases?.map((f: any) => ({ ...f, tempId: f.id })) || []);
  const [itens, setItens] = useState<any[]>(item?.itens || []);
  const [loading, setLoading] = useState(false);

  const addPhase = () => {
    const id = `t-${Date.now()}`;
    setFases([...fases, { tempId: id, nome_fase: '', ordem: fases.length + 1 }]);
  };

  const addItem = () => {
    setItens([...itens, { id: `item-${Date.now()}`, descricao: '', ordem: itens.length + 1, fase_temp_id: fases[0]?.tempId || (fases[0]?.id || null) }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await configService.saveAcompanhamento({ id: item?.id, nome, tem_fases: temFases }, fases, itens);
      onSave();
    } catch (err: any) {
      alert("Erro ao salvar roteiro: " + (err.message || "Verifique a conexão."));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-bold outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-600 transition-all text-sm";
  const labelStyle = "block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
       <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Coluna Esquerda: Definições Gerais */}
          <div className="md:col-span-5 space-y-10 border-r border-slate-50 pr-6">
             <div>
               <label className={labelStyle}>Nome do Roteiro</label>
               <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className={inputStyle} placeholder="Ex: Onboarding Wealth" />
             </div>

             <div className="flex items-center gap-4 p-5 bg-emerald-50/20 rounded-3xl border border-emerald-100/50">
                <input type="checkbox" id="chkTemFases" checked={temFases} onChange={e => setTemFases(e.target.checked)} className="h-6 w-6 rounded-lg text-emerald-600 focus:ring-0 border-slate-200" />
                <label htmlFor="chkTemFases" className="text-[10px] font-black text-emerald-800 uppercase tracking-widest cursor-pointer">Estruturar por Fases</label>
             </div>

             {temFases && (
               <div className="space-y-6 animate-slide-up">
                  <div className="flex justify-between items-center px-1">
                     <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Etapas do Processo</h4>
                     <button type="button" onClick={addPhase} className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-white border border-emerald-100 px-3 py-1.5 rounded-xl">+ Add Fase</button>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {fases.map((f, i) => (
                      <div key={f.tempId || f.id} className="flex gap-3 items-center group animate-fade-in">
                         <div className="w-8 h-10 flex items-center justify-center font-black text-emerald-200 italic">#{i+1}</div>
                         <input 
                           placeholder="Nome da Fase" 
                           value={f.nome_fase} 
                           onChange={e => { const nf = [...fases]; nf[i].nome_fase = e.target.value; setFases(nf); }} 
                           className="flex-1 p-3.5 bg-white rounded-2xl font-bold text-xs outline-none border border-slate-100 focus:border-emerald-500 shadow-sm" 
                         />
                         <button type="button" onClick={() => setFases(fases.filter(ph => (ph.tempId || ph.id) !== (f.tempId || f.id)))} className="p-2 text-slate-200 hover:text-rose-500 transition-colors">✕</button>
                      </div>
                    ))}
                  </div>
               </div>
             )}
          </div>

          {/* Coluna Direita: Checklist de Itens */}
          <div className="md:col-span-7 space-y-6">
             <div className="flex justify-between items-center px-1">
                <h4 className={labelStyle}>Checklist de Atividades</h4>
                <button type="button" onClick={addItem} className="text-[9px] font-black text-white bg-slate-900 px-6 py-3 rounded-2xl shadow-xl hover:bg-slate-800 flex items-center gap-3 transition-all">
                   <CheckCircle size={16} />
                   ADICIONAR TAREFA
                </button>
             </div>

             <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                {itens.map((it, i) => (
                  <div key={it.id || i} className="flex flex-col sm:flex-row gap-4 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 group animate-slide-up hover:bg-white transition-all shadow-sm">
                     <div className="flex items-center gap-3 shrink-0 opacity-20 group-hover:opacity-100 transition-opacity">
                        <GripVertical size={20} className="text-slate-400 cursor-grab" />
                     </div>
                     <div className="flex-1 space-y-4">
                        <div className="flex gap-3">
                           <input 
                             placeholder="Descreva a atividade aqui..." 
                             value={it.descricao} 
                             onChange={e => { const ni = [...itens]; ni[i].descricao = e.target.value; setItens(ni); }} 
                             className="flex-1 p-3 bg-white rounded-2xl font-bold text-xs outline-none border border-slate-100 focus:border-emerald-400" 
                           />
                           <button type="button" onClick={() => setItens(itens.filter((_, idx) => idx !== i))} className="p-3 text-slate-200 hover:text-rose-500 transition-all">✕</button>
                        </div>
                        {temFases && (
                          <div className="flex items-center gap-3">
                             <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Vincular Etapa:</span>
                             <select 
                               value={it.fase_temp_id || (it.fase_id || '')} 
                               onChange={e => { const ni = [...itens]; ni[i].fase_temp_id = e.target.value; setItens(ni); }}
                               className="bg-white border border-slate-100 rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-tighter outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-sm"
                             >
                                <option value="">Sem Etapa</option>
                                {fases.map(f => <option key={f.tempId || f.id} value={f.tempId || f.id}>{f.nome_fase || `Etapa ${f.ordem}`}</option>)}
                             </select>
                          </div>
                        )}
                     </div>
                  </div>
                ))}
                {itens.length === 0 && (
                  <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                     <ListChecks size={40} className="mx-auto text-slate-100 mb-4" />
                     <p className="text-slate-300 font-bold uppercase tracking-[0.3em] text-[10px]">Checklist Vazio</p>
                  </div>
                )}
             </div>
          </div>
       </div>

       <div className="flex gap-4 pt-10 border-t border-slate-50">
          <Button variant="ghost" onClick={onCancel} className="flex-1 py-5 text-xs uppercase tracking-widest">Descartar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 py-5 text-xs uppercase tracking-widest shadow-emerald-500/10">Sincronizar Roteiro</Button>
       </div>
    </form>
  );
};

export default AcompanhamentoConfig;
