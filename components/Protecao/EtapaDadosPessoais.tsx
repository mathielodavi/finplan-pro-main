
import React from 'react';
import { ClienteSeguro } from '../../services/protecaoService';
import { mascaraCPF, mascaraTelefone, validarCPF, calcularIdade, calcularIMC, classificarIMC } from '../../utils/calculosFinanceiros';
import TooltipAjuda from './TooltipAjuda';

// ─── Design tokens ────────────────────────────────────────────────────────────
const ESTADOS_BR = [
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
    'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const inp = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all placeholder:text-slate-300";
const inp2 = `${inp} resize-none h-[72px]`;
const lbl = "block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5 mb-1.5";
const err = "text-[9px] text-rose-500 font-bold ml-1 mt-1";

// ─── Sub-componentes utilitários ──────────────────────────────────────────────

/** Cabeçalho de bloco-seção com fundo azul claro */
const BlocoSecao: React.FC<{ titulo: string; descricao?: string; children: React.ReactNode }> = ({ titulo, descricao, children }) => (
    <div className="rounded-2xl border border-slate-100 overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{titulo}</p>
            {descricao && <p className="text-[11px] text-slate-400 mt-0.5">{descricao}</p>}
        </div>
        <div className="px-5 py-5">{children}</div>
    </div>
);

/** Toggle padrão do sistema */
const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void; tooltip?: string }> = ({ label, value, onChange, tooltip }) => (
    <div className="flex items-center gap-3 py-1">
        <button
            type="button"
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${value ? 'bg-emerald-600' : 'bg-slate-200'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-sm font-semibold text-slate-600 flex items-center gap-1">
            {label}
            {tooltip && <TooltipAjuda texto={tooltip} />}
        </span>
        <span className={`ml-auto text-[10px] font-black uppercase tracking-widest ${value ? 'text-emerald-600' : 'text-slate-300'}`}>
            {value ? 'Sim' : 'Não'}
        </span>
    </div>
);

// ─── Bloco de saúde reutilizável ──────────────────────────────────────────────
const BlocoSaude: React.FC<{
    prefix: 'cliente' | 'conjuge';
    dados: ClienteSeguro;
    onChange: (campo: keyof ClienteSeguro, valor: any) => void;
}> = ({ prefix, dados, onChange }) => {
    const peso = dados[`peso_${prefix}` as keyof ClienteSeguro] as number || 0;
    const altura = dados[`altura_${prefix}` as keyof ClienteSeguro] as number || 0;
    const imc = peso > 0 && altura > 0 ? calcularIMC(peso, altura) : null;

    return (
        <BlocoSecao titulo="Saúde &amp; Estilo de Vida">
            {/* Dados biométricos */}
            <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                    <label className={lbl}>Peso (kg)</label>
                    <input type="number" min={30} max={300} step={0.1}
                        value={peso || ''} placeholder="Ex: 75,5"
                        onChange={e => onChange(`peso_${prefix}` as keyof ClienteSeguro, parseFloat(e.target.value))}
                        className={inp} />
                </div>
                <div>
                    <label className={lbl}>Altura (cm)</label>
                    <input type="number" min={100} max={250}
                        value={altura || ''} placeholder="Ex: 175"
                        onChange={e => onChange(`altura_${prefix}` as keyof ClienteSeguro, parseInt(e.target.value))}
                        className={inp} />
                </div>
                {imc !== null && (
                    <div className="col-span-2 flex items-center gap-3 bg-emerald-50 rounded-xl px-4 py-2.5">
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">IMC</span>
                        <span className="text-sm font-black text-emerald-700">{imc}</span>
                        <span className="text-xs text-emerald-600 font-medium">— {classificarIMC(imc)}</span>
                    </div>
                )}
            </div>

            {/* Fumante */}
            <div className="mb-5 border-t border-slate-100 pt-4">
                <Toggle
                    label="Fumante?"
                    value={!!dados[`fuma_${prefix}` as keyof ClienteSeguro]}
                    onChange={v => onChange(`fuma_${prefix}` as keyof ClienteSeguro, v)}
                />
            </div>

            {/* Histórico de saúde */}
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4">
                <div>
                    <label className={lbl}>Esportes / atividades de risco</label>
                    <textarea value={dados[`esporte_hobby_${prefix}` as keyof ClienteSeguro] as string || ''}
                        onChange={e => onChange(`esporte_hobby_${prefix}` as keyof ClienteSeguro, e.target.value)}
                        className={inp2} placeholder="Ex: Motociclismo, escalada, futebol amador..." />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={lbl}>Medicamento contínuo</label>
                        <textarea value={dados[`medicamento_continuo_${prefix}` as keyof ClienteSeguro] as string || ''}
                            onChange={e => onChange(`medicamento_continuo_${prefix}` as keyof ClienteSeguro, e.target.value)}
                            className={inp2} placeholder="Informe o medicamento e dosagem" />
                    </div>
                    <div>
                        <label className={lbl}>Doença crônica</label>
                        <textarea value={dados[`doenca_cronica_${prefix}` as keyof ClienteSeguro] as string || ''}
                            onChange={e => onChange(`doenca_cronica_${prefix}` as keyof ClienteSeguro, e.target.value)}
                            className={inp2} placeholder="Ex: Diabetes tipo 2, hipertensão..." />
                    </div>
                </div>
                <div>
                    <label className={lbl}>Cirurgia complexa (histórico)</label>
                    <textarea value={dados[`cirurgia_complexa_${prefix}` as keyof ClienteSeguro] as string || ''}
                        onChange={e => onChange(`cirurgia_complexa_${prefix}` as keyof ClienteSeguro, e.target.value)}
                        className={inp2} placeholder="Ex: Bypass cardíaco em 2018" />
                </div>
            </div>
        </BlocoSecao>
    );
};

// ─── Bloco de identificação ───────────────────────────────────────────────────
const BlocoIdentificacao: React.FC<{
    prefix: 'cliente' | 'conjuge';
    dados: ClienteSeguro;
    onChange: (campo: keyof ClienteSeguro, valor: any) => void;
}> = ({ prefix, dados, onChange }) => {
    const cpfRaw = dados[`cpf_${prefix}` as keyof ClienteSeguro] as string || '';
    const cpfValido = cpfRaw.replace(/\D/g, '').length === 11 ? validarCPF(cpfRaw) : true;
    const idade = calcularIdade(dados[`data_nascimento_${prefix}` as keyof ClienteSeguro] as string || '');

    return (
        <BlocoSecao titulo="Dados de Identificação">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-3">
                    <label className={lbl}>Nome completo <span className="text-rose-400">*</span></label>
                    <input type="text"
                        value={dados[`nome_${prefix}` as keyof ClienteSeguro] as string || ''}
                        onChange={e => onChange(`nome_${prefix}` as keyof ClienteSeguro, e.target.value)}
                        className={inp} placeholder={prefix === 'cliente' ? 'Nome do cliente' : 'Nome do cônjuge'} />
                </div>
                <div>
                    <label className={lbl}>E-mail <span className="text-rose-400">*</span></label>
                    <input type="email"
                        value={dados[`email_${prefix}` as keyof ClienteSeguro] as string || ''}
                        onChange={e => onChange(`email_${prefix}` as keyof ClienteSeguro, e.target.value)}
                        className={inp} placeholder="email@exemplo.com" />
                </div>
                <div>
                    <label className={lbl}>Telefone</label>
                    <input type="text"
                        value={dados[`telefone_${prefix}` as keyof ClienteSeguro] as string || ''}
                        onChange={e => onChange(`telefone_${prefix}` as keyof ClienteSeguro, mascaraTelefone(e.target.value))}
                        className={inp} placeholder="(11) 99999-9999" maxLength={16} />
                </div>
                <div>
                    <label className={lbl}>Estado</label>
                    <select value={dados[`estado_${prefix}` as keyof ClienteSeguro] as string || ''}
                        onChange={e => onChange(`estado_${prefix}` as keyof ClienteSeguro, e.target.value)}
                        className={inp}>
                        <option value="">Selecione...</option>
                        {ESTADOS_BR.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </div>
                <div>
                    <label className={lbl}>Data de nascimento <span className="text-rose-400">*</span></label>
                    <input type="date"
                        value={dados[`data_nascimento_${prefix}` as keyof ClienteSeguro] as string || ''}
                        onChange={e => onChange(`data_nascimento_${prefix}` as keyof ClienteSeguro, e.target.value)}
                        className={inp} max={new Date().toISOString().split('T')[0]} />
                    {idade !== null && (
                        <p className="text-[9px] font-black text-emerald-500 ml-1 mt-1">{idade} anos</p>
                    )}
                </div>
                <div>
                    <label className={`${lbl} flex items-center gap-1`}>
                        CPF <TooltipAjuda texto="Validado com dígitos verificadores." />
                    </label>
                    <input type="text"
                        value={cpfRaw}
                        onChange={e => onChange(`cpf_${prefix}` as keyof ClienteSeguro, mascaraCPF(e.target.value))}
                        className={`${inp} ${!cpfValido ? 'border-rose-400' : ''}`}
                        placeholder="000.000.000-00" maxLength={14} />
                    {!cpfValido && <p className={err}>CPF inválido</p>}
                </div>
                <div>
                    <label className={lbl}>Profissão</label>
                    <input type="text"
                        value={dados[`profissao_${prefix}` as keyof ClienteSeguro] as string || ''}
                        onChange={e => onChange(`profissao_${prefix}` as keyof ClienteSeguro, e.target.value)}
                        className={inp} placeholder="Ex: Médico, Engenheiro..." />
                </div>
            </div>
        </BlocoSecao>
    );
};

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
    dados: ClienteSeguro;
    onChange: (campo: keyof ClienteSeguro, valor: any) => void;
    onChangeMultiple: (novos: Partial<ClienteSeguro>) => void;
}

const EtapaDadosPessoais: React.FC<Props> = ({ dados, onChange, onChangeMultiple }) => {
    return (
        <div className="space-y-5">
            {/* Dados do cliente */}
            <BlocoIdentificacao prefix="cliente" dados={dados} onChange={onChange} />
            <BlocoSaude prefix="cliente" dados={dados} onChange={onChange} />

            {/* Estado Civil */}
            <BlocoSecao titulo="Estado Civil">
                <div className="space-y-4">
                    <Toggle
                        label="Casado(a) / União Estável"
                        value={!!dados.casado_cliente}
                        onChange={v => onChange('casado_cliente', v)}
                    />
                    {dados.casado_cliente && (
                        <div className="pt-3 border-t border-slate-100">
                            <label className={lbl}>
                                Regime de bens
                                <TooltipAjuda className="ml-1" texto="Define como o patrimônio é dividido em caso de divórcio ou falecimento. 'Comunhão Parcial' é o padrão no Brasil." />
                            </label>
                            <select value={dados.regime_bens || ''} onChange={e => onChange('regime_bens', e.target.value)} className={inp}>
                                <option value="">Selecione...</option>
                                <option value="Comunhão Parcial">Comunhão Parcial</option>
                                <option value="Comunhão Total">Comunhão Total</option>
                                <option value="União Estável">União Estável</option>
                                <option value="Separação Total">Separação Total</option>
                            </select>
                        </div>
                    )}
                </div>
            </BlocoSecao>

            {/* Dados do cônjuge — somente se casado */}
            {dados.casado_cliente && (
                <>
                    <div className="flex items-center gap-3 px-1">
                        <div className="h-px flex-1 bg-slate-100" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dados do Cônjuge</span>
                        <div className="h-px flex-1 bg-slate-100" />
                    </div>
                    <BlocoIdentificacao prefix="conjuge" dados={dados} onChange={onChange} />
                    <BlocoSaude prefix="conjuge" dados={dados} onChange={onChange} />
                </>
            )}
        </div>
    );
};

export default EtapaDadosPessoais;
