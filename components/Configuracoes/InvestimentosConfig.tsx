
import React, { useState, useEffect } from 'react';
import { configService } from '../../services/configuracoesService';
import { protecaoService, ParametrosCalculo } from '../../services/protecaoService';
import SidePanel from '../UI/SidePanel';
import Button from '../UI/Button';
import Badge from '../UI/Badge';
import Confirmacao from '../Confirmacao';
import Tabs from '../UI/Tabs';
import { Landmark, Plus, Trash2, Edit3, Palette, Target, Layers, Infinity, Percent } from 'lucide-react';
import { formatarMoeda } from '../../utils/formatadores';
import { toast } from '../../utils/toast';

const campoInputStyle = "w-full px-3 h-9 bg-surface-2 rounded-[8px] border border-subtle font-bold outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-[12px]";
const campoLabelStyle = "block text-[10px] font-bold text-faint uppercase tracking-wider mb-1.5";

const InvestimentosConfig: React.FC = () => {
  const [subTab, setSubTab] = useState<'asset' | 'estrategias' | 'bancos' | 'parametros'>('asset');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      if (subTab === 'asset') setData(await configService.getAssetAllocations());
      else if (subTab === 'bancos') setData(await configService.getBancos());
      else if (subTab === 'estrategias') setData(await configService.getEstrategias());
      else setData([]);
    } catch (err) {
      console.error("Erro ao carregar dados de investimento:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (subTab !== 'parametros') loadData(); }, [subTab]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (subTab === 'asset') await configService.deleteAssetAllocation(deleteTarget.id);
      else if (subTab === 'bancos') await configService.deleteBanco(deleteTarget.id);
      else if (subTab === 'estrategias') await configService.deleteEstrategia(deleteTarget.id);
      await loadData();
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <Tabs
        tabs={[
          { id: 'asset', label: 'Modelos de Alocação' },
          { id: 'estrategias', label: 'Estratégias Base' },
          { id: 'bancos', label: 'Bancos/Corretoras' },
          { id: 'parametros', label: 'Parâmetros' },
        ]}
        activeTab={subTab}
        onChange={(id) => setSubTab(id as any)}
        size="sm"
      />

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
          onClick={() => { setEditingItem(null); setPanelOpen(true); }}
          leftIcon={<Plus size={14} />}
          className="text-[10px] uppercase tracking-wider px-4 h-9 font-bold"
         >
           Novo Item
         </Button>
      </div>

      <div className="bg-surface rounded-xl border border-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-subtle">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Nome</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">
                  {subTab === 'asset' ? 'Classes de Ativos' : subTab === 'bancos' ? 'Tipo' : 'Níveis'}
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {loading ? (
                <tr><td colSpan={3} className="py-16 text-center animate-pulse text-faint font-bold uppercase tracking-wider text-[10px]">Consultando mercado...</td></tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center">
                     <Landmark size={24} className="mx-auto text-faint mb-3" />
                     <p className="text-faint font-bold uppercase tracking-wider text-[10px]">Sem registros encontrados</p>
                  </td>
                </tr>
              ) : data.map(item => (
                <tr key={item.id} className="hover:bg-surface-2 transition-colors group">
                   <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                         <div className="h-9 w-9 bg-primary/10 text-primary rounded-[8px] flex items-center justify-center shrink-0">
                            {subTab === 'asset' ? <Layers size={16} /> : subTab === 'bancos' ? <Landmark size={16} /> : <Target size={16} />}
                         </div>
                         <p className="font-bold text-main text-[13px] tracking-tight">{item.nome}</p>
                      </div>
                   </td>
                   <td className="px-5 py-3">
                      {subTab === 'asset' && (
                        <div className="space-y-1.5 min-w-[160px]">
                           <p className="text-[9px] font-bold text-faint uppercase tracking-wider">{item.classes?.length || 0} classes</p>
                           <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-surface-2">
                              {item.classes?.map((c: any) => (
                                <div key={c.id} style={{ width: `${c.percentual}%`, backgroundColor: c.cor_rgb }} title={`${c.nome}: ${c.percentual}%`} />
                              ))}
                           </div>
                        </div>
                      )}
                      {subTab === 'estrategias' && (
                        <div className="flex flex-wrap gap-1.5">
                           {item.faixas?.map((f: any, idx: number) => (
                             <Badge key={idx} variant="primary" size="sm">{f.nome || f.nome_faixa}</Badge>
                           ))}
                        </div>
                      )}
                      {subTab === 'bancos' && (
                        <Badge variant="neutral" size="sm">{item.tipo}</Badge>
                      )}
                   </td>
                   <td className="px-5 py-3 text-right">
                      <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-all">
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
        title={`${editingItem ? 'Editar' : 'Novo'} ${subTab === 'asset' ? 'Modelo de Alocação' : subTab === 'bancos' ? 'Banco/Corretora' : 'Estratégia'}`}
        widthClass="max-w-2xl"
      >
         {subTab === 'bancos' && <FormBanco item={editingItem} onSave={() => { setPanelOpen(false); loadData(); }} onCancel={() => setPanelOpen(false)} />}
         {subTab === 'asset' && <FormAsset item={editingItem} onSave={() => { setPanelOpen(false); loadData(); }} onCancel={() => setPanelOpen(false)} />}
         {subTab === 'estrategias' && <FormEstrategia item={editingItem} onSave={() => { setPanelOpen(false); loadData(); }} onCancel={() => setPanelOpen(false)} />}
      </SidePanel>

      <Confirmacao
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Item"
        message={`Tem certeza que deseja excluir permanentemente "${deleteTarget?.nome}"?`}
        loading={isDeleting}
      />
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
      toast.error('Erro ao salvar parâmetros: ' + err.message);
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
          <Percent size={15} className="text-primary" />
          <h4 className="text-[12px] font-semibold text-main">Fator de rentabilização</h4>
        </div>
        <p className="text-[11px] text-faint">
          Usado para projetar o consumo de patrimônio após a independência financeira (renda alvo mensal descontada do patrimônio rentabilizado a esta taxa).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={campoLabelStyle}>Taxa de juros nominal (% a.a.)</label>
            <input type="number" step="0.01" required value={params.taxa_juros_aa}
              onChange={e => setParams({ ...params, taxa_juros_aa: parseFloat(e.target.value) || 0 })}
              className={campoInputStyle} />
          </div>
          <div>
            <label className={campoLabelStyle}>IPCA projetado (% a.a.)</label>
            <input type="number" step="0.01" required value={params.ipca_projetado_aa}
              onChange={e => setParams({ ...params, ipca_projetado_aa: parseFloat(e.target.value) || 0 })}
              className={campoInputStyle} />
          </div>
        </div>
      </div>

      <div className="bg-surface border border-subtle rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Percent size={15} className="text-primary" />
          <h4 className="text-[12px] font-semibold text-main">Custos de Sucessão</h4>
        </div>
        <p className="text-[11px] text-faint">
          Percentual padrão de custos de inventário (honorários, ITCMD, cartório) usado na Etapa de Sucessão quando o cliente não preenche valores próprios.
        </p>
        <div>
          <label className={campoLabelStyle}>Custos de inventário (%)</label>
          <input type="number" step="0.01" required value={params.perc_custos_inventario}
            onChange={e => setParams({ ...params, perc_custos_inventario: parseFloat(e.target.value) || 0 })}
            className={campoInputStyle} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" isLoading={saving} className="h-9 px-5 text-[11px] font-semibold">Salvar parâmetros</Button>
        {saved && <span className="text-[12px] font-semibold text-primary">Salvo com sucesso.</span>}
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
    <form onSubmit={handleSubmit} className="space-y-8">
       <div>
          <label className={campoLabelStyle}>Identificação da Tese Patrimonial</label>
          <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className={campoInputStyle} placeholder="Ex: Modelo Wealth Management 2025" />
       </div>

       <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
             <h4 className="text-[10px] font-bold text-faint uppercase tracking-wider">Níveis de Patrimônio</h4>
             <Button type="button" variant="outline" size="sm" onClick={addFaixa} leftIcon={<Plus size={12} />} className="text-[10px] font-bold">Novo Nível</Button>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
             {faixas.map((f, i) => (
               <div key={i} className="bg-surface-2/50 p-5 rounded-xl border border-subtle space-y-4 relative group">
                  <div className="flex justify-between items-center border-b border-subtle pb-3">
                    <Badge variant="primary" size="sm">Faixa #{i+1}</Badge>
                    <button type="button" onClick={() => removeFaixa(i)} className="p-1.5 text-faint hover:text-danger transition-colors"><Trash2 size={14} /></button>
                  </div>
                  <div className="space-y-3">
                     <div>
                        <label className={campoLabelStyle}>Nome do Nível</label>
                        <input placeholder="Ex: Ultra High" value={f.nome} onChange={e => { const nf = [...faixas]; nf[i].nome = e.target.value; setFaixas(nf); }} className={campoInputStyle} />
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                           <label className={campoLabelStyle}>Valor Mínimo (Piso)</label>
                           <input type="text" value={formatarMoeda(f.intervalo_minimo)} onChange={e => handleMoedaInput(i, 'intervalo_minimo', e.target.value)} className={campoInputStyle} />
                        </div>
                        <div>
                           <div className="flex justify-between items-center mb-1.5">
                              <label className="text-[10px] font-bold text-faint uppercase tracking-wider">Valor Máximo (Teto)</label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                 <input type="checkbox" checked={f.ilimitado} onChange={() => toggleIlimitado(i)} className="h-3 w-3 rounded text-primary focus:ring-0" />
                                 <span className="text-[8px] font-bold text-faint uppercase">Sem Limite</span>
                              </label>
                           </div>
                           {f.ilimitado ? (
                             <div className="w-full h-9 bg-primary/10 rounded-[8px] border border-subtle flex items-center justify-center text-primary">
                                <Infinity size={16} />
                             </div>
                           ) : (
                             <input type="text" value={formatarMoeda(f.intervalo_maximo || 0)} onChange={e => handleMoedaInput(i, 'intervalo_maximo', e.target.value)} className={campoInputStyle} />
                           )}
                        </div>
                     </div>
                  </div>
               </div>
             ))}
          </div>
       </div>

       {error && <div className="p-3 bg-danger/10 border border-subtle text-danger rounded-lg text-[10px] font-bold uppercase tracking-wider text-center">{error}</div>}

       <div className="flex gap-3 pt-6 border-t border-subtle">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 h-9 text-[11px] font-semibold">Descartar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 h-9 text-[11px] font-semibold">Salvar Estratégia</Button>
       </div>
    </form>
  );
};

// --- FORM ASSET ---
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
    <form onSubmit={handleSubmit} className="space-y-8">
       <div>
         <label className={campoLabelStyle}>Nome do Modelo</label>
         <input type="text" required value={nome} onChange={e => setNome(e.target.value)} className={campoInputStyle} placeholder="Ex: Moderado 2025" />
       </div>

       <div className={`p-5 rounded-xl border border-subtle flex items-center justify-center gap-4 ${Math.abs(total - 100) < 0.1 ? 'bg-success/10' : 'bg-danger/10'}`}>
          <div className="h-14 w-14 rounded-full flex items-center justify-center bg-surface shadow-sm border border-subtle">
             <p className={`text-lg font-bold ${Math.abs(total - 100) < 0.1 ? 'text-success' : 'text-danger'}`}>{total.toFixed(0)}%</p>
          </div>
          <p className="text-[10px] font-bold uppercase text-faint">Distribuição Total</p>
       </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          {classes.map((c, i) => (
             <div key={i} className="p-4 bg-surface-2/50 rounded-xl border border-subtle space-y-3">
                <input value={c.nome} onChange={e => updateClass(i, 'nome', e.target.value)} className={campoInputStyle} />
                <div className="flex gap-3 items-center">
                   <div className="flex-1 flex items-center bg-surface px-3 rounded-[8px] border border-subtle h-9">
                      <input type="number" step="0.1" value={c.percentual} onChange={e => updateClass(i, 'percentual', e.target.value)} className="w-full bg-transparent font-bold text-[12px] outline-none" />
                      <span className="text-[10px] font-bold text-faint">%</span>
                   </div>
                   <div className="relative h-9 w-9 shrink-0 bg-surface rounded-[8px] border border-subtle overflow-hidden">
                      <input type="color" value={c.cor_rgb} onChange={e => updateClass(i, 'cor_rgb', e.target.value)} className="absolute inset-0 scale-[3] cursor-pointer" />
                      <Palette size={12} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white mix-blend-difference pointer-events-none" />
                   </div>
                </div>
             </div>
          ))}
       </div>

       {error && <div className="p-3 bg-danger/10 border border-subtle text-danger rounded-lg text-[10px] font-bold uppercase tracking-wider text-center">{error}</div>}

       <div className="flex gap-3 pt-6 border-t border-subtle">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 h-9 text-[11px] font-semibold">Descartar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 h-9 text-[11px] font-semibold">Salvar Modelo</Button>
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
    <form onSubmit={handleSubmit} className="space-y-8">
       <div>
         <label className={campoLabelStyle}>Razão Social / Nome Fantasia</label>
         <input type="text" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className={campoInputStyle} placeholder="Ex: XP Investimentos" />
       </div>
       <div>
         <label className={campoLabelStyle}>Tipo de Instituição</label>
         <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className={campoInputStyle}>
            <option value="banco">Banco de Varejo</option>
            <option value="corretora">Corretora de Valores</option>
            <option value="offshore">Instituição Offshore</option>
         </select>
       </div>
       <div className="flex gap-3 pt-6 border-t border-subtle">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 h-9 text-[11px] font-semibold">Cancelar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 h-9 text-[11px] font-semibold">Confirmar</Button>
       </div>
    </form>
  );
};

export default InvestimentosConfig;
