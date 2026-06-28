
import React, { useState, useMemo } from 'react';
import { investimentoService } from '../../services/investimentoService';
import { formatarMoeda } from '../../utils/formatadores';
import SidePanel from '../UI/SidePanel';
import Confirmacao from '../Confirmacao';
import { Plus, Calendar, Trash2, AlertCircle, CheckCircle2, Wallet } from 'lucide-react';

interface Etapa {
  id: string;
  nome: string;
  valor: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  editProjeto: any;
  setEditProjeto: (p: any) => void;
  ativos: any[];
  clienteId: string;
  onSaved: () => void;
}

const labelStyle = "block text-[11px] font-semibold text-muted mb-1.5";
const inputStyle = "w-full px-3 h-9 bg-surface-2 border border-subtle rounded-lg font-semibold text-main outline-none focus:border-primary transition-colors text-[13px]";
const sectionTitle = "text-[11px] font-semibold text-faint uppercase tracking-wider";

const ObjetivoFormDrawer: React.FC<Props> = ({ open, onClose, editProjeto, setEditProjeto, ativos, clienteId, onSaved }) => {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const calcularAcumuladoReal = (projetoId: string) => {
    return (ativos || []).reduce((acc, a) => {
      const linkProjeto = (a.distribuicao_objetivos || []).find(
        (o: any) => o.tipo === 'projeto' && o.projeto_id === projetoId
      );
      const valor = linkProjeto ? a.valor_atual * (linkProjeto.percentual / 100) : 0;
      return acc + valor;
    }, 0);
  };

  const valorTotalSum = useMemo(() => {
    return (editProjeto?.etapas || []).reduce((acc: number, curr: Etapa) => acc + (curr.valor || 0), 0);
  }, [editProjeto?.etapas]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProjeto || (editProjeto.etapas || []).length === 0) return;

    await investimentoService.salvarProjeto({
      ...editProjeto,
      cliente_id: clienteId,
      valor_alvo: valorTotalSum,
    });
    onSaved();
    onClose();
  };

  const handleConfirmDelete = async () => {
    if (!editProjeto?.id) return;
    setDeleting(true);
    try {
      await investimentoService.deletarProjeto(editProjeto.id);
      setConfirmDelete(false);
      onSaved();
      onClose();
    } catch {
      alert('Falha ao remover objetivo.');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddEtapa = () => {
    const nova: Etapa = { id: crypto.randomUUID(), nome: '', valor: 0 };
    setEditProjeto({ ...editProjeto, etapas: [...(editProjeto?.etapas || []), nova] });
  };

  const updateEtapa = (id: string, field: keyof Etapa, val: any) => {
    const novas = (editProjeto?.etapas || []).map((e: Etapa) => e.id === id ? { ...e, [field]: val } : e);
    setEditProjeto({ ...editProjeto, etapas: novas });
  };

  const removeEtapa = (id: string) => {
    setEditProjeto({ ...editProjeto, etapas: (editProjeto?.etapas || []).filter((e: Etapa) => e.id !== id) });
  };

  const handleMoedaEtapa = (id: string, val: string) => {
    const numeric = parseInt(val.replace(/\D/g, "")) / 100;
    updateEtapa(id, 'valor', numeric || 0);
  };

  if (!editProjeto) return null;

  return (
    <>
      <SidePanel
        open={open}
        onClose={onClose}
        title={editProjeto.id ? "Editar Objetivo" : "Novo Objetivo"}
        widthClass="max-w-lg"
        footer={
          <div className="flex gap-3">
            {editProjeto.id && (
              <button type="button" onClick={() => setConfirmDelete(true)} className="h-9 px-3 rounded-lg border border-subtle text-[color:var(--danger)] font-semibold text-[12px] hover:bg-surface-2 transition-colors">
                Excluir
              </button>
            )}
            <button type="button" onClick={onClose} className="flex-1 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors">Cancelar</button>
            <button
              type="submit"
              form="form-objetivo"
              disabled={(editProjeto.etapas || []).length === 0 || !editProjeto.nome || !editProjeto.data_alvo}
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
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Objetivo"
        message={`Deseja remover permanentemente o objetivo "${editProjeto?.nome}"? Esta ação removerá a meta e os vínculos de rebalanceamento vinculados.`}
        loading={deleting}
      />
    </>
  );
};

export default ObjetivoFormDrawer;
