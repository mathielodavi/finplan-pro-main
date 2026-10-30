
import React from 'react';
import { ClienteSeguro } from '../../services/protecaoService';
import { calcularIMC, classificarIMC } from '../../utils/calculosFinanceiros';
import TooltipAjuda from './TooltipAjuda';

// ─── Design tokens ────────────────────────────────────────────────────────────
const inp = "w-full px-3 h-[36px] bg-surface border border-subtle rounded-lg font-medium text-main text-[13px] outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-[color:var(--primary)] transition-all placeholder:text-faint";
const inp2 = "w-full p-3 bg-surface border border-subtle rounded-lg font-medium text-main text-[13px] outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-[color:var(--primary)] transition-all placeholder:text-faint resize-none h-[80px]";
const lbl = "block text-[12px] font-semibold text-[color:var(--text-muted)] ml-1 mb-1.5";

// ─── Sub-componentes utilitários ──────────────────────────────────────────────

/** Cabeçalho de bloco-seção com fundo azul claro */
const BlocoSecao: React.FC<{ titulo: string; descricao?: string; children: React.ReactNode }> = ({ titulo, descricao, children }) => (
    <div className="rounded-[12px] border border-[color:var(--border)] overflow-hidden bg-surface shadow-[var(--shadow-card)]">
        <div className="bg-surface-2 px-5 py-3.5 border-b border-[color:var(--border)]">
            <p className="text-[12px] font-semibold text-main uppercase tracking-widest">{titulo}</p>
            {descricao && <p className="text-[11px] font-medium text-[color:var(--text-muted)] mt-1">{descricao}</p>}
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
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${value ? 'bg-[color:var(--primary)]' : 'bg-surface-3'}`}
        >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-[14px] font-medium text-main flex items-center gap-1">
            {label}
            {tooltip && <TooltipAjuda texto={tooltip} />}
        </span>
        <span className={`ml-auto text-[11px] font-bold uppercase tracking-widest ${value ? 'text-[color:var(--primary)]' : 'text-[color:var(--text-muted)]'}`}>
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
                    <div className="col-span-2 flex items-center gap-3 bg-[color:var(--primary-soft)] rounded-lg px-4 py-2.5">
                        <span className="text-[10px] font-semibold text-[color:var(--primary)] uppercase tracking-widest">IMC</span>
                        <span className="text-[14px] font-bold text-[color:var(--primary)]">{imc}</span>
                        <span className="text-[13px] text-[color:var(--primary)] font-medium">— {classificarIMC(imc)}</span>
                    </div>
                )}
            </div>

            {/* Fumante */}
            <div className="mb-5 border-t border-subtle pt-4">
                <Toggle
                    label="Fumante?"
                    value={!!dados[`fuma_${prefix}` as keyof ClienteSeguro]}
                    onChange={v => onChange(`fuma_${prefix}` as keyof ClienteSeguro, v)}
                />
            </div>

            {/* Histórico de saúde */}
            <div className="grid grid-cols-1 gap-4 border-t border-subtle pt-4">
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

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
    dados: ClienteSeguro;
    onChange: (campo: keyof ClienteSeguro, valor: any) => void;
}

const EtapaDadosPessoais: React.FC<Props> = ({ dados, onChange }) => {
    return (
        <div className="space-y-5">
            <p className="text-[12px] text-[color:var(--text-muted)] font-medium ml-1">
                Identificação e familiares ficam no quadrante Família, na aba Estratégia.
            </p>
            <BlocoSaude prefix="cliente" dados={dados} onChange={onChange} />

            {dados.casado_cliente && (
                <>
                    <BlocoSecao titulo="Regime de bens">
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
                    </BlocoSecao>

                    <div className="flex items-center gap-3 px-1 py-2">
                        <div className="h-px flex-1 bg-[color:var(--border)]" />
                        <span className="text-[11px] font-semibold text-[color:var(--text-muted)] uppercase tracking-widest">{dados.nome_conjuge || 'Cônjuge'}</span>
                        <div className="h-px flex-1 bg-[color:var(--border)]" />
                    </div>
                    <BlocoSaude prefix="conjuge" dados={dados} onChange={onChange} />
                </>
            )}
        </div>
    );
};

export default EtapaDadosPessoais;
