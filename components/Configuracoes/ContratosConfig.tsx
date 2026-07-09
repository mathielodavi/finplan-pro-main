import React, { useState, useEffect } from 'react';
import { configService } from '../../services/configuracoesService';
import { formatarMoeda } from '../../utils/formatadores';
import SidePanel from '../UI/SidePanel';
import Button from '../UI/Button';
import Badge from '../UI/Badge';
import InputMoeda from '../UI/InputMoeda';
import InputPercentual from '../UI/InputPercentual';
import Tabs from '../UI/Tabs';
import Confirmacao from '../Confirmacao';
import { Edit3, Trash2, Plus, FileText, Calendar, Clock, Zap, ShieldCheck, Info, RotateCcw } from 'lucide-react';

// Estilo compartilhado entre FormPlanejamento e FormExtra (campos sem InputMoeda/Percentual, ex: texto/select/dias).
const campoInputStyle = "w-full px-3 h-9 bg-surface-2 rounded-[8px] border border-subtle font-bold outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-[12px]";
const campoLabelStyle = "block text-[10px] font-bold text-faint uppercase tracking-wider mb-1.5";

const ContratosConfig: React.FC = () => {
  const [subTab, setSubTab] = useState<'planejamento' | 'extra'>('planejamento');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
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
      <Tabs
        tabs={[
          { id: 'planejamento', label: 'Planejamento' },
          { id: 'extra', label: 'Serviços Extras' },
        ]}
        activeTab={subTab}
        onChange={(id) => setSubTab(id as 'planejamento' | 'extra')}
        size="sm"
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h3 className="text-[16px] font-bold text-main tracking-tight leading-none">Modelos de {subTab}</h3>
            <p className="text-faint text-[10px] font-bold uppercase tracking-wider mt-1">Padronize prazos e regras de faturamento</p>
         </div>
         <Button
          onClick={() => { setEditingItem(null); setPanelOpen(true); }}
          leftIcon={<Plus size={14} />}
          className="text-[10px] uppercase tracking-wider px-4 h-9 font-bold"
         >
           Novo Padrão
         </Button>
      </div>

      <div className="bg-surface rounded-xl border border-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 border-b border-subtle">
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Nome</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Atributos</th>
                <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-faint">Prazo Recebimento</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {loading ? (
                <tr><td colSpan={4} className="py-16 text-center animate-pulse text-faint font-bold uppercase tracking-wider text-[10px]">Carregando modelos...</td></tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <FileText size={24} className="mx-auto text-faint mb-3" />
                    <p className="text-faint font-bold uppercase tracking-wider text-[10px]">Nenhum modelo cadastrado</p>
                  </td>
                </tr>
              ) : data.map(item => (
                <tr key={item.id} className="hover:bg-surface-2 transition-colors group">
                   <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                         <div className="h-9 w-9 rounded-[8px] flex items-center justify-center bg-primary/10 text-primary shrink-0">
                            <FileText size={16} />
                         </div>
                         <p className="font-bold text-main text-[13px] tracking-tight">{item.nome}</p>
                      </div>
                   </td>
                   <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1.5">
                         {subTab === 'planejamento' ? (
                           <>
                             <Badge variant="neutral" size="sm">Ciclo: {item.prazo_meses || 'Indet.'} m</Badge>
                             {item.valor_fixo && <Badge variant="success" size="sm">Fixo: {formatarMoeda(item.valor)}</Badge>}
                           </>
                         ) : (
                           <>
                             <Badge variant="primary" size="sm">{item.tipo}</Badge>
                             <Badge variant={item.recorrente ? 'success' : 'warning'} size="sm">{item.recorrente ? 'Recorrente' : 'Temporário'}</Badge>
                             {item.tem_bonus && <Badge variant="info" size="sm">Bônus: {item.taxa_bonus}%</Badge>}
                           </>
                         )}
                      </div>
                   </td>
                   <td className="px-5 py-3">
                      <Badge variant="neutral" size="sm">D+{item.prazo_recebimento_medio_dias || item.prazo_recebimento_parcelado_dias}d</Badge>
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
        title={`${editingItem ? 'Editar' : 'Novo'} Padrão de ${subTab}`}
        widthClass="max-w-2xl"
      >
         {subTab === 'planejamento' ? (
           <FormPlanejamento item={editingItem} onSave={() => { setPanelOpen(false); loadData(); }} onCancel={() => setPanelOpen(false)} />
         ) : (
           <FormExtra item={editingItem} onSave={() => { setPanelOpen(false); loadData(); }} onCancel={() => setPanelOpen(false)} />
         )}
      </SidePanel>

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

  return (
    <form id="form-planejamento" onSubmit={handleSubmit} className="space-y-8">
       <div>
         <label className={campoLabelStyle}>Identificação do Plano</label>
         <input type="text" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className={campoInputStyle} placeholder="Ex: Consultoria Premium 2025" />
       </div>

       <div>
         <label className={campoLabelStyle}>Duração Padrão (Meses)</label>
         <div className="relative">
           <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
           <input type="number" required value={formData.prazo_meses} onChange={e => setFormData({...formData, prazo_meses: parseInt(e.target.value)})} className={`${campoInputStyle} pl-9`} />
         </div>
       </div>

       <div className="p-5 bg-success/10 rounded-xl border border-subtle">
          <label className="flex items-center gap-3 cursor-pointer group">
             <input type="checkbox" checked={formData.valor_fixo} onChange={e => setFormData({...formData, valor_fixo: e.target.checked})} className="h-5 w-5 rounded border-subtle text-primary focus:ring-0" />
             <span className="text-[11px] font-bold text-success uppercase tracking-widest">Contrato com Valor Fixo</span>
          </label>
          {formData.valor_fixo && (
            <div className="mt-4 animate-slide-up">
               <InputMoeda label="Valor Bruto Sugerido" value={formData.valor} onChange={valor => setFormData({...formData, valor})} />
            </div>
          )}
       </div>

       <div className="p-5 bg-surface-2/50 border border-subtle rounded-xl space-y-4">
          <span className="text-[10px] font-bold text-faint uppercase tracking-wider block border-b border-subtle pb-2">Regras de Recebimento (D+x)</span>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className={campoLabelStyle}>À Vista (dias)</label>
                <input type="number" value={formData.prazo_recebimento_vista_dias} onChange={e => setFormData({...formData, prazo_recebimento_vista_dias: parseInt(e.target.value)})} className={campoInputStyle} />
             </div>
             <div>
                <label className={campoLabelStyle}>Parcelado (dias)</label>
                <input type="number" value={formData.prazo_recebimento_parcelado_dias} onChange={e => setFormData({...formData, prazo_recebimento_parcelado_dias: parseInt(e.target.value)})} className={campoInputStyle} />
             </div>
          </div>
       </div>

       <InputPercentual label="% Repasse Líquido Consultor" value={formData.percentual_repasse} onChange={percentual_repasse => setFormData({...formData, percentual_repasse})} casas={1} />

       <div className="flex gap-3 pt-6 border-t border-subtle">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 h-9 text-[11px] font-semibold">Cancelar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 h-9 text-[11px] font-semibold">Confirmar Modelo</Button>
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

  return (
    <form id="form-extra" onSubmit={handleSubmit} className="space-y-8 animate-fade-in">
       <div>
         <label className={campoLabelStyle}>Nome do Serviço Adicional</label>
         <input type="text" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className={campoInputStyle} placeholder="Ex: Seguro de Vida Individual" />
       </div>

       <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
             <label className={campoLabelStyle}>Periodicidade</label>
             <div className="flex bg-surface-2 p-1 rounded-lg border border-subtle">
                <button type="button" onClick={() => setFormData({...formData, recorrente: true})} className={`flex-1 py-2 rounded-md font-bold text-[9px] uppercase transition-all ${formData.recorrente ? 'bg-surface text-success shadow-sm' : 'text-faint'}`}>Recorrente</button>
                <button type="button" onClick={() => setFormData({...formData, recorrente: false})} className={`flex-1 py-2 rounded-md font-bold text-[9px] uppercase transition-all ${!formData.recorrente ? 'bg-surface text-warning shadow-sm' : 'text-faint'}`}>Temporário</button>
             </div>
          </div>
          <div className="space-y-2">
             <label className={campoLabelStyle}>Tipo de Contrato</label>
             <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className={campoInputStyle}>
                <option value="Seguros">Seguros</option>
                <option value="Planos de Saúde">Planos de Saúde</option>
                <option value="Consultoria de Investimentos">Consultoria de Investimentos</option>
                <option value="Consultoria PJ">Consultoria PJ</option>
                <option value="Crédito">Crédito</option>
                <option value="Outros">Outros</option>
             </select>
          </div>
       </div>

       <div className="p-5 bg-surface-2/50 border border-subtle rounded-xl space-y-3">
          <div className="flex items-center gap-3">
             <Clock size={16} className="text-faint" />
             <label className={campoLabelStyle} style={{marginBottom: 0}}>Recebimento Médio (Geral)</label>
          </div>
          <div className="relative">
             <input type="number" required value={formData.prazo_recebimento_medio_dias} onChange={e => setFormData({...formData, prazo_recebimento_medio_dias: parseInt(e.target.value)})} className={campoInputStyle} placeholder="Ex: 30" />
             <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-faint uppercase">Dias</span>
          </div>
       </div>

       <div className="p-5 bg-success/10 border border-subtle rounded-xl space-y-3">
          <div className="flex items-center gap-3">
             <ShieldCheck size={16} className="text-success" />
             <label className={campoLabelStyle} style={{marginBottom: 0, color: 'var(--success)'}}>Repasse Líquido (Opcional)</label>
          </div>
          <InputPercentual value={formData.percentual_repasse_liquido} onChange={v => setFormData({...formData, percentual_repasse_liquido: v || 100})} casas={1} placeholder="100" />
       </div>

       <div className={`p-6 rounded-xl border border-subtle transition-all duration-500 ${formData.tem_bonus ? 'bg-info/10' : 'bg-surface-2'}`}>
          <div className="flex items-center justify-between mb-5">
             <div className="flex items-center gap-3">
                <Zap className={formData.tem_bonus ? 'text-info' : 'text-faint'} size={20} />
                <div>
                   <h4 className="text-[12px] font-bold text-main uppercase tracking-tight">Regras de Bonificação</h4>
                   <p className="text-[9px] text-faint font-bold uppercase mt-0.5">Taxas de sucesso ou ativação</p>
                </div>
             </div>
             <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={formData.tem_bonus} onChange={e => setFormData({...formData, tem_bonus: e.target.checked})} className="sr-only peer" />
                <div className="w-11 h-6 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-subtle after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-info"></div>
             </label>
          </div>

          {formData.tem_bonus && (
             <div className="space-y-5 animate-slide-up">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <InputPercentual label="Taxa de Bônus (%)" value={formData.taxa_bonus} onChange={taxa_bonus => setFormData({...formData, taxa_bonus})} casas={1} />
                   <div className="space-y-2">
                      <label className={campoLabelStyle}>Modelo de Recebimento</label>
                      <div className="flex bg-surface p-1 rounded-lg border border-subtle">
                         <button type="button" onClick={() => setFormData({...formData, recebimento_bonus_tipo: 'normal', prazo_bonus_dias: 0})} className={`flex-1 py-2 rounded-md font-bold text-[8px] uppercase transition-all ${formData.recebimento_bonus_tipo === 'normal' ? 'bg-info text-white shadow-sm' : 'text-faint'}`}>Normal</button>
                         <button type="button" onClick={() => setFormData({...formData, recebimento_bonus_tipo: 'personalizado'})} className={`flex-1 py-2 rounded-md font-bold text-[8px] uppercase transition-all ${formData.recebimento_bonus_tipo === 'personalizado' ? 'bg-info text-white shadow-sm' : 'text-faint'}`}>Customizado</button>
                      </div>
                   </div>
                </div>

                {formData.recebimento_bonus_tipo === 'personalizado' && (
                  <div className="p-4 bg-surface rounded-xl border border-subtle animate-slide-up">
                     <label className={campoLabelStyle}>Prazo Médio p/ Recebimento de Bônus</label>
                     <div className="relative">
                        <input type="number" value={formData.prazo_bonus_dias} onChange={e => setFormData({...formData, prazo_bonus_dias: parseInt(e.target.value)})} className={campoInputStyle} placeholder="Ex: 15" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-info uppercase">Dias</span>
                     </div>
                  </div>
                )}
             </div>
          )}
       </div>

       <div className="p-6 bg-primary/10 border border-subtle rounded-xl space-y-6">
          <div className="flex items-center gap-3">
             <RotateCcw className="text-primary" size={20} />
             <div>
                <h4 className="text-[12px] font-bold text-main uppercase tracking-tight">Fluxos de Repasse</h4>
                <p className="text-[9px] text-faint font-bold uppercase mt-0.5">Defina as curvas de comissionamento</p>
             </div>
          </div>

          <div className="space-y-3">
             {!formData.recorrente && (
                <div className="p-3 bg-warning/10 border border-subtle rounded-lg flex items-start gap-2">
                   <Info size={14} className="text-warning mt-0.5 shrink-0" />
                   <p className="text-[9px] text-warning font-bold uppercase leading-relaxed">
                      Contratos TEMPORÁRIOS usam duração variável. O prazo exato será definido no cadastro do contrato real do cliente.
                   </p>
                </div>
             )}
             <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {fluxos.map((f, idx) => (
                   <div key={idx} className="bg-surface p-4 rounded-xl border border-subtle flex items-center gap-4 relative group">
                      <div className="h-7 w-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0">#{idx+1}</div>

                      <div className="grid grid-cols-2 gap-3 flex-1">
                         <InputPercentual label="Taxa Repasse" value={f.percentual_repasse} onChange={v => updateFluxo(idx, 'percentual_repasse', v)} casas={1} />
                         <div>
                            <div className="flex justify-between items-center mb-1.5">
                               <label className="text-[8px] font-bold text-faint uppercase block">Duração (Meses)</label>
                               <label className="flex items-center gap-1 cursor-pointer">
                                  <input
                                     type="checkbox"
                                     disabled={!formData.recorrente}
                                     checked={f.sem_prazo}
                                     onChange={e => updateFluxo(idx, 'sem_prazo', e.target.checked)}
                                     className="h-2.5 w-2.5 rounded text-primary disabled:opacity-30"
                                  />
                                  <span className={`text-[7px] font-bold uppercase ${!formData.recorrente ? 'text-primary' : 'text-faint'}`}>Ilimitado</span>
                               </label>
                            </div>
                            <input
                               type="number"
                               disabled={f.sem_prazo || !formData.recorrente}
                               value={f.mes_fim || ''}
                               onChange={e => updateFluxo(idx, 'mes_fim', parseInt(e.target.value))}
                               className={`${campoInputStyle} ${f.sem_prazo ? 'opacity-30' : ''}`}
                               placeholder={f.sem_prazo ? 'Indeterminado' : 'Até mês...'}
                            />
                         </div>
                       </div>

                      {fluxos.length > 1 && formData.recorrente && (
                         <button type="button" onClick={() => removeFluxo(idx)} className="p-2 text-faint hover:text-danger transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                      )}
                   </div>
                ))}
             </div>
             {formData.recorrente && (
                <Button type="button" variant="outline" onClick={addFluxo} leftIcon={<Plus size={12} />} className="w-full text-[11px] font-semibold">Adicionar Fluxo</Button>
             )}
          </div>
       </div>

       <div className="flex gap-3 pt-6 border-t border-subtle">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 h-9 text-[11px] font-semibold">Descartar</Button>
          <Button type="submit" isLoading={loading} className="flex-1 h-9 text-[11px] font-semibold">Sincronizar Modelo Extra</Button>
       </div>
    </form>
  );
};

export default ContratosConfig;
