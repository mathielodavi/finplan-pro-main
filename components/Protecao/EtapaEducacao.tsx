
import React, { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { DependenteSeguro, ParametrosCalculo } from '../../services/protecaoService';
import { calcularIdade, calcularVP, calcularTaxaRealMensal } from '../../utils/calculosFinanceiros';
import { protecaoService } from '../../services/protecaoService';
import TooltipAjuda from './TooltipAjuda';

const inp = "w-full px-3 h-[36px] bg-surface border border-subtle rounded-lg font-medium text-main text-[13px] outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all";
const lbl = "block text-[12px] font-semibold text-[color:var(--text-muted)] ml-1 mb-1.5";
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
            <div className="rounded-[12px] border border-[color:var(--border)] overflow-hidden shadow-[var(--shadow-card)]">
                <div className="bg-surface-2 px-5 py-3.5 border-b border-[color:var(--border)] flex items-center gap-3">
                    <GraduationCap size={16} className="text-emerald-500" />
                    <p className="text-[12px] font-semibold text-main uppercase tracking-widest">Cobertura Educacional</p>
                    <TooltipAjuda
                        className="ml-1"
                        texto={`Taxa real mensal usada: ${(taxaRealMensal * 100).toFixed(4)}% (juros ${parametros.taxa_juros_aa}% a.a. − IPCA ${parametros.ipca_projetado_aa}% a.a.)`}
                    />
                </div>
                <div className="px-5 py-4 bg-surface">
                    <p className="text-[13px] text-[color:var(--text-muted)] font-medium">
                        Para cada dependente, defina o período de cobertura e o auxílio mensal desejado. O valor presente necessário será calculado automaticamente.
                    </p>
                </div>
            </div>

            {depComNome.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-subtle py-16 flex flex-col items-center gap-3 text-faint">
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
                            <div key={i} className="rounded-[12px] border border-[color:var(--border)] overflow-hidden bg-surface shadow-sm">
                                <div className="bg-surface-2 px-5 py-3.5 border-b border-[color:var(--border)] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">
                                            {i + 1}
                                        </span>
                                        <span className="font-bold text-[14px] text-main">{dep.nome_dependente}</span>
                                        <span className="text-[11px] font-semibold text-[color:var(--text-muted)]">{dep.parentesco}</span>
                                        {idade !== null && (
                                            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{idade} anos</span>
                                        )}
                                    </div>
                                    {total > 0 && (
                                        <span className="text-[14px] font-bold text-emerald-600">{fmtMoeda(total)}</span>
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
                                                        className={`px-3 h-[32px] rounded-md text-[12px] font-bold border transition-all ${(dep.cobertura_anos || 10) === a
                                                            ? 'bg-emerald-600 border-emerald-600 text-white'
                                                            : 'bg-surface border-[color:var(--border)] text-[color:var(--text-muted)] hover:border-emerald-500'
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
                                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-faint">R$</span>
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
                                        <div className="bg-emerald-50 rounded-[12px] px-4 py-3 flex justify-between items-center">
                                            <div>
                                                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest">Cobertura necessária (VP)</p>
                                                <p className="text-[11px] font-medium text-emerald-600/80 mt-0.5">{dep.cobertura_anos} anos · R$ {(dep.auxilio_mensal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</p>
                                            </div>
                                            <p className="text-[18px] font-bold text-emerald-700">{fmtMoeda(total)}</p>
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
                <div className="p-5 bg-surface-3 rounded-[12px] flex justify-between items-center">
                    <div>
                        <p className="text-[11px] font-bold text-faint uppercase tracking-widest mb-1">
                            Necessidade Total — Educação e Dependentes
                        </p>
                        <p className="text-[12px] font-medium text-faint">Soma do valor presente de todas as coberturas</p>
                    </div>
                    <p className="text-[22px] font-bold text-white">{fmtMoeda(totalGeral)}</p>
                </div>
            )}
        </div>
    );
};

export default EtapaEducacao;
