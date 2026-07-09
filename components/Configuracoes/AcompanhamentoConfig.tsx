
import React, { useState, useEffect } from 'react';
import { configService } from '../../services/configuracoesService';
import SidePanel from '../UI/SidePanel';
import Button from '../UI/Button';
import Badge from '../UI/Badge';
import Confirmacao from '../Confirmacao';
import { Activity, Plus, Edit3, Trash2, ListChecks, CheckCircle, GripVertical } from 'lucide-react';

const campoInputStyle = "w-full px-3 h-9 bg-surface-2 rounded-[8px] border border-subtle font-bold outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-[12px]";
const campoLabelStyle = "block text-[10px] font-bold text-faint uppercase tracking-wider mb-1.5";

const AcompanhamentoConfig: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await configService.deleteAcompanhamento(deleteTarget.id);
      await loadData();
      setDeleteTarget(null);
    } catch (err: any) {
      alert("Erro ao excluir roteiro: " + (err.message || "Verifique a conexão."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h3 className="text-[16px] font-bold text-main tracking-tight leading-none">Metodologia & Roteiros</h3>
            <p className="text-faint text-[10px] font-bold uppercase tracking-wider mt-1">Padronize o atendimento através de checklists</p>
         </div>
         <Button
          onClick={() => { setEditingItem(null); setPanelOpen(true); }}
          leftIcon={<Plus size={14} />}
          className="text-[10px] uppercase tracking-wider px-4 h-9 font-bold"
         >
           Novo Template
         </Button>
      </div>

      <div className="bg-surface rounded-xl border border-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-subtle">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Nome do Roteiro</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Etapas</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Tarefas</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {loading ? (
                <tr><td colSpan={4} className="py-16 text-center text-faint font-bold uppercase tracking-wider text-[10px] animate-pulse">Sincronizando processos...</td></tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                     <ListChecks size={24} className="mx-auto text-faint mb-3" />
                     <p className="text-faint font-bold uppercase tracking-wider text-[10px]">Crie seu primeiro roteiro padrão</p>
                  </td>
                </tr>
              ) : data.map(item => (
                <tr key={item.id} className="hover:bg-surface-2 transition-colors group">
                   <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                         <div className="h-9 w-9 bg-primary/10 text-primary rounded-[8px] flex items-center justify-center shrink-0">
                            <Activity size={16} />
                         </div>
                         <p className="font-bold text-main text-[13px] tracking-tight">{item.nome}</p>
                      </div>
                   </td>
                   <td className="px-5 py-3"><Badge variant="neutral" size="sm">{item.fases?.length || 0} Etapas</Badge></td>
                   <td className="px-5 py-3"><Badge variant="primary" size="sm">{item.itens?.length || 0} Tarefas</Badge></td>
                   <td className="px-5 py-3 text-right">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => { setEditingItem(item); setPanelOpen(true); }} className="p-2 text-faint hover:text-primary hover:bg-primary/10 rounded-[8px] transition-all"><Edit3 size={15} /></button>
                         <button onClick={() => setDeleteTarget(item)} className="p-2 text-faint hover:text-danger hover:bg-danger/10 rounded-[8px] transition-all"><Trash2 size={15} /></button>
                      </div>
                   </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={`${editingItem ? 'Editar' : 'Novo'} Roteiro Padrão`}
        widthClass="max-w-2xl"
      >
         <FormAcompanhamento item={editingItem} onSave={() => { setPanelOpen(false); loadData(); }} onCancel={() => setPanelOpen(false)} />
      </SidePanel>

      <Confirmacao
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Roteiro Padrão"
        message={`Deseja remover o checklist "${deleteTarget?.nome}"? Roteiros já em uso em atendimentos ativos não serão afetados retroativamente.`}
        loading={isDeleting}
      />
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

  return (
    <form id="form-acompanhamento" onSubmit={handleSubmit} className="space-y-8">
       <div>
         <label className={campoLabelStyle}>Nome do Roteiro</label>
         <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className={campoInputStyle} placeholder="Ex: Onboarding Wealth" />
       </div>

       <div className="flex items-center gap-3 p-4 bg-success/10 rounded-xl border border-subtle">
          <input type="checkbox" id="chkTemFases" checked={temFases} onChange={e => setTemFases(e.target.checked)} className="h-5 w-5 rounded text-primary focus:ring-0 border-subtle" />
          <label htmlFor="chkTemFases" className="text-[10px] font-bold text-success uppercase tracking-wider cursor-pointer">Estruturar por Fases</label>
       </div>

       {temFases && (
         <div className="space-y-4 animate-slide-up">
            <div className="flex justify-between items-center px-1">
               <h4 className="text-[9px] font-bold text-faint uppercase tracking-widest">Etapas do Processo</h4>
               <Button type="button" variant="outline" size="sm" onClick={addPhase} leftIcon={<Plus size={12} />} className="text-[9px] font-bold">Add Fase</Button>
            </div>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
              {fases.map((f, i) => (
                <div key={f.tempId || f.id} className="flex gap-2 items-center group animate-fade-in">
                   <div className="w-7 h-9 flex items-center justify-center font-bold text-[11px] text-primary/50 italic">#{i+1}</div>
                   <input
                     placeholder="Nome da Fase"
                     value={f.nome_fase}
                     onChange={e => { const nf = [...fases]; nf[i].nome_fase = e.target.value; setFases(nf); }}
                     className={`flex-1 ${campoInputStyle}`}
                   />
                   <button type="button" onClick={() => setFases(fases.filter(ph => (ph.tempId || ph.id) !== (f.tempId || f.id)))} className="p-2 text-faint hover:text-danger transition-colors"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
         </div>
       )}

       <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <h4 className={campoLabelStyle} style={{ marginBottom: 0 }}>Checklist de Atividades</h4>
             <Button type="button" size="sm" onClick={addItem} leftIcon={<CheckCircle size={14} />} className="text-[9px] font-bold">Adicionar Tarefa</Button>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
             {itens.map((it, i) => (
               <div key={it.id || i} className="flex flex-col sm:flex-row gap-3 bg-surface-2/50 p-4 rounded-xl border border-subtle group animate-slide-up">
                  <div className="flex items-center gap-2 shrink-0 opacity-20 group-hover:opacity-100 transition-opacity">
                     <GripVertical size={18} className="text-faint cursor-grab" />
                  </div>
                  <div className="flex-1 space-y-3">
                     <div className="flex gap-2">
                        <input
                          placeholder="Descreva a atividade aqui..."
                          value={it.descricao}
                          onChange={e => { const ni = [...itens]; ni[i].descricao = e.target.value; setItens(ni); }}
                          className={`flex-1 ${campoInputStyle}`}
                        />
                        <button type="button" onClick={() => setItens(itens.filter((_, idx) => idx !== i))} className="p-2 text-faint hover:text-danger transition-all"><Trash2 size={14} /></button>
                     </div>
                     {temFases && (
                       <div className="flex items-center gap-2">
                          <span className="text-[8px] font-bold text-faint uppercase tracking-wider">Vincular Etapa:</span>
                          <select
                            value={it.fase_temp_id || (it.fase_id || '')}
                            onChange={e => { const ni = [...itens]; ni[i].fase_temp_id = e.target.value; setItens(ni); }}
                            className="bg-surface border border-subtle rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase outline-none focus:ring-2 focus:ring-primary/10 transition-all"
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
               <div className="py-16 text-center border-2 border-dashed border-subtle rounded-xl">
                  <ListChecks size={32} className="mx-auto text-faint mb-3" />
                  <p className="text-faint font-bold uppercase tracking-widest text-[10px]">Checklist Vazio</p>
               </div>
             )}
          </div>
       </div>

       <div className="flex gap-3 pt-6 border-t border-subtle">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 h-9 text-[11px] font-semibold">Descartar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 h-9 text-[11px] font-semibold">Sincronizar Roteiro</Button>
       </div>
    </form>
  );
};

export default AcompanhamentoConfig;
