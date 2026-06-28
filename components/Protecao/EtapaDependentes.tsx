
import React from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { DependenteSeguro } from '../../services/protecaoService';
import { calcularIdade } from '../../utils/calculosFinanceiros';
import { protecaoService } from '../../services/protecaoService';

const inp = "w-full px-3 h-[36px] bg-surface border border-subtle rounded-lg font-medium text-main text-[13px] outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all placeholder:text-faint";
const lbl = "block text-[12px] font-semibold text-[color:var(--text-muted)] ml-1 mb-1.5";

const PARENTESCOS = ['Filho(a)', 'Enteado(a)', 'Pai', 'Mãe', 'Irmão/Irmã', 'Outro'];

interface Props {
    clienteId: string;
    dependentes: DependenteSeguro[];
    onChange: (deps: DependenteSeguro[]) => void;
}

const EtapaDependentes: React.FC<Props> = ({ clienteId, dependentes, onChange }) => {
    const novoDependente = (): DependenteSeguro => ({
        cliente_id: clienteId,
        ordem: dependentes.length,
        nome_dependente: '',
        parentesco: 'Filho(a)',
        cobertura_anos: 10,
        auxilio_mensal: 0,
    });

    const salvar = async (deps: DependenteSeguro[]) => {
        try {
            await protecaoService.salvarDependentes(
                clienteId,
                deps.map(d => ({
                    ordem: d.ordem,
                    nome_dependente: d.nome_dependente,
                    data_nascimento_dep: d.data_nascimento_dep,
                    parentesco: d.parentesco,
                    cobertura_anos: d.cobertura_anos,
                    auxilio_mensal: d.auxilio_mensal,
                    total_calculado: d.total_calculado,
                }))
            );
        } catch (err) { console.error('[EtapaDependentes]', err); }
    };

    const add = () => {
        if (dependentes.length >= 10) return;
        const novo = [...dependentes, novoDependente()];
        onChange(novo);
        salvar(novo);
    };

    const remove = (i: number) => {
        if (dependentes.length <= 1) return;
        const atualizado = dependentes.filter((_, idx) => idx !== i).map((d, idx) => ({ ...d, ordem: idx }));
        onChange(atualizado);
        salvar(atualizado);
    };

    const update = (i: number, campo: keyof DependenteSeguro, valor: any) => {
        const atualizado = dependentes.map((d, idx) => idx === i ? { ...d, [campo]: valor } : d);
        onChange(atualizado);
        salvar(atualizado);
    };

    return (
        <div className="space-y-4">
            {/* Instruções */}
            <div className="rounded-[12px] border border-[color:var(--border)] overflow-hidden shadow-[var(--shadow-card)]">
                <div className="bg-surface-2 px-5 py-3.5 border-b border-[color:var(--border)] flex items-center gap-3">
                    <Users size={16} className="text-emerald-500" />
                    <p className="text-[12px] font-semibold text-main uppercase tracking-widest">Dependentes</p>
                    <span className="ml-auto text-[11px] font-bold text-faint">{dependentes.length} / 10</span>
                </div>
                <div className="px-5 py-4 bg-surface">
                    <p className="text-[13px] text-[color:var(--text-muted)] font-medium">
                        Informe os dependentes do cliente. Eles serão utilizados nos cálculos de cobertura educacional nas próximas etapas.
                    </p>
                </div>
            </div>

            {/* Lista de dependentes */}
            <div className="space-y-3">
                {dependentes.map((dep, i) => {
                    const idade = calcularIdade(dep.data_nascimento_dep || '');
                    return (
                        <div key={i} className="rounded-[12px] border border-[color:var(--border)] overflow-hidden bg-surface shadow-sm">
                            {/* Header do card */}
                            <div className="bg-surface-2 px-5 py-3.5 border-b border-[color:var(--border)] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">
                                        {i + 1}
                                    </span>
                                    <span className="text-[12px] font-semibold text-main uppercase tracking-widest">
                                        {dep.nome_dependente?.trim() || `Dependente ${i + 1}`}
                                    </span>
                                    {idade !== null && (
                                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                            {idade} anos
                                        </span>
                                    )}
                                </div>
                                {dependentes.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => remove(i)}
                                        className="p-1.5 rounded-lg text-faint hover:text-rose-500 hover:bg-rose-50 transition-all"
                                        title="Remover dependente"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>

                            {/* Campos */}
                            <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1">
                                    <label className={lbl}>Nome completo <span className="text-rose-400">*</span></label>
                                    <input
                                        type="text"
                                        value={dep.nome_dependente}
                                        onChange={e => update(i, 'nome_dependente', e.target.value)}
                                        className={inp}
                                        placeholder="Nome completo"
                                    />
                                </div>
                                <div>
                                    <label className={lbl}>Data de nascimento</label>
                                    <input
                                        type="date"
                                        value={dep.data_nascimento_dep || ''}
                                        onChange={e => update(i, 'data_nascimento_dep', e.target.value)}
                                        className={inp}
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div>
                                    <label className={lbl}>Parentesco</label>
                                    <select
                                        value={dep.parentesco || ''}
                                        onChange={e => update(i, 'parentesco', e.target.value)}
                                        className={inp}
                                    >
                                        {PARENTESCOS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Botão adicionar */}
            {dependentes.length < 10 && (
                <button
                    type="button"
                    onClick={add}
                    className="flex items-center gap-2 px-4 h-[40px] rounded-lg border-2 border-dashed border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-bold text-[11px] uppercase tracking-widest transition-all w-full justify-center"
                >
                    <Plus size={13} />
                    Adicionar Dependente
                </button>
            )}
        </div>
    );
};

export default EtapaDependentes;
