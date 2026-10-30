import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Plus, Trash2, UserRound, Users } from 'lucide-react';
import { Cliente, atualizarCliente } from '../../services/clienteService';
import { Familiar, PARENTESCOS, PARENTESCO_CONJUGE, familiaService } from '../../services/familiaService';
import { calcularIdade, mascaraCPF, mascaraTelefone } from '../../utils/calculosFinanceiros';
import { UFS } from '../../utils/formatadores';
import { toast } from '../../utils/toast';
import SidePanel from '../UI/SidePanel';
import Button from '../UI/Button';
import Confirmacao from '../Confirmacao';

interface Props {
  cliente: Cliente;
  onUpdate: () => void;
}

const labelCls = 'text-[11px] font-semibold text-[color:var(--text-muted)] block mb-1';
const inputCls = 'w-full h-[34px] px-2.5 bg-surface border border-subtle rounded-lg font-medium text-main outline-none focus:border-emerald-500 transition-all text-[12px]';

/**
 * Família do cliente: o titular em destaque, com os dados do cadastro editáveis, e os familiares
 * vinculados. É o cadastro único usado pela Proteção e pelo levantamento.
 */
const QuadranteFamilia: React.FC<Props> = ({ cliente, onUpdate }) => {
  const [familiares, setFamiliares] = useState<Familiar[]>([]);
  const [titular, setTitular] = useState({ telefone: '', email: '', estado: '', cpf: '', profissao: '' });
  const [form, setForm] = useState<Familiar | null>(null);
  const [anterior, setAnterior] = useState<Familiar | undefined>();
  const [salvando, setSalvando] = useState(false);
  const [paraRemover, setParaRemover] = useState<Familiar | null>(null);
  const [removendo, setRemovendo] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setFamiliares(await familiaService.listar(cliente.id!));
    } catch (err) {
      console.error('Erro ao carregar familiares:', err);
    }
  }, [cliente.id]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    setTitular({
      telefone: cliente.telefone || '',
      email: cliente.email || '',
      estado: cliente.estado || '',
      cpf: cliente.cpf || '',
      profissao: cliente.profissao || '',
    });
  }, [cliente]);

  const salvarTitular = async (campo: keyof typeof titular, valor: string) => {
    if ((cliente[campo] || '') === valor) return;
    try {
      await atualizarCliente(cliente.id!, { [campo]: valor || null } as Partial<Cliente>);
      onUpdate();
    } catch (err: any) {
      toast.error(`Erro ao salvar o cadastro: ${err.message}`);
    }
  };

  const novoFamiliar = () => {
    const temConjuge = familiares.some(f => f.parentesco === PARENTESCO_CONJUGE);
    setAnterior(undefined);
    setForm({ cliente_id: cliente.id!, parentesco: temConjuge ? 'Filho(a)' : PARENTESCO_CONJUGE, nome: '', ordem: familiares.length });
  };

  const editarFamiliar = (f: Familiar) => {
    setAnterior(f);
    setForm({ ...f });
  };

  const salvarFamiliar = async () => {
    if (!form?.nome.trim()) { toast.error('Informe o nome do familiar.'); return; }
    setSalvando(true);
    try {
      await familiaService.salvar({ ...form, nome: form.nome.trim() }, anterior);
      setForm(null);
      await carregar();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar o familiar.');
    } finally {
      setSalvando(false);
    }
  };

  const removerFamiliar = async () => {
    if (!paraRemover) return;
    setRemovendo(true);
    try {
      await familiaService.remover(paraRemover);
      setParaRemover(null);
      setForm(null);
      await carregar();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover o familiar.');
      setParaRemover(null);
    } finally {
      setRemovendo(false);
    }
  };

  const campoFamiliar = (campo: keyof Familiar, valor: string) => setForm(f => f ? { ...f, [campo]: valor || null } : f);
  const outroConjuge = familiares.some(f => f.parentesco === PARENTESCO_CONJUGE && f.id !== form?.id);

  return (
    <section className="bg-surface rounded-xl border border-subtle overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-subtle flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-[color:var(--primary)]" />
          <h3 className="text-[13px] font-semibold text-main">Família</h3>
        </div>
        <Button onClick={novoFamiliar} size="sm" variant="outline" leftIcon={<Plus size={14} />}>Familiar</Button>
      </div>

      <div className="p-4 border-b border-subtle" style={{ backgroundColor: 'var(--primary-soft)' }}>
        <div className="flex items-center gap-2 mb-3">
          <UserRound size={15} className="text-[color:var(--primary)] shrink-0" />
          <p className="text-[14px] font-bold text-main truncate">{cliente.nome}</p>
          <span className="text-[11px] font-medium text-muted shrink-0">Titular</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={labelCls}>Telefone</label>
            <input type="tel" value={titular.telefone} className={inputCls} placeholder="(00) 00000-0000"
              onChange={e => setTitular(t => ({ ...t, telefone: mascaraTelefone(e.target.value) }))}
              onBlur={e => salvarTitular('telefone', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select value={titular.estado} className={inputCls}
              onChange={e => { setTitular(t => ({ ...t, estado: e.target.value })); salvarTitular('estado', e.target.value); }}>
              <option value="">Não informado</option>
              {UFS.map(uf => <option key={uf.sigla} value={uf.sigla}>{uf.nome}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>E-mail</label>
            <input type="email" value={titular.email} className={inputCls} placeholder="cliente@exemplo.com"
              onChange={e => setTitular(t => ({ ...t, email: e.target.value }))}
              onBlur={e => salvarTitular('email', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>CPF</label>
            <input type="text" value={titular.cpf} maxLength={14} className={inputCls} placeholder="000.000.000-00"
              onChange={e => setTitular(t => ({ ...t, cpf: mascaraCPF(e.target.value) }))}
              onBlur={e => salvarTitular('cpf', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Profissão</label>
            <input type="text" value={titular.profissao} className={inputCls}
              onChange={e => setTitular(t => ({ ...t, profissao: e.target.value }))}
              onBlur={e => salvarTitular('profissao', e.target.value)} />
          </div>
        </div>
      </div>

      {familiares.length === 0 ? (
        <div className="py-8 text-center text-faint font-medium text-[12px]">Nenhum familiar cadastrado.</div>
      ) : (
        <div className="divide-y divide-subtle">
          {familiares.map(f => {
            const idade = calcularIdade(f.data_nascimento || '');
            return (
              <button key={f.id} type="button" onClick={() => editarFamiliar(f)}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left group">
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-main truncate">{f.nome}</span>
                  <span className="block text-[11px] text-faint truncate">{f.parentesco}{idade !== null ? ` · ${idade} anos` : ''}</span>
                </span>
                <ChevronRight size={14} className="text-faint group-hover:text-muted shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      <SidePanel
        open={!!form}
        onClose={() => setForm(null)}
        title={anterior ? 'Editar familiar' : 'Novo familiar'}
        subtitle={cliente.nome}
        footer={(
          <div className="flex gap-2">
            {anterior && (
              <button type="button" onClick={() => setParaRemover(anterior)} className="h-9 px-4 rounded-lg border border-subtle text-[color:var(--danger)] font-semibold text-[12px] hover:bg-surface-2 transition-colors flex items-center gap-1.5">
                <Trash2 size={14} /> Remover
              </button>
            )}
            <Button onClick={salvarFamiliar} isLoading={salvando} className="flex-1 h-9 text-[12px] font-semibold">Salvar</Button>
          </div>
        )}
      >
        {form && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Parentesco</label>
              <select value={form.parentesco} className={inputCls} onChange={e => setForm({ ...form, parentesco: e.target.value })}>
                {PARENTESCOS.filter(p => p !== PARENTESCO_CONJUGE || !outroConjuge).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nome completo</label>
              <input type="text" value={form.nome} className={inputCls} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data de nascimento</label>
                <input type="date" value={form.data_nascimento || ''} max={new Date().toISOString().split('T')[0]} className={inputCls}
                  onChange={e => campoFamiliar('data_nascimento', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>CPF</label>
                <input type="text" value={form.cpf || ''} maxLength={14} className={inputCls} placeholder="000.000.000-00"
                  onChange={e => campoFamiliar('cpf', mascaraCPF(e.target.value))} />
              </div>
              <div>
                <label className={labelCls}>Telefone</label>
                <input type="tel" value={form.telefone || ''} className={inputCls} placeholder="(00) 00000-0000"
                  onChange={e => campoFamiliar('telefone', mascaraTelefone(e.target.value))} />
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select value={form.estado || ''} className={inputCls} onChange={e => campoFamiliar('estado', e.target.value)}>
                  <option value="">Não informado</option>
                  {UFS.map(uf => <option key={uf.sigla} value={uf.sigla}>{uf.nome}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>E-mail</label>
              <input type="email" value={form.email || ''} className={inputCls} onChange={e => campoFamiliar('email', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Profissão</label>
              <input type="text" value={form.profissao || ''} className={inputCls} onChange={e => campoFamiliar('profissao', e.target.value)} />
            </div>
          </div>
        )}
      </SidePanel>

      <Confirmacao
        isOpen={!!paraRemover}
        onClose={() => setParaRemover(null)}
        onConfirm={removerFamiliar}
        loading={removendo}
        title="Remover familiar"
        message={`Deseja remover ${paraRemover?.nome} da família?`}
      />
    </section>
  );
};

export default QuadranteFamilia;
