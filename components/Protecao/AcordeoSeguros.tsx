
import React, { useState, useEffect } from 'react';
import { Umbrella, ChevronDown, ChevronUp, Plus, Trash2, Edit2, X, Check, TrendingUp, AlertTriangle } from 'lucide-react';
import { SeguroVida, protecaoService, ClienteSeguro, DependenteSeguro } from '../../services/protecaoService';
import { calcularCoberturaVida, calcularTaxaRealMensal } from '../../utils/calculosFinanceiros';

const inp = "w-full px-3 h-9 bg-surface-2 border border-subtle rounded-[8px] font-bold text-main text-[12px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-surface focus:border-[color:var(--primary)] transition-all shadow-sm";
const lbl = "block text-[10px] font-bold text-faint uppercase tracking-wider mb-1.5";
const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;

type StatusType = 'protegido' | 'parcial' | 'desprotegido';

const StatusBadge: React.FC<{ status: StatusType }> = ({ status }) => {
    const map = {
        protegido: { label: 'Protegido', cls: 'text-[color:var(--primary)] bg-[rgba(16,185,129,0.12)] border-[rgba(16,185,129,0.25)]' },
        parcial: { label: 'Parcialmente Protegido', cls: 'text-[color:var(--warning)] bg-[rgba(251,191,36,0.12)] border-[rgba(251,191,36,0.25)]' },
        desprotegido: { label: 'Desprotegido', cls: 'text-[color:var(--danger)] bg-[rgba(248,113,113,0.12)] border-[rgba(248,113,113,0.25)]' },
    };
    const { label, cls } = map[status];
    return <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${cls}`}>{label}</span>;
};

const SEGURO_VAZIO: Omit<SeguroVida, 'id' | 'cliente_id'> = {
    membro: 'cliente',
    seguradora: '',
    cobertura_funeral: 0,
    cobertura_morte: 0,
    cobertura_invalidez: 0,
    dit: 0,
    inicio_vigencia: '',
    fim_vigencia: '',
    mensalidade: 0,
};

interface Props {
    dados: ClienteSeguro;
    dependentes: DependenteSeguro[];
    parametros: { taxa_juros_aa: number; ipca_projetado_aa: number; perc_custos_inventario: number };
    defaultAberto?: boolean;
}

const AcordeoSeguros: React.FC<Props> = ({ dados, dependentes, parametros, defaultAberto }) => {
    const [aberto, setAberto] = useState(defaultAberto ?? false);
    const [seguros, setSeguros] = useState<SeguroVida[]>([]);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<SeguroVida>>(SEGURO_VAZIO);

    const membros = [
        'cliente',
        ...(dados.casado_cliente ? ['conjuge'] : []),
    ];

    useEffect(() => {
        if (aberto) loadSeguros();
    }, [aberto]);

    const loadSeguros = async () => {
        setLoading(true);
        try {
            const data = await protecaoService.getSegurosVida(dados.cliente_id);
            setSeguros(data);
        } finally {
            setLoading(false);
        }
    };

    // ─── Coberturas ideais (do Wizard) ──────────────────────────────────────────
    const taxaRealMensal = calcularTaxaRealMensal(parametros.taxa_juros_aa, parametros.ipca_projetado_aa);
    const totalDespesas = (dados.despesas_obrigatorias || 0) + (dados.despesas_nao_obrigatorias || 0) +
        (dados.financiamentos || 0) + (dados.dividas_mensais || 0) + (dados.projetos_financeiros || 0);

    const coberturaWizard = calcularCoberturaVida(
        dados.renda_cliente || 0, dados.renda_conjuge || 0, totalDespesas,
        dados.periodo_cobertura_anos || 10, taxaRealMensal
    );

    const idealCliente = dados.cobertura_cliente || coberturaWizard.coberturaCliente;
    const idealConjuge = dados.cobertura_conjuge || coberturaWizard.coberturaConjuge;

    // ─── Saldo real de coberturas por membro ───────────────────────────────────
    const realCliente = seguros.filter(s => s.membro === 'cliente').reduce((a, s) => a + (s.cobertura_morte || 0), 0);
    const realConjuge = seguros.filter(s => s.membro === 'conjuge').reduce((a, s) => a + (s.cobertura_morte || 0), 0);

    const clienteOk = realCliente >= idealCliente && realCliente > 0;
    const conjugeOk = !dados.casado_cliente || (realConjuge >= idealConjuge && realConjuge > 0);
    const temAlgumSeguro = seguros.length > 0;

    const status: StatusType =
        !temAlgumSeguro ? 'desprotegido' :
            clienteOk && conjugeOk ? 'protegido' :
                'parcial';

    const openModal = (seguro?: SeguroVida) => {
        setForm(seguro ? { ...seguro } : { ...SEGURO_VAZIO, cliente_id: dados.cliente_id, membro: membros[0] });
        setModal(true);
    };

    const salvar = async () => {
        if (!form.membro) return;
        const seguro = { ...form, cliente_id: dados.cliente_id } as SeguroVida;
        const saved = await protecaoService.upsertSeguroVida(seguro);
        setSeguros(prev => form.id ? prev.map(s => s.id === form.id ? saved : s) : [...prev, saved]);
        setModal(false);
    };

    const excluir = async (id: string) => {
        await protecaoService.deleteSeguroVida(id);
        setSeguros(prev => prev.filter(s => s.id !== id));
    };

    const CampoMonetario = ({ label, campo }: { label: string; campo: keyof SeguroVida }) => (
        <div>
            <label className={lbl}>{label}</label>
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-faint">R$</span>
                <input type="text"
                    value={(form[campo] as number) > 0 ? (form[campo] as number).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                    onChange={e => { const n = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, [campo]: n ? parseInt(n) / 100 : 0 })); }}
                    className={`${inp} pl-9`} placeholder="0,00" />
            </div>
        </div>
    );

    return (
        <div className={defaultAberto ? '' : 'bg-surface rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden'}>
            <button onClick={() => setAberto(v => !v)}
                className={`w-full flex items-center justify-between px-5 py-4 hover:bg-surface-2/50 transition-colors ${defaultAberto ? 'hidden' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-violet-50 rounded-[8px] flex items-center justify-center shrink-0">
                        <Umbrella size={16} className="text-violet-500" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider leading-none mb-1">Pilar 3</p>
                        <p className="text-[14px] font-bold text-main tracking-tight leading-none">Seguros de Vida</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    {aberto ? <ChevronUp size={16} className="text-faint" /> : <ChevronDown size={16} className="text-faint" />}
                </div>
            </button>

            {aberto && (
                <div className={`space-y-6 ${defaultAberto ? '' : 'border-t border-subtle px-5 py-5'}`}>
                    {/* ── Quadro Ideal vs Real ──────────────────────────────────── */}
                    <div className="rounded-xl border border-subtle overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] bg-surface">
                        <div className="bg-surface px-4 py-3 border-b border-subtle">
                            <p className="text-[10px] font-bold text-faint uppercase tracking-wider">Comparativo de Cobertura — Ideal vs Real</p>
                        </div>
                        <div className="divide-y divide-subtle">
                            {['cliente', ...(dados.casado_cliente ? ['conjuge'] : [])].map(m => {
                                const nome = m === 'cliente' ? dados.nome_cliente || 'Cliente' : dados.nome_conjuge || 'Cônjuge';
                                const ideal = m === 'cliente' ? idealCliente : idealConjuge;
                                const real = m === 'cliente' ? realCliente : realConjuge;
                                const gap = ideal - real;
                                const ok = real >= ideal && real > 0;
                                const pct = ideal > 0 ? Math.min((real / ideal) * 100, 100) : 0;
                                return (
                                    <div key={m} className="px-4 py-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[14px] font-bold text-main tracking-tight">{nome}</p>
                                            {ok ? (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-[color:var(--primary)] uppercase tracking-wider">
                                                    <Check size={11} /> Cobertura suficiente
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[10px] font-bold text-[color:var(--warning)] uppercase tracking-wider">
                                                    <AlertTriangle size={11} /> Gap de cobertura
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div className="bg-surface-2 border border-subtle rounded-xl p-3">
                                                <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Ideal</p>
                                                <p className="text-[14px] font-bold text-main tracking-tight">{fmtMoeda(ideal)}</p>
                                            </div>
                                            <div className={`rounded-xl p-3 ${real > 0 ? (ok ? 'bg-surface-2 border border-subtle' : 'bg-surface-2 border border-subtle') : 'bg-surface-2 border border-subtle'}`}>
                                                <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Real</p>
                                                <p className={`text-[14px] font-bold tracking-tight ${real > 0 ? (ok ? 'text-[color:var(--primary)]' : 'text-[color:var(--warning)]') : 'text-[color:var(--danger)]'}`}>{fmtMoeda(real)}</p>
                                            </div>
                                            <div className={`rounded-xl p-3 ${gap <= 0 ? 'bg-surface-2 border border-subtle' : 'bg-surface-2 border border-subtle'}`}>
                                                <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Gap</p>
                                                <p className={`text-[14px] font-bold tracking-tight ${gap <= 0 ? 'text-[color:var(--primary)]' : 'text-[color:var(--danger)]'}`}>{gap <= 0 ? '—' : fmtMoeda(gap)}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${ok ? 'bg-[color:var(--primary)]' : real > 0 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                                    style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="text-[11px] font-medium text-[color:var(--text-muted)] text-right">{pct.toFixed(0)}% coberto</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Lista de contratos ──────────────────────────────────── */}
                    {loading ? (
                        <div className="py-6 flex justify-center"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[color:var(--primary)]" /></div>
                    ) : seguros.length > 0 ? (
                        <div className="rounded-xl border border-subtle overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] bg-surface">
                            <div className="bg-surface px-4 py-3 border-b border-subtle grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 text-[10px] font-bold text-faint uppercase tracking-wider">
                                <span>Membro</span><span>Seguradora</span><span>Cobertura Morte</span><span>Mensalidade</span><span></span>
                            </div>
                            <div className="divide-y divide-subtle">
                                {seguros.map(s => (
                                    <div key={s.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 hover:bg-surface-2 transition-colors">
                                        <p className="text-[12px] font-bold text-main capitalize tracking-tight">{s.membro}</p>
                                        <p className="text-[12px] font-bold text-main tracking-tight">{s.seguradora || '—'}</p>
                                        <p className="text-[13px] font-bold text-violet-600 tracking-tight">{fmtMoeda(s.cobertura_morte || 0)}</p>
                                        <p className="text-[13px] font-bold text-[color:var(--primary)] tracking-tight">{fmtMoeda(s.mensalidade || 0)}</p>
                                        <div className="flex gap-1">
                                            <button onClick={() => openModal(s)} className="p-1.5 text-faint hover:text-[color:var(--primary)] hover:bg-surface-2 rounded-lg transition-colors"><Edit2 size={13} /></button>
                                            <button onClick={() => excluir(s.id!)} className="p-1.5 text-faint hover:text-[color:var(--danger)] hover:bg-surface-2 rounded-lg transition-colors"><Trash2 size={13} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-faint text-center py-4">Nenhum seguro de vida cadastrado.</p>
                    )}

                    <button onClick={() => openModal()}
                        className="flex items-center gap-1.5 px-3 h-9 rounded-[8px] border border-dashed border-violet-200 text-violet-600 hover:bg-violet-50 font-bold text-[10px] uppercase tracking-wider transition-all w-max shadow-sm">
                        <Plus size={13} /> Adicionar Seguro de Vida
                    </button>
                </div>
            )}

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-surface-3/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-subtle pb-3">
                            <h3 className="text-[16px] font-bold text-main tracking-tight">{form.id ? 'Editar' : 'Novo'} Seguro de Vida</h3>
                            <button onClick={() => setModal(false)}><X size={18} className="text-faint hover:text-muted transition-colors" /></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className={lbl}>Membro</label>
                                <select value={form.membro} onChange={e => setForm(f => ({ ...f, membro: e.target.value }))} className={inp}>
                                    {membros.map(m => (
                                        <option key={m} value={m}>{m === 'cliente' ? dados.nome_cliente || 'Cliente' : dados.nome_conjuge || 'Cônjuge'}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className={lbl}>Seguradora</label>
                                <input value={form.seguradora || ''} onChange={e => setForm(f => ({ ...f, seguradora: e.target.value }))} className={inp} placeholder="Ex: Porto Seguro, Itaú Vida..." />
                            </div>
                            <CampoMonetario label="Cobertura por Funeral" campo="cobertura_funeral" />
                            <CampoMonetario label="Cobertura por Morte" campo="cobertura_morte" />
                            <CampoMonetario label="Cobertura por Invalidez" campo="cobertura_invalidez" />
                            <CampoMonetario label="DIT (diária)" campo="dit" />
                            <div>
                                <label className={lbl}>Início da Vigência</label>
                                <input type="date" value={form.inicio_vigencia || ''} onChange={e => setForm(f => ({ ...f, inicio_vigencia: e.target.value }))} className={inp} />
                            </div>
                            <div>
                                <label className={lbl}>Fim da Vigência</label>
                                <input type="date" value={form.fim_vigencia || ''} onChange={e => setForm(f => ({ ...f, fim_vigencia: e.target.value }))} className={inp} />
                            </div>
                            <CampoMonetario label="Mensalidade (R$)" campo="mensalidade" />
                        </div>

                        <div className="flex gap-2 pt-4">
                            <button onClick={() => setModal(false)} className="flex-1 h-9 rounded-[8px] border border-subtle text-muted font-bold text-[10px] uppercase tracking-wider hover:bg-surface-2 shadow-sm">Cancelar</button>
                            <button onClick={salvar} className="flex-1 h-9 rounded-[8px] bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:opacity-90 flex items-center justify-center gap-1.5">
                                <Check size={13} /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcordeoSeguros;
