import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { BemPatrimonial, patrimonioService } from '../../services/patrimonioService';
import { TipoBem } from '../../utils/balanco';
import { formatarMoeda } from '../../utils/formatadores';
import { toast } from '../../utils/toast';
import SidePanel from '../UI/SidePanel';
import Button from '../UI/Button';
import CampoMoeda from '../UI/CampoMoeda';
import Confirmacao from '../Confirmacao';

export const ROTULO_BEM: Record<TipoBem, { plural: string; singular: string; exemplo: string }> = {
  imovel: { plural: 'Imóveis', singular: 'imóvel', exemplo: 'Ex: Apartamento em Curitiba' },
  veiculo: { plural: 'Veículos', singular: 'veículo', exemplo: 'Ex: Corolla 2022' },
  empresa: { plural: 'Empresas', singular: 'empresa', exemplo: 'Ex: Participação na Silva Ltda' },
};

interface Props {
  clienteId: string;
  tipo: TipoBem | null;
  onClose: () => void;
  /** Avisa que o cadastro mudou, para o balanço recalcular. */
  onAlterado: () => void;
}

const labelCls = 'text-[11px] font-semibold text-[color:var(--text-muted)] block mb-1';
const inputCls = 'w-full h-[36px] px-3 bg-surface border border-subtle rounded-lg font-medium text-main outline-none focus:border-emerald-500 transition-all text-[13px]';

/** Cadastro e consulta dos bens de um tipo, aberto pelas linhas do balanço. */
const BensDrawer: React.FC<Props> = ({ clienteId, tipo, onClose, onAlterado }) => {
  const [bens, setBens] = useState<BemPatrimonial[]>([]);
  const [form, setForm] = useState<BemPatrimonial | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<BemPatrimonial | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = async () => {
    const todos = await patrimonioService.getBens(clienteId);
    setBens(todos.filter(b => b.tipo === tipo));
  };

  useEffect(() => {
    setForm(null);
    if (tipo) carregar().catch(err => console.error('Erro ao carregar bens:', err));
  }, [tipo, clienteId]);

  if (!tipo) return null;
  const rotulo = ROTULO_BEM[tipo];
  const total = bens.reduce((acc, b) => acc + (Number(b.valor) || 0), 0);

  const salvar = async () => {
    if (!form?.descricao.trim()) { toast.error('Informe a descrição.'); return; }
    setSalvando(true);
    try {
      await patrimonioService.salvarBem({ ...form, descricao: form.descricao.trim() });
      setForm(null);
      await carregar();
      onAlterado();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!paraExcluir?.id) return;
    setExcluindo(true);
    try {
      await patrimonioService.excluirBem(paraExcluir.id);
      setParaExcluir(null);
      await carregar();
      onAlterado();
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <SidePanel open onClose={onClose} title={rotulo.plural} subtitle={`${bens.length} cadastrado(s) · ${formatarMoeda(total)}`}>
      <div className="space-y-4">
        {form ? (
          <div className="bg-surface-2 border border-subtle rounded-xl p-4 space-y-3">
            <div>
              <label className={labelCls}>Descrição</label>
              <input type="text" autoFocus value={form.descricao} placeholder={rotulo.exemplo} className={inputCls}
                onChange={e => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Valor</label>
              <CampoMoeda value={form.valor} onChange={valor => setForm({ ...form, valor })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Observações</label>
              <textarea value={form.observacoes || ''} rows={3}
                className="w-full p-3 bg-surface border border-subtle rounded-lg font-medium text-main outline-none focus:border-emerald-500 transition-all text-[13px] resize-none"
                onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setForm(null)} className="flex-1">Cancelar</Button>
              <Button size="sm" onClick={salvar} isLoading={salvando} className="flex-1">Salvar</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" leftIcon={<Plus size={14} />}
            onClick={() => setForm({ cliente_id: clienteId, tipo, descricao: '', valor: 0, observacoes: '' })}>
            Adicionar {rotulo.singular}
          </Button>
        )}

        {bens.length === 0 ? (
          !form && <p className="py-8 text-center text-[12px] font-medium text-faint">Nenhum registro em {rotulo.plural.toLowerCase()}.</p>
        ) : (
          <div className="rounded-lg border border-subtle divide-y divide-subtle overflow-hidden">
            {bens.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-main truncate">{b.descricao}</span>
                  {b.observacoes && <span className="block text-[11px] text-faint truncate">{b.observacoes}</span>}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="text-[13px] font-bold text-main mr-1">{formatarMoeda(b.valor)}</span>
                  <button type="button" title="Editar" onClick={() => setForm(b)} className="p-1.5 text-faint hover:text-[color:var(--primary)] hover:bg-surface-2 rounded-lg transition-colors"><Edit2 size={13} /></button>
                  <button type="button" title="Excluir" onClick={() => setParaExcluir(b)} className="p-1.5 text-faint hover:text-[color:var(--danger)] hover:bg-surface-2 rounded-lg transition-colors"><Trash2 size={13} /></button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Confirmacao
        isOpen={!!paraExcluir}
        onClose={() => setParaExcluir(null)}
        onConfirm={excluir}
        loading={excluindo}
        title={`Excluir ${rotulo.singular}`}
        message={`Deseja excluir "${paraExcluir?.descricao}"?`}
      />
    </SidePanel>
  );
};

export default BensDrawer;
