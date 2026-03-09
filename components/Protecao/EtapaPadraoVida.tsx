
import React, { useMemo } from 'react';
import { TrendingDown, DollarSign, BarChart2 } from 'lucide-react';
import { ClienteSeguro, ParametrosCalculo } from '../../services/protecaoService';
import { calcularCoberturaVida } from '../../utils/calculosFinanceiros';
import TooltipAjuda from './TooltipAjuda';

const PERIODOS = [3, 5, 7, 10, 15, 20];
const inp = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all";
const lbl = "block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5 mb-1.5";
const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;

const BlocoSecao: React.FC<{ icone?: React.ReactNode; titulo: string; children: React.ReactNode }> = ({ icone, titulo, children }) => (
    <div className="rounded-2xl border border-slate-100 overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            {icone && <span className="text-emerald-500">{icone}</span>}
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{titulo}</p>
        </div>
        <div className="px-5 py-5">{children}</div>
    </div>
);

const CampoRenda: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => {
    const formatted = value > 0 ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nums = e.target.value.replace(/\D/g, '');
        onChange(nums ? parseInt(nums) / 100 : 0);
    };
    return (
        <div>
            <label className={lbl}>{label}</label>
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">R$</span>
                <input type="text" value={formatted} onChange={handleChange} className={`${inp} pl-9`} placeholder="0,00" />
            </div>
        </div>
    );
};

interface Props {
    dados: ClienteSeguro;
    onChange: (campo: keyof ClienteSeguro, valor: any) => void;
    onChangeMultiple: (novos: Partial<ClienteSeguro>) => void;
    parametros: ParametrosCalculo;
}

