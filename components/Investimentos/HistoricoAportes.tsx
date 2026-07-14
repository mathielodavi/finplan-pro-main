
import React, { useEffect, useState } from 'react';
import { investimentoService, HistoricoPatrimonio } from '../../services/investimentoService';
import { formatarMoeda } from '../../utils/formatadores';
import Confirmacao from '../Confirmacao';
import { History, Plus, Edit3, Trash2, Check, X } from 'lucide-react';
import { toast } from '../../utils/toast';

interface FormState {
  data_historico: string;
  valor: string;
  aporte: string;
}

const formInicial = (): FormState => ({ data_historico: new Date().toISOString().split('T')[0], valor: '0', aporte: '0' });

const fLabel = 'block text-[11px] font-semibold text-faint mb-1';
const fInput = 'w-full px-2.5 h-8 bg-surface border border-subtle rounded-lg font-semibold text-[12px] text-main outline-none focus:border-primary transition-colors';

const HistoricoAportes = ({ clienteId }: { clienteId: string }) => {
  const [historico, setHistorico] = useState<HistoricoPatrimonio[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(formInicial());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HistoricoPatrimonio | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await investimentoService.getHistoricoMensal(clienteId);
      setHistorico((data || []).slice().reverse());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clienteId]);

  const handleMoeda = (campo: 'valor' | 'aporte', v: string) => {
    const n = parseInt(v.replace(/\D/g, '') || '0') / 100;
    setForm(p => ({ ...p, [campo]: n.toString() }));
  };

  const iniciarEdicao = (h: HistoricoPatrimonio) => {
    setEditingId(h.id!);
    setForm({ data_historico: h.data_historico, valor: String(h.valor_patrimonio), aporte: String(h.valor_aporte || 0) });
  };

  const iniciarNovo = () => {
    setEditingId('new');
    setForm(formInicial());
  };

  const cancelar = () => { setEditingId(null); setForm(formInicial()); };

  const handleSalvar = async () => {
    const valor_patrimonio = parseFloat(form.valor || '0');
    const valor_aporte = parseFloat(form.aporte || '0');
    setSaving(true);
    try {
      if (editingId === 'new') {
        await investimentoService.registrarSaldoMensal({ cliente_id: clienteId, data_historico: form.data_historico, valor_patrimonio, valor_aporte });
      } else if (editingId) {
        await investimentoService.atualizarHistoricoMensal(editingId, { data_historico: form.data_historico, valor_patrimonio, valor_aporte });
      }
      await load();
      cancelar();
    } catch (err: any) {
      if (err?.code === '23505') {
        toast.info('Já existe um lançamento para esse mês. Edite o lançamento existente em vez de criar outro.');
      } else {
        toast.error('Erro ao salvar histórico: ' + (err?.message || 'erro desconhecido'));
      }
    } finally { setSaving(false); }
  };

  const handleExcluir = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await investimentoService.excluirHistoricoMensal(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + (err?.message || 'erro desconhecido'));
    } finally { setDeleting(false); }
  };

  const linhaForm = (
    <tr className="bg-surface-2">
      <td className="py-2 px-3"><input type="date" value={form.data_historico} onChange={e => setForm(p => ({ ...p, data_historico: e.target.value }))} className={fInput} /></td>
      <td className="py-2 px-3"><input value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(parseFloat(form.valor || '0'))} onChange={e => handleMoeda('valor', e.target.value)} className={`${fInput} text-right`} /></td>
      <td className="py-2 px-3"><input value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(parseFloat(form.aporte || '0'))} onChange={e => handleMoeda('aporte', e.target.value)} className={`${fInput} text-right`} /></td>
      <td className="py-2 px-3 text-right">
        <div className="flex justify-end gap-1">
          <button onClick={handleSalvar} disabled={saving} className="p-1.5 rounded-lg text-[color:var(--primary)] hover:bg-surface-3 transition-colors disabled:opacity-50"><Check size={15} /></button>
          <button onClick={cancelar} className="p-1.5 rounded-lg text-faint hover:bg-surface-3 transition-colors"><X size={15} /></button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="bg-surface rounded-xl border border-subtle overflow-hidden mt-6">
      <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
        <div className="flex items-center gap-2">
          <History size={16} className="text-faint" />
          <h3 className="text-[14px] font-semibold text-main">Histórico de Aportes</h3>
        </div>
        {editingId === null && (
          <button onClick={iniciarNovo} className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors">
            <Plus size={14} /> Novo lançamento
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-[12px] text-faint text-center py-8">Carregando...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-2 border-b border-subtle">
                <th className="py-2.5 px-3 text-[11px] font-semibold text-faint uppercase tracking-wider">Mês</th>
                <th className="py-2.5 px-3 text-[11px] font-semibold text-faint uppercase tracking-wider text-right">Patrimônio (Indep.)</th>
                <th className="py-2.5 px-3 text-[11px] font-semibold text-faint uppercase tracking-wider text-right">Aporte do período</th>
                <th className="py-2.5 px-3 text-[11px] font-semibold text-faint uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle text-[12px]">
              {editingId === 'new' && linhaForm}
              {historico.length === 0 && editingId !== 'new' && (
                <tr><td colSpan={4} className="py-8 text-center text-faint text-[12px]">Nenhum lançamento registrado ainda.</td></tr>
              )}
              {historico.map(h => editingId === h.id ? (
                <React.Fragment key={h.id}>{linhaForm}</React.Fragment>
              ) : (
                <tr key={h.id} className="hover:bg-surface-2/50 transition-colors">
                  <td className="py-2.5 px-3 text-muted font-medium">{new Date(h.data_historico).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</td>
                  <td className="py-2.5 px-3 text-right text-main font-semibold">{formatarMoeda(Number(h.valor_patrimonio))}</td>
                  <td className="py-2.5 px-3 text-right text-muted font-semibold">{Number(h.valor_aporte) > 0 ? formatarMoeda(Number(h.valor_aporte)) : '—'}</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => iniciarEdicao(h)} className="p-1.5 text-faint hover:text-[color:var(--info)] rounded-lg transition-colors"><Edit3 size={14} /></button>
                      <button onClick={() => setDeleteTarget(h)} className="p-1.5 text-faint hover:text-[color:var(--danger)] rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Confirmacao
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleExcluir}
        title="Excluir lançamento"
        message={`Remover o lançamento de ${deleteTarget ? new Date(deleteTarget.data_historico).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : ''}? Isso afeta o gráfico de independência financeira no Resumo Geral.`}
        loading={deleting}
      />
    </div>
  );
};

export default HistoricoAportes;
