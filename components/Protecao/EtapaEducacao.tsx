
import React, { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { DependenteSeguro, ParametrosCalculo } from '../../services/protecaoService';
import { calcularIdade, calcularVP, calcularTaxaRealMensal } from '../../utils/calculosFinanceiros';
import { protecaoService } from '../../services/protecaoService';
import TooltipAjuda from './TooltipAjuda';

const inp = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all";
const lbl = "block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5 mb-1.5";
const ANOS_OPCOES = [1, 2, 3, 5, 8, 10, 12, 15, 18, 20];
const fmtMoeda = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

interface Props {
    dependentes: DependenteSeguro[];
    onChange: (deps: DependenteSeguro[]) => void;
    parametros: ParametrosCalculo;
}

const EtapaEducacao: React.FC<Props> = ({ dependentes, onChange, parametros }) => {
    const [locais, setLocais] = useState<DependenteSeguro[]>(dependentes);
    useEffect(() => { setLocais(dependentes); }, [dependentes]);

    const taxaRealMensal = calcularTaxaRealMensal(parametros.taxa_juros_aa, parametros.ipca_projetado_aa);

    const update = (index: number, campo: 'cobertura_anos' | 'auxilio_mensal', valor: any) => {
        const novos = locais.map((d, i) => {
            if (i !== index) return d;
            const anos = campo === 'cobertura_anos' ? valor : (d.cobertura_anos || 10);
            const aux = campo === 'auxilio_mensal' ? valor : (d.auxilio_mensal || 0);
            return { ...d, [campo]: valor, total_calculado: calcularVP(taxaRealMensal, anos * 12, aux) };
        });
        setLocais(novos);
        onChange(novos);
        const curr = locais[index];
        protecaoService.salvarDependentes(curr.cliente_id, novos.map(d => ({
            ordem: d.ordem, nome_dependente: d.nome_dependente, data_nascimento_dep: d.data_nascimento_dep,
            parentesco: d.parentesco, cobertura_anos: d.cobertura_anos, auxilio_mensal: d.auxilio_mensal, total_calculado: d.total_calculado,
        }))).catch(console.error);
    };

    const handleAuxilioInput = (i: number, rawValue: string) => {
        const nums = rawValue.replace(/\D/g, '');
        const valor = nums ? parseInt(nums) / 100 : 0;
        update(i, 'auxilio_mensal', valor);
    };

    const totalGeral = locais.reduce((acc, d) => acc + (d.total_calculado || 0), 0);
    const depComNome = locais.filter(d => d.nome_dependente?.trim());

    return (
        <div className="space-y-4">
            {/* Header informativo */}
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                    <GraduationCap size={14} className="text-emerald-500" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cobertura Educacional</p>
                    <TooltipAjuda
                        className="ml-1"
                        texto={`Taxa real mensal usada: ${(taxaRealMensal * 100).toFixed(4)}% (juros ${parametros.taxa_juros_aa}% a.a. − IPCA ${parametros.ipca_projetado_aa}% a.a.)`}
                    />
                </div>
                <div className="px-5 py-4">
                    <p className="text-sm text-slate-500 font-medium">
                        Para cada dependente, defina o período de cobertura e o auxílio mensal desejado. O valor presente necessário será calculado automaticamente.
                    </p>
                </div>
            </div>

            {depComNome.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 py-16 flex flex-col items-center gap-3 text-slate-300">
                    <GraduationCap size={32} strokeWidth={1.5} />
                    <p className="text-sm font-bold">Nenhum dependente cadastrado</p>
                    <p className="text-xs">Volte à Etapa 2 e adicione os dependentes primeiro.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {depComNome.map((dep, i) => {
                        const idade = calcularIdade(dep.data_nascimento_dep || '');
                        const total = dep.total_calculado || 0;
                        const auxFormatted = dep.auxilio_mensal && dep.auxilio_mensal > 0
                            ? dep.auxilio_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                            : '';

                        return (
                            <div key={i} className="rounded-2xl border border-slate-100 overflow-hidden">
                                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-black">
                                            {i + 1}
                                        </span>
                                        <span className="font-black text-sm text-slate-700">{dep.nome_dependente}</span>
                                        <span className="text-[9px] font-bold text-slate-400">{dep.parentesco}</span>
                                        {idade !== null && (
                                            <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">{idade} anos</span>
                                        )}
                                    </div>
                                    {total > 0 && (
                                        <span className="text-sm font-black text-emerald-600">{fmtMoeda(total)}</span>
                                    )}
                                </div>

                                <div className="px-5 py-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className={lbl}>Período de cobertura</label>
                                            <div className="flex flex-wrap gap-2">
                                                {ANOS_OPCOES.map(a => (
                                                    <button key={a} type="button"
                                                        onClick={() => update(i, 'cobertura_anos', a)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${(dep.cobertura_anos || 10) === a
                                                            ? 'bg-emerald-600 border-emerald-600 text-white'
                                                            : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
                                                            }`}
                                                    >
                                                        {a}a
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className={lbl}>Auxílio mensal</label>
                                            <div className="relative">
                                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">R$</span>
                                                <input
                                                    type="text"
                                                    value={auxFormatted}
                                                    onChange={e => handleAuxilioInput(i, e.target.value)}
                                                    className={`${inp} pl-9`}
                                                    placeholder="0,00"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {total > 0 && (
                                        <div className="bg-emerald-50 rounded-xl px-4 py-3 flex justify-between items-center">
                                            <div>
                                                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Cobertura necessária (VP)</p>
                                                <p className="text-[10px] text-emerald-400 mt-0.5">{dep.cobertura_anos} anos · R$ {(dep.auxilio_mensal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</p>
                                            </div>
                                            <p className="text-xl font-black text-emerald-700">{fmtMoeda(total)}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Total geral */}
            {totalGeral > 0 && (
                <div className="p-6 bg-slate-900 rounded-2xl flex justify-between items-center">
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Necessidade Total — Educação e Dependentes
                        </p>
                        <p className="text-[10px] text-slate-500">Soma do valor presente de todas as coberturas</p>
                    </div>
                    <p className="text-2xl font-black text-white">{fmtMoeda(totalGeral)}</p>
                </div>
            )}
        </div>
    );
};

export default EtapaEducacao;