const EtapaPadraoVida: React.FC<Props> = ({ dados, onChange, onChangeMultiple, parametros }) => {
    const rendaCliente = dados.renda_cliente || 0;
    const rendaConjuge = dados.renda_conjuge || 0;
    const rendaTotal = rendaCliente + rendaConjuge;

    const despObr = dados.despesas_obrigatorias || 0;
    const despNObr = dados.despesas_nao_obrigatorias || 0;
    const financ = dados.financiamentos || 0;
    const dividas = dados.dividas_mensais || 0;
    const projetos = dados.projetos_financeiros || 0;
    const totalDespesas = despObr + despNObr + financ + dividas + projetos;

    const taxaRealAnual = dados.taxa_real_anual ?? 4;
    const periodo = dados.periodo_cobertura_anos || 10;

    // Despesas selecionadas para o cálculo de cobertura do seguro
    const inclObr = dados.cobertura_incluir_obrigatorias ?? true;
    const inclNObr = dados.cobertura_incluir_nao_obrigatorias ?? false;
    const inclFinanc = dados.cobertura_incluir_financiamentos ?? true;
    const inclDividas = dados.cobertura_incluir_dividas ?? false;
    const inclProjetos = dados.cobertura_incluir_projetos ?? false;

    const totalDespesasCobertura =
        (inclObr ? despObr : 0) +
        (inclNObr ? despNObr : 0) +
        (inclFinanc ? financ : 0) +
        (inclDividas ? dividas : 0) +
        (inclProjetos ? projetos : 0);

    const resultado = useMemo(() => calcularCoberturaVida(
        rendaCliente, rendaConjuge, totalDespesasCobertura, periodo, taxaRealAnual
    ), [rendaCliente, rendaConjuge, totalDespesasCobertura, periodo, taxaRealAnual]);

    const persist = (campo: keyof ClienteSeguro, valor: any) => {
        onChangeMultiple({
            [campo]: valor,
            cobertura_cliente: resultado.coberturaCliente,
            cobertura_conjuge: resultado.coberturaConjuge,
            cobertura_familiar_vida: resultado.coberturaFamiliar,
        });
    };

    return (
        <div className="space-y-4">
            {/* Renda */}
            <BlocoSecao icone={<DollarSign size={14} />} titulo="Renda Familiar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <CampoRenda label="Renda bruta mensal — Cliente" value={rendaCliente} onChange={v => persist('renda_cliente', v)} />
                    <div>
                        <label className={lbl}>Declaração de IR — Cliente</label>
                        <select value={dados.declaracao_ir_cliente || ''} onChange={e => persist('declaracao_ir_cliente', e.target.value)} className={inp}>
                            <option value="">Selecione...</option>
                            <option value="Completa">Completa</option>
                            <option value="Simplificada">Simplificada</option>
                        </select>
                    </div>
                    <div>
                        <label className={lbl}>Regime — Cliente</label>
                        <select value={dados.regime_contratacao_cliente || ''} onChange={e => persist('regime_contratacao_cliente', e.target.value)} className={inp}>
                            <option value="">Selecione...</option>
                            <option value="Servidor Público">Servidor Público</option>
                            <option value="CLT">CLT</option>
                            <option value="Autônomo/Liberal">Autônomo / Liberal</option>
                            <option value="Empresário">Empresário</option>
                        </select>
                    </div>

                    {dados.casado_cliente && (
                        <>
                            <CampoRenda label="Renda bruta mensal — Cônjuge" value={rendaConjuge} onChange={v => persist('renda_conjuge', v)} />
                            <div>
                                <label className={lbl}>Declaração de IR — Cônjuge</label>
                                <select value={dados.declaracao_ir_conjuge || ''} onChange={e => persist('declaracao_ir_conjuge', e.target.value)} className={inp}>
                                    <option value="">Selecione...</option>
                                    <option value="Completa">Completa</option>
                                    <option value="Simplificada">Simplificada</option>
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Regime — Cônjuge</label>
                                <select value={dados.regime_contratacao_conjuge || ''} onChange={e => persist('regime_contratacao_conjuge', e.target.value)} className={inp}>
                                    <option value="">Selecione...</option>
                                    <option value="Servidor Público">Servidor Público</option>
                                    <option value="CLT">CLT</option>
                                    <option value="Autônomo/Liberal">Autônomo / Liberal</option>
                                    <option value="Empresário">Empresário</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>

                {rendaTotal > 0 && (
                    <div className="mt-4 flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-3">
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Renda Familiar Total</span>
                        <span className="text-lg font-black text-emerald-700">{fmtMoeda(rendaTotal)}</span>
                    </div>
                )}
            </BlocoSecao>

            {/* Despesas */}
            <BlocoSecao icone={<TrendingDown size={14} />} titulo="Despesas Mensais">
                {/* Cabeçalho fixo */}
                <div className="grid grid-cols-[1fr_120px_64px] gap-x-3 mb-2 pb-2 border-b border-slate-100 items-center">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Categoria</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</span>
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest text-center">Seg.</span>
                </div>
                <div className="space-y-1.5">
                    {[
                        { label: 'Despesas obrigatórias', campo: 'despesas_obrigatorias' as const, valor: despObr, inclCampo: 'cobertura_incluir_obrigatorias' as const, incl: inclObr },
                        { label: 'Despesas não obrigatórias', campo: 'despesas_nao_obrigatorias' as const, valor: despNObr, inclCampo: 'cobertura_incluir_nao_obrigatorias' as const, incl: inclNObr },
                        { label: 'Financiamentos', campo: 'financiamentos' as const, valor: financ, inclCampo: 'cobertura_incluir_financiamentos' as const, incl: inclFinanc },
                        { label: 'Dívidas mensais', campo: 'dividas_mensais' as const, valor: dividas, inclCampo: 'cobertura_incluir_dividas' as const, incl: inclDividas },
                        { label: 'Projetos financeiros', campo: 'projetos_financeiros' as const, valor: projetos, inclCampo: 'cobertura_incluir_projetos' as const, incl: inclProjetos },
                    ].map(item => (
                        <div key={item.campo} className="grid grid-cols-[1fr_120px_64px] gap-x-3 items-end pb-1">
                            <CampoRenda label={item.label} value={item.valor} onChange={v => persist(item.campo, v)} />
                            <div className="shrink-0 pb-2.5 text-right">
                                <span className={`text-xs font-black tabular-nums ${item.valor > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                                    {fmtMoeda(item.valor)}
                                </span>
                            </div>
                            <div className="shrink-0 pb-2.5 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => persist(item.inclCampo, !item.incl)}
                                    title={item.incl ? 'Incluído na cobertura de seguro' : 'Excluído da cobertura de seguro'}
                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${item.incl ? 'bg-emerald-600' : 'bg-slate-200'}`}
                                >
                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${item.incl ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between bg-amber-50 rounded-xl px-4 py-3">
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Total Registrado</span>
                        <span className="text-sm font-black text-amber-700">{fmtMoeda(totalDespesas)}</span>
                    </div>
                    <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-4 py-3">
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Base da Cobertura</span>
                        <span className="text-sm font-black text-emerald-700">{fmtMoeda(totalDespesasCobertura)}</span>
                    </div>
                </div>
            </BlocoSecao>

            {/* Período de cobertura */}
            <BlocoSecao icone={<BarChart2 size={14} />} titulo="Período de Cobertura">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div className="space-y-1.5">
                        <label className={lbl}>
                            Duração da cobertura (anos)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min={1}
                                max={50}
                                value={periodo || ''}
                                onChange={e => {
                                    const v = parseInt(e.target.value);
                                    if (!isNaN(v) && v >= 1) persist('periodo_cobertura_anos', v);
                                }}
                                placeholder="Ex: 20"
                                className={`${inp} pr-16`}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300 uppercase">anos</span>
                        </div>
                        <p className="text-[9px] text-slate-400 ml-0.5 mt-1">Informe por quantos anos a família deve ser coberta financeiramente.</p>
                    </div>
                    <div className="space-y-1.5">
                        <label className={lbl}>
                            Taxa Real Anual (%)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min={0}
                                max={30}
                                step={0.1}
                                value={taxaRealAnual}
                                onChange={e => {
                                    const v = parseFloat(e.target.value);
                                    if (!isNaN(v) && v >= 0) persist('taxa_real_anual', v);
                                }}
                                placeholder="4"
                                className={`${inp} pr-8`}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300">%</span>
                        </div>
                        <p className="text-[9px] text-slate-400 ml-0.5 mt-1">Taxa real de rentabilidade anual para desconto do capital.</p>
                    </div>
                </div>
            </BlocoSecao>


            {/* Resultado */}
            {rendaTotal > 0 && totalDespesas > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-5 rounded-2xl bg-emerald-600 text-white">
                        <p className="text-[9px] font-black text-emerald-200 uppercase tracking-widest mb-2">Cobertura — Cliente</p>
                        <p className="text-2xl font-black tracking-tighter">{fmtMoeda(resultado.coberturaCliente)}</p>
                        <p className="text-[9px] text-emerald-300 mt-2">Em caso de falecimento</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-emerald-600 text-white">
                        <p className="text-[9px] font-black text-emerald-200 uppercase tracking-widest mb-2">Cobertura — Cônjuge</p>
                        <p className="text-2xl font-black tracking-tighter">{fmtMoeda(resultado.coberturaConjuge)}</p>
                        <p className="text-[9px] text-emerald-300 mt-2">Em caso de falecimento</p>
                    </div>
                    <div className="p-5 rounded-2xl bg-violet-600 text-white">
                        <p className="text-[9px] font-black text-violet-200 uppercase tracking-widest mb-2">Cobertura Familiar Total</p>
                        <p className="text-2xl font-black tracking-tighter">{fmtMoeda(resultado.coberturaFamiliar)}</p>
                        <p className="text-[9px] text-violet-300 mt-2">Soma das coberturas</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EtapaPadraoVida;
