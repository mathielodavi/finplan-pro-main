
import React, { useState, useEffect } from 'react';
import { configService } from '../../services/configuracoesService';
import { protecaoService, ParametrosCalculo } from '../../services/protecaoService';
import Modal from '../Modal';
import Button from '../UI/Button';
import { Landmark, Plus, Trash2, Edit3, Palette, Target, Layers, TrendingUp, Infinity, Percent } from 'lucide-react';
import { formatarMoeda } from '../../utils/formatadores';

const InvestimentosConfig: React.FC = () => {
  const [subTab, setSubTab] = useState<'asset' | 'personalizacao' | 'bancos' | 'parametros'>('asset');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      if (subTab === 'asset') setData(await configService.getAssetAllocations());
      else if (subTab === 'bancos') setData(await configService.getBancos());
      else if (subTab === 'personalizacao') setData(await configService.getEstrategias());
      else setData([]);
    } catch (err) {
      console.error("Erro ao carregar dados de investimento:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (subTab !== 'parametros') loadData(); }, [subTab]);

  const handleDeleteItem = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este item?")) return;
    try {
      if (subTab === 'asset') await configService.deleteAssetAllocation(id);
      else if (subTab === 'bancos') await configService.deleteBanco(id);
      else if (subTab === 'personalizacao') await configService.deleteEstrategia(id);
      loadData();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex bg-surface-2 p-1 rounded-[8px] w-fit border border-subtle h-9">
        <button onClick={() => setSubTab('asset')} className={`px-4 rounded-[6px] font-bold text-[10px] uppercase tracking-wider transition-all h-full flex items-center whitespace-nowrap ${subTab === 'asset' ? 'bg-surface text-indigo-600 shadow-sm border border-subtle/50' : 'text-faint hover:text-muted'}`}>Asset Allocation</button>
        <button onClick={() => setSubTab('personalizacao')} className={`px-4 rounded-[6px] font-bold text-[10px] uppercase tracking-wider transition-all h-full flex items-center whitespace-nowrap ${subTab === 'personalizacao' ? 'bg-surface text-indigo-600 shadow-sm border border-subtle/50' : 'text-faint hover:text-muted'}`}>Estratégias Base</button>
        <button onClick={() => setSubTab('bancos')} className={`px-4 rounded-[6px] font-bold text-[10px] uppercase tracking-wider transition-all h-full flex items-center whitespace-nowrap ${subTab === 'bancos' ? 'bg-surface text-indigo-600 shadow-sm border border-subtle/50' : 'text-faint hover:text-muted'}`}>Bancos/Corretoras</button>
        <button onClick={() => setSubTab('parametros')} className={`px-4 rounded-[6px] font-bold text-[10px] uppercase tracking-wider transition-all h-full flex items-center whitespace-nowrap ${subTab === 'parametros' ? 'bg-surface text-indigo-600 shadow-sm border border-subtle/50' : 'text-faint hover:text-muted'}`}>Parâmetros</button>
      </div>

      {subTab === 'parametros' ? (
        <ParametrosForm />
      ) : (
      <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h3 className="text-[16px] font-bold text-main tracking-tight leading-none">
               {subTab === 'asset' ? 'Modelos de Alocação' : subTab === 'bancos' ? 'Instituições Parceiras' : 'Estratégias Base'}
            </h3>
            <p className="text-faint text-[10px] font-bold uppercase tracking-wider mt-1">Personalize as teses de mercado da sua consultoria</p>
         </div>
         <Button
          onClick={() => { setEditingItem(null); setModalOpen(true); }}
          leftIcon={<Plus size={14} />}
          className="text-[10px] uppercase tracking-wider px-4 h-9 font-bold"
         >
           Novo Item
         </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center animate-pulse text-faint font-bold uppercase tracking-wider text-[10px]">Consultando mercado...</div>
        ) : data.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-surface-2 rounded-xl border-2 border-dashed border-subtle">
             <Landmark size={24} className="mx-auto text-faint mb-3" />
             <p className="text-faint font-bold uppercase tracking-wider text-[10px]">Sem registros encontrados</p>
          </div>
        ) : (
          data.map(item => (
            <div key={item.id} className="px-5 py-4 bg-surface border border-subtle rounded-xl flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-indigo-200 transition-all group relative overflow-hidden">
               <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-[8px] flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                        {subTab === 'asset' ? <Layers size={18} /> : subTab === 'bancos' ? <Landmark size={18} /> : <Target size={18} />}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button onClick={() => { setEditingItem(item); setModalOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-[8px] transition-all"><Edit3 size={14} /></button>
                        <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-[8px] transition-all"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <h4 className="font-bold text-main text-[13px] tracking-tight leading-none mb-2">{item.nome}</h4>
                  
                  {subTab === 'asset' && (
                    <div className="space-y-3 mt-3">
                       <p className="text-[9px] font-bold text-faint uppercase tracking-wider">{item.classes?.length || 0} Classes de Ativos</p>
                       <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-surface-2">
                          {item.classes?.map((c: any) => (
                            <div key={c.id} style={{ width: `${c.percentual}%`, backgroundColor: c.cor_rgb }} title={`${c.nome}: ${c.percentual}%`} />
                          ))}
                       </div>
                    </div>
                  )}

                  {subTab === 'personalizacao' && (
                    <div className="space-y-2 mt-3">
                       <p className="text-[9px] font-bold text-faint uppercase tracking-wider">{item.faixas?.length || 0} Níveis Definidos</p>
                       <div className="flex flex-wrap gap-1">
                          {item.faixas?.map((f: any, idx: number) => (
                            <span key={idx} className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-[6px] border border-indigo-100">{f.nome || f.nome_faixa}</span>
                          ))}
                       </div>
                    </div>
                  )}

                  {subTab === 'bancos' && (
                    <div className="flex items-center gap-2 mt-3">
                       <span className="text-[9px] font-bold bg-surface-3 text-white px-2 py-0.5 rounded-[6px] uppercase tracking-wider">{item.tipo}</span>
                    </div>
                  )}
               </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`${editingItem ? 'Editar' : 'Novo'} Parâmetro de ${subTab === 'asset' ? 'Alocação' : subTab === 'bancos' ? 'Bancos' : 'Estratégia'}`}>
         {subTab === 'bancos' && <FormBanco item={editingItem} onSave={() => { setModalOpen(false); loadData(); }} onCancel={() => setModalOpen(false)} />}
         {subTab === 'asset' && <FormAsset item={editingItem} onSave={() => { setModalOpen(false); loadData(); }} onCancel={() => setModalOpen(false)} />}
         {subTab === 'personalizacao' && <FormEstrategia item={editingItem} onSave={() => { setModalOpen(false); loadData(); }} onCancel={() => setModalOpen(false)} />}
      </Modal>
      </>
      )}
    </div>
  );
};

// --- FORM PARÂMETROS GERAIS ---

const ParametrosForm: React.FC = () => {
  const [params, setParams] = useState<ParametrosCalculo>({ taxa_juros_aa: 6.25, ipca_projetado_aa: 4.50, perc_custos_inventario: 20.00 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    protecaoService.getParametros().then(p => setParams(p)).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await protecaoService.salvarParametros(params);
      setSaved(true);
    } catch (err: any) {
      alert('Erro ao salvar parâmetros: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center animate-pulse text-faint font-bold uppercase tracking-wider text-[10px]">Carregando parâmetros...</div>;
  }

  return (
    <form onSubmit={handleSave} className="max-w-lg space-y-6">
      <div>
        <h3 className="text-[16px] font-bold text-main tracking-tight leading-none">Parâmetros Gerais de Cálculo</h3>
        <p className="text-faint text-[10px] font-bold uppercase tracking-wider mt-1">Taxas usadas nas projeções atuariais e de independência financeira</p>
      </div>

      <div className="bg-surface border border-subtle rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Percent size={15} className="text-[color:var(--primary)]" />
          <h4 className="text-[12px] font-semibold text-main">Fator de rentabilização</h4>
        </div>
        <p className="text-[11px] text-faint">
          Usado para projetar o consumo de patrimônio após a independência financeira (renda alvo mensal descontada do patrimônio rentabilizado a esta taxa).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-muted mb-1.5">Taxa de juros nominal (% a.a.)</label>
            <input type="number" step="0.01" required value={params.taxa_juros_aa}
              onChange={e => setParams({ ...params, taxa_juros_aa: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 h-9 bg-surface-2 border border-subtle rounded-lg font-semibold text-[13px] text-main outline-none focus:border-primary transition-colors" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted mb-1.5">IPCA projetado (% a.a.)</label>
            <input type="number" step="0.01" required value={params.ipca_projetado_aa}
              onChange={e => setParams({ ...params, ipca_projetado_aa: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 h-9 bg-surface-2 border border-subtle rounded-lg font-semibold text-[13px] text-main outline-none focus:border-primary transition-colors" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" isLoading={saving} className="h-9 px-5 text-[11px] font-bold uppercase tracking-wider">Salvar parâmetros</Button>
        {saved && <span className="text-[12px] font-semibold" style={{ color: 'var(--primary)' }}>Salvo com sucesso.</span>}
      </div>
    </form>
  );
};

// --- FORM ESTRATÉGIA ---

const FormEstrategia = ({ item, onSave, onCancel }: any) => {
  const [nome, setNome] = useState(item?.nome || '');
  const [faixas, setFaixas] = useState<any[]>(() => {
    if (item?.faixas && item.faixas.length > 0) {
      return item.faixas.map((f: any) => ({
        ...f,
        nome: f.nome || f.nome_faixa,
        ilimitado: f.intervalo_maximo === null || f.intervalo_maximo === undefined
      }));
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMoedaInput = (idx: number, field: string, value: string) => {
    let clean = value.replace(/\D/g, "");
    if (!clean) clean = "0";
    const numeric = parseInt(clean) / 100;
    const nf = [...faixas];
    nf[idx][field] = numeric;
    setFaixas(nf);
  };

  const toggleIlimitado = (idx: number) => {
    const nf = [...faixas];
    const status = !nf[idx].ilimitado;
    nf[idx].ilimitado = status;
    if (status) nf[idx].intervalo_maximo = null;
    else nf[idx].intervalo_maximo = 0;
    setFaixas(nf);
  };

  const addFaixa = () => {
    setFaixas([...faixas, { nome: '', intervalo_minimo: 0, intervalo_maximo: 0, ilimitado: false }]);
  };

  const removeFaixa = (idx: number) => {
    setFaixas(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await configService.saveEstrategia({ id: item?.id, nome }, faixas);
      onSave();
    } catch (err: any) {
      setError(err.message || "Erro de sincronização. Execute o script SQL fornecido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
       <div className="bg-surface-2/50 p-8 rounded-[2.5rem] border border-subtle">
          <label className="block text-[10px] font-black text-faint uppercase tracking-widest mb-3 ml-1">Identificação da Tese Patrimonial</label>
          <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="w-full p-5 bg-surface rounded-2xl border border-subtle font-black outline-none text-base focus:ring-4 focus:ring-emerald-500/5 transition-all shadow-sm" placeholder="Ex: Modelo Wealth Management 2025" />
       </div>

       <div className="space-y-6">
          <div className="flex justify-between items-center px-2">
             <h4 className="text-xs font-black text-main uppercase tracking-widest">Níveis de Patrimônio</h4>
             <button type="button" onClick={addFaixa} className="text-emerald-600 font-black text-[10px] uppercase tracking-widest bg-emerald-50 px-6 py-2.5 rounded-xl border border-emerald-100 shadow-sm">+ Novo Nível</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
             {faixas.map((f, i) => (
               <div key={i} className="bg-surface p-8 rounded-[2.5rem] border border-subtle space-y-6 relative group hover:border-emerald-300 transition-all shadow-sm">
                  <div className="flex justify-between items-center border-b border-subtle pb-4">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-4 py-1.5 rounded-full italic">Faixa #{i+1}</span>
                    <button type="button" onClick={() => removeFaixa(i)} className="p-2 text-faint hover:text-rose-500 transition-colors">✕</button>
                  </div>
                  <div className="space-y-5">
                     <div>
                        <label className="text-[8px] font-black text-faint uppercase mb-2 block ml-1 tracking-widest">Nome do Nível</label>
                        <input placeholder="Ex: Ultra High" value={f.nome} onChange={e => { const nf = [...faixas]; nf[i].nome = e.target.value; setFaixas(nf); }} className="w-full p-4 bg-surface-2 rounded-xl border border-subtle font-black text-sm shadow-sm focus:bg-surface focus:border-emerald-500 outline-none transition-all" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <label className="text-[8px] font-black text-faint uppercase mb-2 block ml-1 tracking-widest">Valor Mínimo (Piso)</label>
                           <input type="text" value={formatarMoeda(f.intervalo_minimo)} onChange={e => handleMoedaInput(i, 'intervalo_minimo', e.target.value)} className="w-full p-4 bg-surface-2 rounded-xl border border-subtle font-black text-sm shadow-sm outline-none focus:bg-surface focus:border-emerald-500" />
                        </div>
                        <div>
                           <div className="flex justify-between items-center mb-2 ml-1">
                              <label className="text-[8px] font-black text-faint uppercase tracking-widest">Valor Máximo (Teto)</label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                 <input type="checkbox" checked={f.ilimitado} onChange={() => toggleIlimitado(i)} className="h-3 w-3 rounded text-emerald-600 focus:ring-0" />
                                 <span className="text-[7px] font-black text-faint uppercase">Sem Limite</span>
                              </label>
                           </div>
                           <div className="relative">
                             {f.ilimitado ? (
                               <div className="w-full p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-center justify-center text-emerald-600">
                                  <Infinity size={20} />
                               </div>
                             ) : (
                               <input type="text" value={formatarMoeda(f.intervalo_maximo || 0)} onChange={e => handleMoedaInput(i, 'intervalo_maximo', e.target.value)} className="w-full p-4 bg-surface-2 rounded-xl border border-subtle font-black text-sm shadow-sm outline-none focus:bg-surface focus:border-emerald-500" />
                             )}
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
             ))}
          </div>
       </div>

       {error && <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center animate-slide-up">⚠ {error}</div>}

       <div className="flex gap-3 pt-6 border-t border-subtle">
          <Button variant="ghost" onClick={onCancel} className="flex-1 h-9 text-[11px] font-bold uppercase tracking-wider">Descartar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 h-9 text-[11px] font-bold uppercase tracking-wider">Salvar Estratégia</Button>
       </div>
    </form>
  );
};

// --- FORM ASSET (Mantido) ---
const FormAsset = ({ item, onSave, onCancel }: any) => {
  const [nome, setNome] = useState(item?.nome || '');
  const [classes, setClasses] = useState<any[]>(() => {
    if (item?.classes && item.classes.length > 0) return [...item.classes];
    return [
      { nome: 'Caixa / Reserva', percentual: 20, cor_rgb: '#6366f1', ordem: 0 },
      { nome: 'Renda Fixa IPCA+', percentual: 20, cor_rgb: '#10b981', ordem: 1 },
      { nome: 'Ações Brasil', percentual: 20, cor_rgb: '#f59e0b', ordem: 2 },
      { nome: 'Internacional', percentual: 20, cor_rgb: '#ef4444', ordem: 3 },
      { nome: 'Alternativos', percentual: 20, cor_rgb: '#8b5cf6', ordem: 4 }
    ];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = classes.reduce((acc, c) => acc + Number(c.percentual), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Math.abs(total - 100) > 0.1) return setError("A soma das alocações deve ser exatamente 100%.");
    setLoading(true);
    try {
      await configService.saveAssetAllocation({ id: item?.id, nome }, classes);
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateClass = (idx: number, field: string, val: any) => {
    const nc = [...classes];
    nc[idx] = { ...nc[idx], [field]: val };
    setClasses(nc);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-10">
       <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-4 space-y-8 border-r border-subtle pr-8">
             <div>
               <label className="block text-[10px] font-black text-faint uppercase tracking-widest mb-3 ml-1">Nome do Modelo</label>
               <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className="w-full p-5 bg-surface-2 rounded-2xl border border-subtle font-black outline-none text-sm focus:ring-4" placeholder="Ex: Moderado 2025" />
             </div>
             <div className={`p-8 rounded-[2.5rem] border flex flex-col items-center justify-center text-center space-y-4 shadow-inner ${Math.abs(total - 100) < 0.1 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                <div className="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center bg-surface shadow-xl">
                   <p className={`text-2xl font-black ${Math.abs(total - 100) < 0.1 ? 'text-emerald-600' : 'text-rose-600'}`}>{total.toFixed(0)}%</p>
                </div>
                <p className="text-[10px] font-black uppercase text-faint">Distribuição Total</p>
             </div>
          </div>
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
             {classes.map((c, i) => (
                <div key={i} className="p-6 bg-surface-2/50 rounded-3xl border border-subtle">
                   <div className="space-y-4">
                      <input value={c.nome} onChange={e => updateClass(i, 'nome', e.target.value)} className="w-full p-2.5 bg-surface border border-subtle rounded-xl font-bold text-xs outline-none" />
                      <div className="flex gap-4 items-center">
                         <div className="flex-1 flex items-center bg-surface px-3 rounded-xl border border-subtle">
                            <input type="number" step="0.1" value={c.percentual} onChange={e => updateClass(i, 'percentual', e.target.value)} className="w-full p-2 font-black text-xs outline-none" />
                            <span className="text-[10px] font-black text-faint">%</span>
                         </div>
                         <div className="relative h-10 w-10 shrink-0 bg-surface rounded-xl border border-subtle overflow-hidden shadow-sm">
                            <input type="color" value={c.cor_rgb} onChange={e => updateClass(i, 'cor_rgb', e.target.value)} className="absolute inset-0 scale-[3] cursor-pointer" />
                            <Palette size={14} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white mix-blend-difference pointer-events-none" />
                         </div>
                      </div>
                   </div>
                </div>
             ))}
          </div>
       </div>
       <div className="flex gap-3 pt-6 border-t border-subtle">
          <Button variant="ghost" onClick={onCancel} className="flex-1 h-9 text-[11px] font-bold uppercase tracking-wider">Descartar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 h-9 text-[11px] font-bold uppercase tracking-wider">Salvar Modelo</Button>
       </div>
    </form>
  );
};

const FormBanco = ({ item, onSave, onCancel }: any) => {
  const [formData, setFormData] = useState(item || { nome: '', tipo: 'banco' });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await configService.saveBanco(formData);
      onSave();
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-10">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <label className="block text-[10px] font-black text-faint uppercase tracking-widest mb-3 ml-1">Razão Social / Nome Fantasia</label>
            <input type="text" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full p-5 bg-surface-2 rounded-2xl border border-subtle font-black outline-none" placeholder="Ex: XP Investimentos" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-faint uppercase tracking-widest mb-3 ml-1">Tipo de Instituição</label>
            <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className="w-full p-5 bg-surface-2 rounded-2xl border border-subtle font-black text-sm">
               <option value="banco">🏦 Banco de Varejo</option>
               <option value="corretora">📊 Corretora de Valores</option>
               <option value="offshore">🌐 Instituição Offshore</option>
            </select>
          </div>
       </div>
       <div className="flex gap-3 pt-6 border-t border-subtle">
          <Button variant="ghost" onClick={onCancel} className="flex-1 h-9 text-[11px] font-bold uppercase tracking-wider">Cancelar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 h-9 text-[11px] font-bold uppercase tracking-wider">Confirmar</Button>
       </div>
    </form>
  );
};

export default InvestimentosConfig;
