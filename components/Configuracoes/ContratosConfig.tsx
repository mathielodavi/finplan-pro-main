import React, { useState, useEffect } from 'react';
import { configService } from '../../services/configuracoesService';
import { formatarMoeda } from '../../utils/formatadores';
import Modal from '../Modal';
import Button from '../UI/Button';
import Confirmacao from '../Confirmacao';
import { Edit3, Trash2, Plus, FileText, ChevronRight, Calculator, Calendar, DollarSign, Percent, Clock, Zap, ArrowRight, ShieldCheck, Info, RotateCcw, Timer } from 'lucide-react';

const ContratosConfig: React.FC = () => {
  const [subTab, setSubTab] = useState<'planejamento' | 'extra'>('planejamento');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Estados para o fluxo de exclusão
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = subTab === 'planejamento' ? await configService.getPlanejamento() : await configService.getExtras();
      setData(res || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [subTab]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (subTab === 'planejamento') await configService.deletePlanejamento(deleteTarget.id);
      else await configService.deleteExtra(deleteTarget.id);
      await loadData();
      setDeleteTarget(null);
    } catch (err) {
      alert("Erro ao excluir padrão. Verifique se existem vínculos ativos.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex bg-slate-50 p-1.5 rounded-2xl w-fit border border-slate-100 shadow-inner">
        <button 
          onClick={() => setSubTab('planejamento')}
          className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${subTab === 'planejamento' ? 'bg-white text-emerald-600 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Planejamento
        </button>
        <button 
          onClick={() => setSubTab('extra')}
          className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${subTab === 'extra' ? 'bg-white text-emerald-600 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Serviços Extras
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight leading-none">Modelos de {subTab}</h3>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Padronize prazos e regras de faturamento</p>
         </div>
         <Button 
          onClick={() => { setEditingItem(null); setModalOpen(true); }}
          leftIcon={<Plus size={16} />}
          className="text-[10px] uppercase tracking-widest px-8 shadow-xl shadow-emerald-500/10"
         >
           Novo Padrão
         </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 text-center animate-pulse text-slate-300 font-bold uppercase tracking-widest text-[10px]">Carregando modelos...</div>
        ) : data.length === 0 ? (
          <div className="py-20 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100">
             <FileText size={32} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Nenhum modelo cadastrado</p>
          </div>
        ) : data.map(item => (
          <div key={item.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-8 bg-white rounded-[2.5rem] border border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group">
             <div className="flex items-center gap-6">
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner transition-all duration-500 ${subTab === 'extra' ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'}`}>
                   <FileText size={24} />
                </div>
                <div>
                   <p className="font-black text-slate-800 uppercase text-sm tracking-tight">{item.nome}</p>
                   <div className="flex flex-wrap gap-2 mt-2">
                      {subTab === 'planejamento' ? (
                        <>
                          <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase tracking-tighter">Ciclo: {item.prazo_meses || 'Indet.'} m</span>
                          {item.valor_fixo && <span className="text-[8px] font-black bg-emerald-100/50 text-emerald-700 px-3 py-1 rounded-full uppercase tracking-tighter">Fixo: {formatarMoeda(item.valor)}</span>}
                        </>
                      ) : (
                        <>
                          <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-tighter">{item.tipo}</span>
                          <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${item.recorrente ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{item.recorrente ? 'Recorrente' : 'Temporário'}</span>
                          {item.tem_bonus && <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded-full uppercase tracking-tighter">Bônus: {item.taxa_bonus}%</span>}
                        </>
                      )}
                      <span className="text-[8px] font-black bg-slate-100 text-slate-400 px-3 py-1 rounded-full uppercase tracking-tighter">D+{item.prazo_recebimento_medio_dias || item.prazo_recebimento_parcelado_dias}d</span>
                   </div>
                </div>
             </div>
             <div className="flex gap-2 mt-4 md:mt-0 opacity-20 group-hover:opacity-100 transition-all duration-300">
                <button onClick={() => { setEditingItem(item); setModalOpen(true); }} className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                <button onClick={() => setDeleteTarget(item)} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                <div className="p-3 text-slate-100"><ChevronRight size={20} /></div>
             </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`${editingItem ? 'Editar' : 'Novo'} Padrão de ${subTab}`} size="wide">
         {subTab === 'planejamento' ? (
           <FormPlanejamento item={editingItem} onSave={() => { setModalOpen(false); loadData(); }} onCancel={() => setModalOpen(false)} />
         ) : (
           <FormExtra item={editingItem} onSave={() => { setModalOpen(false); loadData(); }} onCancel={() => setModalOpen(false)} />
         )}
      </Modal>

      <Confirmacao 
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Excluir Padrão de ${subTab}`}
        message={`Deseja realmente excluir o modelo "${deleteTarget?.nome}"? Esta ação não afetará contratos já assinados por clientes, mas o modelo não estará mais disponível para novas ativações.`}
        loading={isDeleting}
      />
    </div>
  );
};

const FormPlanejamento = ({ item, onSave, onCancel }: any) => {
  const [formData, setFormData] = useState(item || { 
    nome: '', 
    prazo_meses: 12, 
    valor_fixo: true, 
    valor: 0, 
    prazo_recebimento_vista_dias: 0, 
    prazo_recebimento_parcelado_dias: 30, 
    percentual_repasse: 100 
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await configService.savePlanejamento(formData);
      onSave();
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 font-bold outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-600 transition-all text-sm";
  const labelStyle = "block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="md:col-span-2">
            <label className={labelStyle}>Identificação do Plano</label>
            <input type="text" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className={inputStyle} placeholder="Ex: Consultoria Premium 2025" />
          </div>

          <div className="space-y-8">
            <div>
              <label className={labelStyle}>Duração Padrão (Meses)</label>
              <div className="relative">
                <Calendar size={18} className="absolute left-5 top-5 text-slate-300" />
                <input type="number" required value={formData.prazo_meses} onChange={e => setFormData({...formData, prazo_meses: parseInt(e.target.value)})} className={`${inputStyle} pl-14`} />
              </div>
            </div>
            
            <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100">
               <label className="flex items-center gap-4 cursor-pointer group">
                  <input type="checkbox" checked={formData.valor_fixo} onChange={e => setFormData({...formData, valor_fixo: e.target.checked})} className="h-6 w-6 rounded-lg border-slate-200 text-emerald-600 focus:ring-0" />
                  <span className="text-[11px] font-black text-emerald-700 uppercase tracking-widest group-hover:text-emerald-800 transition-colors">Contrato com Valor Fixo</span>
               </label>
               {formData.valor_fixo && (
                 <div className="mt-6 animate-slide-up">
                    <label className="block text-[8px] font-black text-emerald-600 uppercase mb-2 ml-1">Valor Bruto Sugerido</label>
                    <div className="relative">
                       <DollarSign size={16} className="absolute left-4 top-4 text-emerald-300" />
                       <input type="number" step="0.01" value={formData.valor} onChange={e => setFormData({...formData, valor: parseFloat(e.target.value)})} className="w-full p-4 pl-12 bg-white rounded-2xl border border-emerald-100 font-black text-emerald-700 outline-none" />
                    </div>
                 </div>
               )}
            </div>
          </div>

          <div className="space-y-6">
             <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-3xl space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2">Regras de Recebimento (D+x)</span>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">À Vista</label>
                      <input type="number" value={formData.prazo_recebimento_vista_dias} onChange={e => setFormData({...formData, prazo_recebimento_vista_dias: parseInt(e.target.value)})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" />
                   </div>
                   <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Parcelado</label>
                      <input type="number" value={formData.prazo_recebimento_parcelado_dias} onChange={e => setFormData({...formData, prazo_recebimento_parcelado_dias: parseInt(e.target.value)})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs outline-none" />
                   </div>
                </div>
             </div>
             <div>
                <label className={labelStyle}>% Repasse Líquido Consultor</label>
                <div className="relative">
                   <Percent size={18} className="absolute left-5 top-5 text-slate-300" />
                   <input type="number" step="0.1" value={formData.percentual_repasse} onChange={e => setFormData({...formData, percentual_repasse: parseFloat(e.target.value)})} className={`${inputStyle} pl-14`} />
                </div>
             </div>
          </div>
       </div>

       <div className="flex gap-4 pt-10 border-t border-slate-50">
          <Button variant="ghost" onClick={onCancel} className="flex-1 py-5 text-xs uppercase tracking-widest">Cancelar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 py-5 text-xs uppercase tracking-widest shadow-emerald-500/20">Confirmar Modelo</Button>
       </div>
    </form>
  );
};

const FormExtra = ({ item, onSave, onCancel }: any) => {
  const [formData, setFormData] = useState(item || { 
    nome: '', 
    recorrente: true,
    tipo: 'Seguros',
    tem_bonus: false, 
    taxa_bonus: 0,
    recebimento_bonus_tipo: 'normal',
    prazo_bonus_dias: 0,
    repasse_tipo: 'pre',
    prazo_recebimento_medio_dias: 30,
    percentual_repasse_liquido: 100
  });
  
  // Se for temporário, forçamos o estado "ilimitado" nas fases por padrão
  const [fluxos, setFluxos] = useState<any[]>(() => {
    if (item?.fases && item.fases.length > 0) {
      return item.fases.map((f: any) => ({
        ...f,
        sem_prazo: !formData.recorrente ? true : (f.mes_fim === null || f.mes_fim === undefined)
      }));
    }
    return [{ percentual_repasse: 0, mes_fim: !formData.recorrente ? null : 12, sem_prazo: !formData.recorrente }];
  });
  
  const [loading, setLoading] = useState(false);

  // Sincroniza fluxos se a periodicidade mudar
  useEffect(() => {
    if (!formData.recorrente) {
      setFluxos(prev => prev.map(f => ({ ...f, sem_prazo: true, mes_fim: null })));
    }
  }, [formData.recorrente]);

  const addFluxo = () => {
    setFluxos([...fluxos, { percentual_repasse: 0, mes_fim: null, sem_prazo: true }]);
  };

  const removeFluxo = (idx: number) => {
    setFluxos(fluxos.filter((_, i) => i !== idx));
  };

  const updateFluxo = (idx: number, field: string, val: any) => {
    const nf = [...fluxos];
    nf[idx][field] = val;
    if (field === 'sem_prazo' && val === true) nf[idx].mes_fim = null;
    setFluxos(nf);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await configService.saveExtra(formData, fluxos);
      onSave();
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = "w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-600 transition-all text-sm";
  const labelStyle = "block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-10 animate-fade-in">
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          <div className="lg:col-span-5 space-y-8">
             <div>
               <label className={labelStyle}>Nome do Serviço Adicional</label>
               <input type="text" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className={inputStyle} placeholder="Ex: Seguro de Vida Individual" />
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className={labelStyle}>Periodicidade</label>
                   <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                      <button type="button" onClick={() => setFormData({...formData, recorrente: true})} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase transition-all ${formData.recorrente ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>Recorrente</button>
                      <button type="button" onClick={() => setFormData({...formData, recorrente: false})} className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase transition-all ${!formData.recorrente ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400'}`}>Temporário</button>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className={labelStyle}>Tipo de Contrato</label>
                   <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className={inputStyle}>
                      <option value="Seguros">Seguros</option>
                      <option value="Planos de Saúde">Planos de Saúde</option>
                      <option value="Consultoria de Investimentos">Consultoria de Investimentos</option>
                      <option value="Consultoria PJ">Consultoria PJ</option>
                      <option value="Crédito">Crédito</option>
                      <option value="Outros">Outros</option>
                   </select>
                </div>
             </div>

             <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-3xl space-y-4">
                <div className="flex items-center gap-3">
                   <Clock size={16} className="text-slate-400" />
                   <label className={labelStyle} style={{marginBottom: 0}}>Recebimento Médio (Geral)</label>
                </div>
                <div className="relative">
                   <input type="number" required value={formData.prazo_recebimento_medio_dias} onChange={e => setFormData({...formData, prazo_recebimento_medio_dias: parseInt(e.target.value)})} className={inputStyle} placeholder="Ex: 30" />
                   <span className="absolute right-5 top-4 text-[10px] font-black text-slate-300 uppercase">Dias</span>
                </div>
             </div>

             <div className="p-6 bg-emerald-50/30 border border-emerald-100/50 rounded-3xl space-y-4">
                <div className="flex items-center gap-3">
                   <ShieldCheck size={16} className="text-emerald-600" />
                   <label className={labelStyle} style={{marginBottom: 0, color: '#059669'}}>Repasse Líquido (Opcional)</label>
                </div>
                <div className="relative">
                   <span className="absolute left-4 top-4 text-emerald-300"><Percent size={14} /></span>
                   <input type="number" step="0.1" value={formData.percentual_repasse_liquido} onChange={e => setFormData({...formData, percentual_repasse_liquido: parseFloat(e.target.value) || 100})} className={`${inputStyle} pl-10 border-emerald-100 bg-white`} placeholder="100" />
                </div>
             </div>
          </div>

          <div className="lg:col-span-7 space-y-8">
             
             <div className={`p-8 rounded-[2.5rem] border transition-all duration-500 ${formData.tem_bonus ? 'bg-blue-50/30 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-4">
                      <Zap className={formData.tem_bonus ? 'text-blue-500' : 'text-slate-300'} size={24} />
                      <div>
                         <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Regras de Bonificação</h4>
                         <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Taxas de sucesso ou ativação</p>
                      </div>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={formData.tem_bonus} onChange={e => setFormData({...formData, tem_bonus: e.target.checked})} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                   </label>
                </div>

                {formData.tem_bonus && (
                   <div className="space-y-6 animate-slide-up">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <label className={labelStyle}>Taxa de Bônus (%)</label>
                            <div className="relative">
                               <input type="number" step="0.1" value={formData.taxa_bonus} onChange={e => setFormData({...formData, taxa_bonus: parseFloat(e.target.value)})} className={`${inputStyle} bg-white`} />
                               <span className="absolute right-5 top-4 text-blue-300"><Percent size={14} /></span>
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className={labelStyle}>Modelo de Recebimento</label>
                            <div className="flex bg-white/50 p-1 rounded-2xl border border-blue-100">
                               <button type="button" onClick={() => setFormData({...formData, recebimento_bonus_tipo: 'normal', prazo_bonus_dias: 0})} className={`flex-1 py-2 rounded-xl font-black text-[8px] uppercase transition-all ${formData.recebimento_bonus_tipo === 'normal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>Normal</button>
                               <button type="button" onClick={() => setFormData({...formData, recebimento_bonus_tipo: 'personalizado'})} className={`flex-1 py-2 rounded-xl font-black text-[8px] uppercase transition-all ${formData.recebimento_bonus_tipo === 'personalizado' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400'}`}>Customizado</button>
                            </div>
                         </div>
                      </div>

                      {formData.recebimento_bonus_tipo === 'personalizado' && (
                        <div className="p-6 bg-white rounded-3xl border border-blue-100 animate-slide-up shadow-inner">
                           <label className={labelStyle}>Prazo Médio p/ Recebimento de Bônus</label>
                           <div className="relative">
                              <input type="number" value={formData.prazo_bonus_dias} onChange={e => setFormData({...formData, prazo_bonus_dias: parseInt(e.target.value)})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none text-blue-700" placeholder="Ex: 15" />
                              <span className="absolute right-5 top-3.5 text-[10px] font-black text-blue-300 uppercase">Dias</span>
                           </div>
                        </div>
                      )}
                   </div>
                )}
             </div>

             <div className="p-8 bg-indigo-50/20 border border-indigo-100/50 rounded-[2.5rem] space-y-8">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <RotateCcw className="text-indigo-500" size={24} />
                      <div>
                         <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Fluxos de Repasse</h4>
                         <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Defina as curvas de comissionamento</p>
                      </div>
                   </div>
                </div>

                <div className="space-y-4 animate-slide-up">
                   {!formData.recorrente && (
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3 mb-2">
                         <Info size={16} className="text-amber-600 mt-0.5" />
                         <p className="text-[9px] text-amber-700 font-bold uppercase leading-relaxed">
                            Contratos TEMPORÁRIOS usam duração variável. O prazo exato será definido no cadastro do contrato real do cliente.
                         </p>
                      </div>
                   )}
                   <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {fluxos.map((f, idx) => (
                         <div key={idx} className="bg-white p-6 rounded-[2rem] border border-indigo-100 shadow-sm flex items-center gap-6 relative group animate-slide-up">
                            <div className="h-8 w-8 bg-indigo-50 text-indigo-400 rounded-lg flex items-center justify-center font-black text-xs shrink-0">#{idx+1}</div>
                            
                            <div className="grid grid-cols-2 gap-4 flex-1">
                               <div>
                                  <label className="text-[8px] font-black text-indigo-400 uppercase block mb-1">Taxa Repasse (%)</label>
                                  <input type="number" step="0.1" value={f.percentual_repasse} onChange={e => updateFluxo(idx, 'percentual_repasse', parseFloat(e.target.value))} className="w-full p-2.5 bg-slate-50 rounded-xl font-black text-xs text-indigo-600 outline-none border border-transparent focus:border-indigo-300" />
                               </div>
                               <div>
                                  <div className="flex justify-between items-center mb-1">
                                     <label className="text-[8px] font-black text-indigo-400 uppercase block">Duração (Meses)</label>
                                     <label className="flex items-center gap-1 cursor-pointer">
                                        <input 
                                           type="checkbox" 
                                           disabled={!formData.recorrente}
                                           checked={f.sem_prazo} 
                                           onChange={e => updateFluxo(idx, 'sem_prazo', e.target.checked)} 
                                           className="h-2.5 w-2.5 rounded text-indigo-600 disabled:opacity-30" 
                                        />
                                        <span className={`text-[7px] font-black uppercase ${!formData.recorrente ? 'text-indigo-600' : 'text-slate-400'}`}>Ilimitado</span>
                                     </label>
                                  </div>
                                  <input 
                                     type="number" 
                                     disabled={f.sem_prazo || !formData.recorrente} 
                                     value={f.mes_fim || ''} 
                                     onChange={e => updateFluxo(idx, 'mes_fim', parseInt(e.target.value))} 
                                     className={`w-full p-2.5 bg-slate-50 rounded-xl font-black text-xs text-slate-700 outline-none border border-transparent focus:border-indigo-300 ${f.sem_prazo ? 'opacity-30' : ''}`} 
                                     placeholder={f.sem_prazo ? 'Indeterminado' : 'Até mês...'} 
                                  />
                               </div>
                             </div>
                            
                            {fluxos.length > 1 && formData.recorrente && (
                               <button type="button" onClick={() => removeFluxo(idx)} className="p-2 text-slate-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">✕</button>
                            )}
                         </div>
                      ))}
                   </div>
                   {formData.recorrente && (
                      <button type="button" onClick={addFluxo} className="w-full py-3 bg-white border-2 border-dashed border-indigo-200 text-indigo-400 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:border-indigo-400 hover:text-indigo-600 transition-all">+ Adicionar Fluxo de Duração</button>
                   )}
                </div>
             </div>
          </div>
       </div>

       <div className="flex gap-4 pt-10 border-t border-slate-100">
          <Button variant="ghost" onClick={onCancel} className="flex-1 py-5 text-xs uppercase tracking-widest">Descartar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 py-5 text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 bg-slate-900 text-white hover:bg-slate-800">Sincronizar Modelo Extra</Button>
       </div>
    </form>
  );
};

export default ContratosConfig;