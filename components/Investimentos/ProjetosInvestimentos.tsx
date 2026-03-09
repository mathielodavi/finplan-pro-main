
import React, { useState, useEffect, useMemo } from 'react';
import { investimentoService } from '../../services/investimentoService';
import { formatarMoeda, formatarData } from '../../utils/formatadores';
import Modal from '../Modal';
import Confirmacao from '../Confirmacao';
import { Plus, Target, Calendar, DollarSign, Trash2, Layers, ChevronRight, Info, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Etapa {
  id: string;
  nome: string;
  valor: number;
}

const ProjetosInvestimentos = ({ clienteId, ativos = [] }: { clienteId: string, ativos: any[] }) => {
  const [projetos, setProjetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [editProjeto, setEditProjeto] = useState<any>({
    nome: '',
    data_alvo: '',
    valor_alvo: 0,
    etapas: [] as Etapa[]
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await investimentoService.getProjetos(clienteId);
      setProjetos(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [clienteId]);

  const calcularAcumuladoReal = (projetoId: string) => {
    return ativos.reduce((acc, a) => {
      const linkProjeto = (a.distribuicao_objetivos || []).find(
        (o: any) => o.tipo === 'projeto' && o.projeto_id === projetoId
      );
      const valor = linkProjeto ? a.valor_atual * (linkProjeto.percentual / 100) : 0;
      return acc + valor;
    }, 0);
  };

  const valorTotalSum = useMemo(() => {
    return (editProjeto.etapas || []).reduce((acc: number, curr: Etapa) => acc + (curr.valor || 0), 0);
  }, [editProjeto.etapas]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editProjeto.etapas.length === 0) return;

    await investimentoService.salvarProjeto({
      ...editProjeto,
      cliente_id: clienteId,
      valor_alvo: valorTotalSum
    });

    setModalOpen(false);
    load();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await investimentoService.deletarProjeto(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      alert("Falha ao remover objetivo.");
    } finally {
      setDeleting(false);
    }
  };

  const handleAddEtapa = () => {
    const nova: Etapa = { id: crypto.randomUUID(), nome: '', valor: 0 };
    setEditProjeto({ ...editProjeto, etapas: [...(editProjeto.etapas || []), nova] });
  };

  const updateEtapa = (id: string, field: keyof Etapa, val: any) => {
    const novas = editProjeto.etapas.map((e: Etapa) => e.id === id ? { ...e, [field]: val } : e);
    setEditProjeto({ ...editProjeto, etapas: novas });
  };

  const removeEtapa = (id: string) => {
    setEditProjeto({ ...editProjeto, etapas: editProjeto.etapas.filter((e: Etapa) => e.id !== id) });
  };

  const handleMoedaEtapa = (id: string, val: string) => {
    const numeric = parseInt(val.replace(/\D/g, "")) / 100;
    updateEtapa(id, 'valor', numeric || 0);
  };

  const filtrarProjetos = (anosMin: number | null, anosMax: number | null) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return projetos.filter(p => {
      const dataAlvo = new Date(p.data_alvo);
      dataAlvo.setHours(0, 0, 0, 0);

      const diffAnos = (dataAlvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

      if (anosMin === null) return diffAnos < (anosMax || 0);
      if (anosMax === null) return diffAnos >= anosMin;
      return diffAnos >= anosMin && diffAnos < anosMax;
    });
  };

  const TabelaProjeto = ({ titulo, lista }: { titulo: string, lista: any[] }) => {
    if (lista.length === 0) return null;
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 ml-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{titulo}</h4>
        </div>
        <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest">Objetivo</th>
                <th className="px-8 py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest text-center">Data Alvo</th>
                <th className="px-8 py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest text-right">Meta (FV)</th>
                <th className="px-8 py-4 font-black text-slate-400 text-[9px] uppercase tracking-widest text-right">Acumulado Real</th>
                <th className="px-8 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lista.map(p => {
                const acumulado = calcularAcumuladoReal(p.id);
                const perc = p.valor_alvo > 0 ? Math.min((acumulado / p.valor_alvo) * 100, 100) : 0;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/30 transition-all group cursor-pointer" onClick={() => { setEditProjeto(p); setModalOpen(true); }}>
                    <td className="px-8 py-5">
                      <p className="font-black text-slate-800 uppercase text-xs tracking-tight">{p.nome}</p>
                      <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-tighter mt-1 inline-block">
                        {p.etapas?.length || 0} ETAPAS
                      </span>
                    </td>
                    <td className="px-8 py-5 text-slate-500 font-bold text-center text-xs">{formatarData(p.data_alvo)}</td>
                    <td className="px-8 py-5 font-black text-slate-900 text-right text-xs">{formatarMoeda(p.valor_alvo)}</td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex flex-col items-end">
                        <p className="font-black text-emerald-600 text-xs">{formatarMoeda(acumulado)}</p>
                        <div className="w-24 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${perc}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const labelStyle = "block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1";
  const inputStyle = "w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm";

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 px-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <Target size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none">Mapa de Objetivos</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gestão de metas por fases e etapas</p>
          </div>
        </div>
        <button
          onClick={() => { setEditProjeto({ nome: '', data_alvo: '', etapas: [] }); setModalOpen(true); }}
          className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2"
        >
          <Plus size={16} strokeWidth={3} /> Novo Objetivo
        </button>
      </div>

      <div className="space-y-12">
        <TabelaProjeto titulo="Curto Prazo (Desejos imediatos)" lista={filtrarProjetos(null, 2)} />
        <TabelaProjeto titulo="Médio Prazo (Planos estruturais)" lista={filtrarProjetos(2, 5)} />
        <TabelaProjeto titulo="Longo Prazo (Legado e aposentadoria)" lista={filtrarProjetos(5, null)} />

        {!loading && projetos.length === 0 && (
          <div className="py-24 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
            <Target size={32} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Nenhum objetivo mapeado para este cliente</p>
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editProjeto.id ? "Editar Objetivo" : "Novo Objetivo"} size="wide">
        <form onSubmit={handleSave} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
            {/* LADO ESQUERDO: Dados e Resumo */}
            <div className="md:col-span-5 space-y-8">
              <div className="space-y-6">
                <div>
                  <label className={labelStyle}>Nome do Objetivo</label>
                  <input required placeholder="Ex: Compra do Imóvel Próprio" value={editProjeto.nome} onChange={e => setEditProjeto({ ...editProjeto, nome: e.target.value })} className={inputStyle} />
                </div>
                <div>
                  <label className={labelStyle}>Data Limite (Deadline)</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-4 top-4 text-slate-300" />
                    <input type="date" required value={editProjeto.data_alvo} onChange={e => setEditProjeto({ ...editProjeto, data_alvo: e.target.value })} className={`${inputStyle} pl-12`} />
                  </div>
                </div>
              </div>

              {/* DASHBOARD DE VALORES NO MODAL */}
              <div className="p-6 bg-slate-900 rounded-3xl text-white shadow-2xl relative overflow-hidden group">
                <div className="relative z-10 space-y-8">
                  <div>
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.2em] block mb-3">Valor Total Alvo</span>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-black">{formatarMoeda(valorTotalSum)}</p>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">(Soma das etapas)</span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Acumulado Real</span>
                      <p className="text-base font-black text-emerald-400">{formatarMoeda(editProjeto.id ? calcularAcumuladoReal(editProjeto.id) : 0)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Status</span>
                      <p className="text-xs font-black text-emerald-300 uppercase tracking-widest">{editProjeto.etapas?.length || 0} Etapas</p>
                    </div>
                  </div>
                </div>
                <Target size={120} className="absolute -bottom-6 -right-6 text-white/5 group-hover:scale-110 transition-transform duration-700" />
              </div>

              <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl flex items-start gap-4 animate-fade-in">
                <Info size={20} className="text-blue-500 shrink-0" />
                <p className="text-[10px] text-blue-700 font-bold uppercase leading-relaxed">
                  O valor total do projeto é calculado automaticamente pela soma das fases registradas ao lado.
                </p>
              </div>
            </div>

            {/* LADO DIREITO: Gestão de Etapas */}
            <div className="md:col-span-7 space-y-6">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <Layers size={16} className="text-emerald-500" />
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fases do Objetivo</h4>
                </div>
                <button type="button" onClick={handleAddEtapa} className="bg-white border border-slate-200 text-emerald-600 px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                  + Nova Etapa
                </button>
              </div>

              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-3 custom-scrollbar">
                {editProjeto.etapas?.map((et: Etapa, idx: number) => (
                  <div key={et.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex items-center gap-4 group hover:border-emerald-200 transition-all shadow-sm">
                    <div className="h-8 w-8 bg-slate-50 rounded-lg flex items-center justify-center font-black text-slate-300 text-[10px] shrink-0 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                      {idx + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        placeholder="Ex: Entrada, Parcela 01..."
                        value={et.nome}
                        onChange={e => updateEtapa(et.id, 'nome', e.target.value)}
                        className="w-full bg-slate-50 border-transparent focus:bg-white focus:border-emerald-200 border rounded-xl px-4 py-2 text-xs font-bold outline-none transition-all"
                      />
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-[10px] font-black text-slate-300 uppercase">R$</span>
                        <input
                          type="text"
                          value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(et.valor)}
                          onChange={e => handleMoedaEtapa(et.id, e.target.value)}
                          className="w-full bg-slate-50 border-transparent focus:bg-white focus:border-emerald-200 border rounded-xl pl-9 pr-4 py-2 text-xs font-black text-emerald-600 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <button type="button" onClick={() => removeEtapa(et.id)} className="p-2 text-slate-200 hover:text-rose-500 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {(!editProjeto.etapas || editProjeto.etapas.length === 0) && (
                  <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
                    <AlertCircle size={32} className="mx-auto text-amber-300 mb-4" />
                    <p className="text-slate-400 font-black uppercase text-[9px] tracking-widest max-w-[250px] mx-auto leading-relaxed">
                      É obrigatório o cadastro de ao menos uma etapa para validar a meta financeira deste objetivo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-8 border-t border-slate-100">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-5 font-black text-slate-400 uppercase text-xs tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
            <button
              type="submit"
              disabled={editProjeto.etapas.length === 0 || !editProjeto.nome || !editProjeto.data_alvo}
              className="flex-[2] py-5 font-black text-white uppercase text-xs bg-slate-900 rounded-[1.5rem] shadow-2xl tracking-[0.2em] hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
            >
              {editProjeto.id ? 'Sincronizar Atualizações' : 'Formalizar Objetivo'}
              <CheckCircle2 size={18} />
            </button>
          </div>
        </form>
      </Modal>

      <Confirmacao
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Objetivo"
        message={`Deseja remover permanentemente o objetivo "${deleteTarget?.nome}"? Esta ação removerá a meta e os vínculos de rebalanceamento vinculados.`}
        loading={deleting}
      />
    </div>
  );
};

export default ProjetosInvestimentos;
