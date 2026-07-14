
import React, { useState, useEffect, useMemo } from 'react';
import { investimentoService } from '../../services/investimentoService';
import { formatarMoeda, formatarData } from '../../utils/formatadores';
import SidePanel from '../UI/SidePanel';
import Confirmacao from '../Confirmacao';
import { Plus, Target, Calendar, Trash2, AlertCircle, CheckCircle2, Wallet } from 'lucide-react';
import { toast } from '../../utils/toast';

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
      toast.error("Falha ao remover objetivo.");
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
        <div className="flex items-center gap-2.5 ml-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <h4 className="text-[10px] font-bold text-faint uppercase tracking-wider">{titulo}</h4>
        </div>
        <div className="bg-surface border border-subtle rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-2 border-b border-subtle">
                <th className="px-5 py-3 font-bold text-faint text-[10px] uppercase tracking-wider">Objetivo</th>
                <th className="px-5 py-3 font-bold text-faint text-[10px] uppercase tracking-wider text-center">Data Alvo</th>
                <th className="px-5 py-3 font-bold text-faint text-[10px] uppercase tracking-wider text-right">Meta (FV)</th>
                <th className="px-5 py-3 font-bold text-faint text-[10px] uppercase tracking-wider text-right">Acumulado Real</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {lista.map(p => {
                const acumulado = calcularAcumuladoReal(p.id);
                const perc = p.valor_alvo > 0 ? Math.min((acumulado / p.valor_alvo) * 100, 100) : 0;

                return (
                  <tr key={p.id} className="hover:bg-surface-2/50 transition-colors group cursor-pointer" onClick={() => { setEditProjeto(p); setModalOpen(true); }}>
                    <td className="px-5 py-4">
                      <p className="font-bold text-main uppercase text-[12px] tracking-tight">{p.nome}</p>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-[4px] uppercase tracking-wider mt-1 inline-block">
                        {p.etapas?.length || 0} ETAPAS
                      </span>
                    </td>
                    <td className="px-5 py-4 text-muted font-bold text-center text-[12px]">{formatarData(p.data_alvo)}</td>
                    <td className="px-5 py-4 font-bold text-main text-right text-[13px] tracking-tighter">{formatarMoeda(p.valor_alvo)}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <p className="font-bold text-emerald-600 text-[13px] tracking-tighter">{formatarMoeda(acumulado)}</p>
                        <div className="w-24 h-1 bg-surface-2 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_5px_rgba(16,185,129,0.5)]" style={{ width: `${perc}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }} className="p-1.5 text-faint hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-colors">
                        <Trash2 size={14} />
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

  const labelStyle = "block text-[11px] font-semibold text-muted mb-1.5";
  const inputStyle = "w-full px-3 h-9 bg-surface-2 border border-subtle rounded-lg font-semibold text-main outline-none focus:border-primary transition-colors text-[13px]";
  const sectionTitle = "text-[11px] font-semibold text-faint uppercase tracking-wider";

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface p-4 px-6 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-[8px] flex items-center justify-center">
            <Target size={20} />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-main uppercase tracking-tight leading-none">Mapa de Objetivos</h3>
            <p className="text-[10px] font-bold text-faint uppercase tracking-wider mt-1">Gestão de metas por fases e etapas</p>
          </div>
        </div>
        <button
          onClick={() => { setEditProjeto({ nome: '', data_alvo: '', etapas: [] }); setModalOpen(true); }}
          className="h-9 px-4 bg-emerald-600 text-white rounded-[8px] font-bold text-[10px] uppercase tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-emerald-700 transition-all flex items-center gap-1.5"
        >
          <Plus size={14} strokeWidth={3} /> Novo Objetivo
        </button>
      </div>

      <div className="space-y-12">
        <TabelaProjeto titulo="Curto Prazo (Desejos imediatos)" lista={filtrarProjetos(null, 2)} />
        <TabelaProjeto titulo="Médio Prazo (Planos estruturais)" lista={filtrarProjetos(2, 5)} />
        <TabelaProjeto titulo="Longo Prazo (Legado e aposentadoria)" lista={filtrarProjetos(5, null)} />

        {!loading && projetos.length === 0 && (
          <div className="py-24 text-center bg-surface-2/50 rounded-3xl border-2 border-dashed border-subtle">
            <Target size={32} className="mx-auto text-faint mb-4" />
            <p className="text-faint font-black uppercase tracking-widest text-[10px]">Nenhum objetivo mapeado para este cliente</p>
          </div>
        )}
      </div>

      <SidePanel
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editProjeto.id ? "Editar Objetivo" : "Novo Objetivo"}
        widthClass="max-w-lg"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors">Cancelar</button>
            <button
              type="submit"
              form="form-objetivo"
              disabled={editProjeto.etapas.length === 0 || !editProjeto.nome || !editProjeto.data_alvo}
              className="flex-[2] h-9 bg-[color:var(--primary)] text-[#0b0e14] font-semibold text-[12px] rounded-lg hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {editProjeto.id ? 'Salvar alterações' : 'Criar objetivo'}
              <CheckCircle2 size={14} />
            </button>
          </div>
        }
      >
        <form id="form-objetivo" onSubmit={handleSave} className="space-y-6">
          {/* ── Dados básicos ── */}
          <section className="space-y-4">
            <h4 className={sectionTitle}>Dados básicos</h4>
            <div>
              <label className={labelStyle}>Nome do Objetivo</label>
              <input required placeholder="Ex: Compra do Imóvel Próprio" value={editProjeto.nome} onChange={e => setEditProjeto({ ...editProjeto, nome: e.target.value })} className={inputStyle} />
            </div>
            <div>
              <label className={labelStyle}>Data Limite</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-[11px] text-faint" />
                <input type="date" required value={editProjeto.data_alvo} onChange={e => setEditProjeto({ ...editProjeto, data_alvo: e.target.value })} className={`${inputStyle} pl-9`} />
              </div>
            </div>
          </section>

          {/* ── Resumo financeiro ── */}
          <section>
            <h4 className={`${sectionTitle} mb-3`}>Resumo financeiro</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-2 rounded-lg p-3 border border-subtle">
                <p className="text-[10px] text-faint mb-1">Valor alvo</p>
                <p className="text-[14px] font-semibold text-main leading-tight">{formatarMoeda(valorTotalSum)}</p>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 border border-subtle">
                <p className="text-[10px] text-faint mb-1">Acumulado real</p>
                <p className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--primary)' }}>{formatarMoeda(editProjeto.id ? calcularAcumuladoReal(editProjeto.id) : 0)}</p>
              </div>
              <div className="bg-surface-2 rounded-lg p-3 border border-subtle">
                <p className="text-[10px] text-faint mb-1">Etapas</p>
                <p className="text-[14px] font-semibold text-main leading-tight">{editProjeto.etapas?.length || 0}</p>
              </div>
            </div>
            <p className="text-[10px] text-faint mt-2">O valor alvo é calculado automaticamente pela soma das fases abaixo.</p>
          </section>

          {/* ── Fases do objetivo ── */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h4 className={sectionTitle}>Fases do objetivo</h4>
              <button type="button" onClick={handleAddEtapa} className="flex items-center gap-1 text-[12px] font-semibold text-[color:var(--primary)] hover:underline">
                <Plus size={13} /> Nova etapa
              </button>
            </div>

            <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar pr-1">
              {editProjeto.etapas?.map((et: Etapa, idx: number) => (
                <div key={et.id} className="flex items-center gap-2 bg-surface-2 border border-subtle rounded-lg p-2">
                  <span className="h-7 w-7 flex items-center justify-center rounded-md bg-surface-3 text-faint text-[11px] font-semibold shrink-0">{idx + 1}</span>
                  <input
                    placeholder="Ex: Entrada, Parcela 01..."
                    value={et.nome}
                    onChange={e => updateEtapa(et.id, 'nome', e.target.value)}
                    className="flex-1 min-w-0 bg-surface border border-subtle rounded-lg h-9 px-3 text-[13px] font-medium text-main outline-none focus:border-primary transition-colors"
                  />
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-2.5 top-2.5 text-[10px] font-semibold text-faint">R$</span>
                    <input
                      type="text"
                      value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(et.valor)}
                      onChange={e => handleMoedaEtapa(et.id, e.target.value)}
                      className="w-full bg-surface border border-subtle rounded-lg h-9 pl-7 pr-2 text-[12px] font-semibold text-main outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <button type="button" onClick={() => removeEtapa(et.id)} className="p-1.5 text-faint hover:text-[color:var(--danger)] rounded-lg transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}

              {(!editProjeto.etapas || editProjeto.etapas.length === 0) && (
                <div className="py-8 text-center border border-dashed border-subtle rounded-lg">
                  <AlertCircle size={20} className="mx-auto text-[color:var(--warning)] mb-2" />
                  <p className="text-[12px] text-muted px-4">Cadastre ao menos uma etapa para validar a meta financeira deste objetivo.</p>
                </div>
              )}
            </div>
          </section>

          {/* ── Ativos vinculados ── */}
          {editProjeto.id && (
            <section>
              <h4 className={`${sectionTitle} mb-3`}>Ativos vinculados</h4>
              {(() => {
                const vinculados = (ativos || []).map((a: any) => {
                  const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'projeto' && o.projeto_id === editProjeto.id);
                  if (!link || link.percentual <= 0) return null;
                  return { id: a.id, nome: a.nome, valor: a.valor_atual * (link.percentual / 100), perc: link.percentual };
                }).filter(Boolean) as any[];
                if (vinculados.length === 0) {
                  return (
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-subtle">
                      <Wallet size={15} className="text-faint shrink-0 mt-0.5" />
                      <p className="text-[12px] text-faint">Nenhum ativo aponta para este objetivo ainda. Vincule um ativo em Carteira Ativa.</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-1.5">
                    {vinculados.map(v => (
                      <div key={v.id} className="flex items-center justify-between gap-2 bg-surface-2 border border-subtle rounded-lg px-3 py-2">
                        <span className="text-[12px] text-muted truncate">{v.nome} <span className="text-faint">({v.perc}%)</span></span>
                        <span className="text-[12px] text-main font-semibold whitespace-nowrap">{formatarMoeda(v.valor)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>
          )}
        </form>
      </SidePanel>

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
