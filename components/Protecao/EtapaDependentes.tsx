
import React from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { DependenteSeguro } from '../../services/protecaoService';
import { calcularIdade } from '../../utils/calculosFinanceiros';
import { protecaoService } from '../../services/protecaoService';

const inp = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all placeholder:text-slate-300";
const lbl = "block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5 mb-1.5";

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
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                    <Users size={14} className="text-emerald-500" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dependentes</p>
                    <span className="ml-auto text-[10px] font-bold text-slate-400">{dependentes.length} / 10</span>
                </div>
                <div className="px-5 py-4">
                    <p className="text-sm text-slate-500 font-medium">
                        Informe os dependentes do cliente. Eles serão utilizados nos cálculos de cobertura educacional nas próximas etapas.
                    </p>
                </div>
            </div>

            {/* Lista de dependentes */}
            <div className="space-y-3">
                {dependentes.map((dep, i) => {
                    const idade = calcularIdade(dep.data_nascimento_dep || '');
                    return (
                        <div key={i} className="rounded-2xl border border-slate-100 overflow-hidden">
                            {/* Header do card */}
                            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black">
                                        {i + 1}
                                    </span>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        {dep.nome_dependente?.trim() || `Dependente ${i + 1}`}
                                    </span>
                                    {idade !== null && (
                                        <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">
                                            {idade} anos
                                        </span>
                                    )}
                                </div>
                                {dependentes.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => remove(i)}
                                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
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
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-dashed border-emerald-200 text-emerald-500 hover:bg-emerald-50 font-black text-xs uppercase tracking-widest transition-all w-full justify-center"
                >
                    <Plus size={13} />
                    Adicionar Dependente
                </button>
            )}
        </div>
    );
};

export default EtapaDependentes;
