
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
            <h3 className="text-[16px] font-bold text-main tracking-tight leading-none">Metodologia & Roteiros</h3>
            <p className="text-faint text-[10px] font-bold uppercase tracking-wider mt-1">Padronize o atendimento através de checklists</p>
         </div>
         <Button 
          onClick={() => { setEditingItem(null); setModalOpen(true); }}
          leftIcon={<Plus size={14} />}
          className="text-[10px] uppercase tracking-wider px-4 h-9 font-bold"
         >
           Novo Template
         </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 py-16 text-center text-faint font-bold uppercase tracking-wider text-[10px] animate-pulse">Sincronizando processos...</div>
        ) : data.length === 0 ? (
          <div className="col-span-2 py-16 text-center bg-surface-2 rounded-xl border-2 border-dashed border-subtle">
             <ListChecks size={24} className="mx-auto text-faint mb-3" />
             <p className="text-faint font-bold uppercase tracking-wider text-[10px]">Crie seu primeiro roteiro padrão</p>
          </div>
        ) : data.map(item => (
          <div key={item.id} className="px-5 py-4 bg-surface rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-indigo-200 transition-all group relative overflow-hidden">
             <div className="relative z-10 flex justify-between items-start mb-4">
                <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-[8px] flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                   <Activity size={18} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => { setEditingItem(item); setModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-[8px] transition-all"><Edit3 size={15} /></button>
                   <button onClick={() => handleDelete(item.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-[8px] transition-all"><Trash2 size={15} /></button>
                </div>
             </div>
             <div className="relative z-10">
                <h4 className="font-bold text-main text-[13px] tracking-tight leading-none mb-2">{item.nome}</h4>
                <div className="flex gap-2">
                   <span className="text-[9px] font-bold bg-surface-2 text-muted px-2 py-0.5 rounded-[6px] border border-subtle uppercase tracking-wider">{item.fases?.length || 0} Etapas</span>
                   <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-[6px] border border-indigo-100 uppercase tracking-wider">{item.itens?.length || 0} Tarefas</span>
                </div>
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

  const inputStyle = "w-full px-3 h-9 bg-surface-2 rounded-[8px] border border-subtle font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-[12px]";
  const labelStyle = "block text-[10px] font-bold text-faint uppercase tracking-wider mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
       <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Coluna Esquerda: Definições Gerais */}
          <div className="md:col-span-5 space-y-10 border-r border-subtle pr-6">
             <div>
               <label className={labelStyle}>Nome do Roteiro</label>
               <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className={inputStyle} placeholder="Ex: Onboarding Wealth" />
             </div>

             <div className="flex items-center gap-4 p-5 bg-emerald-50/20 rounded-3xl border border-emerald-100/50">
                <input type="checkbox" id="chkTemFases" checked={temFases} onChange={e => setTemFases(e.target.checked)} className="h-6 w-6 rounded-lg text-emerald-600 focus:ring-0 border-subtle" />
                <label htmlFor="chkTemFases" className="text-[10px] font-black text-emerald-800 uppercase tracking-widest cursor-pointer">Estruturar por Fases</label>
             </div>

             {temFases && (
               <div className="space-y-6 animate-slide-up">
                  <div className="flex justify-between items-center px-1">
                     <h4 className="text-[9px] font-black text-faint uppercase tracking-widest">Etapas do Processo</h4>
                     <button type="button" onClick={addPhase} className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-surface border border-emerald-100 px-3 py-1.5 rounded-xl">+ Add Fase</button>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {fases.map((f, i) => (
                      <div key={f.tempId || f.id} className="flex gap-3 items-center group animate-fade-in">
                         <div className="w-8 h-10 flex items-center justify-center font-black text-emerald-200 italic">#{i+1}</div>
                         <input 
                           placeholder="Nome da Fase" 
                           value={f.nome_fase} 
                           onChange={e => { const nf = [...fases]; nf[i].nome_fase = e.target.value; setFases(nf); }} 
                           className="flex-1 p-3.5 bg-surface rounded-2xl font-bold text-xs outline-none border border-subtle focus:border-emerald-500 shadow-sm" 
                         />
                         <button type="button" onClick={() => setFases(fases.filter(ph => (ph.tempId || ph.id) !== (f.tempId || f.id)))} className="p-2 text-faint hover:text-rose-500 transition-colors">✕</button>
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
                <button type="button" onClick={addItem} className="text-[9px] font-black text-white bg-surface-3 px-6 py-3 rounded-2xl shadow-xl hover:bg-strong flex items-center gap-3 transition-all">
                   <CheckCircle size={16} />
                   ADICIONAR TAREFA
                </button>
             </div>

             <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                {itens.map((it, i) => (
                  <div key={it.id || i} className="flex flex-col sm:flex-row gap-4 bg-surface-2/50 p-6 rounded-[2rem] border border-subtle group animate-slide-up hover:bg-surface transition-all shadow-sm">
                     <div className="flex items-center gap-3 shrink-0 opacity-20 group-hover:opacity-100 transition-opacity">
                        <GripVertical size={20} className="text-faint cursor-grab" />
                     </div>
                     <div className="flex-1 space-y-4">
                        <div className="flex gap-3">
                           <input 
                             placeholder="Descreva a atividade aqui..." 
                             value={it.descricao} 
                             onChange={e => { const ni = [...itens]; ni[i].descricao = e.target.value; setItens(ni); }} 
                             className="flex-1 p-3 bg-surface rounded-2xl font-bold text-xs outline-none border border-subtle focus:border-emerald-400" 
                           />
                           <button type="button" onClick={() => setItens(itens.filter((_, idx) => idx !== i))} className="p-3 text-faint hover:text-rose-500 transition-all">✕</button>
                        </div>
                        {temFases && (
                          <div className="flex items-center gap-3">
                             <span className="text-[8px] font-black text-faint uppercase tracking-widest ml-1">Vincular Etapa:</span>
                             <select 
                               value={it.fase_temp_id || (it.fase_id || '')} 
                               onChange={e => { const ni = [...itens]; ni[i].fase_temp_id = e.target.value; setItens(ni); }}
                               className="bg-surface border border-subtle rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-tighter outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-sm"
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
                  <div className="py-24 text-center border-2 border-dashed border-subtle rounded-[2.5rem]">
                     <ListChecks size={40} className="mx-auto text-faint mb-4" />
                     <p className="text-faint font-bold uppercase tracking-[0.3em] text-[10px]">Checklist Vazio</p>
                  </div>
                )}
             </div>
          </div>
       </div>

       <div className="flex gap-3 pt-6 border-t border-subtle">
          <Button variant="ghost" onClick={onCancel} className="flex-1 h-9 text-[11px] font-bold uppercase tracking-wider">Descartar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 h-9 text-[11px] font-bold uppercase tracking-wider">Sincronizar Roteiro</Button>
       </div>
    </form>
  );
};

export default AcompanhamentoConfig;
