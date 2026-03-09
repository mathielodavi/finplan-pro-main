
import React, { useState, useEffect } from 'react';
import { Umbrella, ChevronDown, ChevronUp, Plus, Trash2, Edit2, X, Check, TrendingUp, AlertTriangle } from 'lucide-react';
import { SeguroVida, protecaoService, ClienteSeguro, DependenteSeguro } from '../../services/protecaoService';
import { calcularCoberturaVida, calcularTaxaRealMensal } from '../../utils/calculosFinanceiros';

const inp = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all";
const lbl = "block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5";
const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;

type StatusType = 'protegido' | 'parcial' | 'desprotegido';

const StatusBadge: React.FC<{ status: StatusType }> = ({ status }) => {
    const map = {
        protegido: { label: 'Protegido', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        parcial: { label: 'Parcialmente Protegido', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
        desprotegido: { label: 'Desprotegido', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
    };
    const { label, cls } = map[status];
    return <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${cls}`}>{label}</span>;
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
}

const AcordeoSeguros: React.FC<Props> = ({ dados, dependentes, parametros }) => {
    const [aberto, setAberto] = useState(false);
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
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">R$</span>
                <input type="text"
                    value={(form[campo] as number) > 0 ? (form[campo] as number).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                    onChange={e => { const n = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, [campo]: n ? parseInt(n) / 100 : 0 })); }}
                    className={`${inp} pl-9`} placeholder="0,00" />
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button onClick={() => setAberto(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
                        <Umbrella size={18} className="text-violet-500" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilar 3</p>
                        <p className="text-sm font-black text-slate-800">Seguros de Vida</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    {aberto ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </button>

            {aberto && (
                <div className="border-t border-slate-50 px-6 py-6 space-y-5">
                    {/* ── Quadro Ideal vs Real ──────────────────────────────────── */}
                    <div className="rounded-2xl border border-slate-100 overflow-hidden">
                        <div className="bg-slate-50 px-5 py-3 border-b border-slate-100">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Comparativo de Cobertura — Ideal vs Real</p>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {['cliente', ...(dados.casado_cliente ? ['conjuge'] : [])].map(m => {
                                const nome = m === 'cliente' ? dados.nome_cliente || 'Cliente' : dados.nome_conjuge || 'Cônjuge';
                                const ideal = m === 'cliente' ? idealCliente : idealConjuge;
                                const real = m === 'cliente' ? realCliente : realConjuge;
                                const gap = ideal - real;
                                const ok = real >= ideal && real > 0;
                                const pct = ideal > 0 ? Math.min((real / ideal) * 100, 100) : 0;
                                return (
                                    <div key={m} className="px-5 py-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-black text-slate-700">{nome}</p>
                                            {ok ? (
                                                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest">
                                                    <Check size={11} /> Cobertura suficiente
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 uppercase tracking-widest">
                                                    <AlertTriangle size={11} /> Gap de cobertura
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div className="bg-slate-50 rounded-xl p-3">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ideal</p>
                                                <p className="text-xs font-black text-slate-800">{fmtMoeda(ideal)}</p>
                                            </div>
                                            <div className={`rounded-xl p-3 ${real > 0 ? (ok ? 'bg-emerald-50' : 'bg-amber-50') : 'bg-rose-50'}`}>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Real</p>
                                                <p className={`text-xs font-black ${real > 0 ? (ok ? 'text-emerald-700' : 'text-amber-700') : 'text-rose-500'}`}>{fmtMoeda(real)}</p>
                                            </div>
                                            <div className={`rounded-xl p-3 ${gap <= 0 ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Gap</p>
                                                <p className={`text-xs font-black ${gap <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{gap <= 0 ? '—' : fmtMoeda(gap)}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${ok ? 'bg-emerald-500' : real > 0 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                                    style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="text-[9px] text-slate-400 text-right">{pct.toFixed(0)}% coberto</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Lista de contratos ──────────────────────────────────── */}
                    {loading ? (
                        <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" /></div>
                    ) : seguros.length > 0 ? (
                        <div className="rounded-2xl border border-slate-100 overflow-hidden">
                            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <span>Membro</span><span>Seguradora</span><span>Cobertura Morte</span><span>Mensalidade</span><span></span>
                            </div>
                            {seguros.map(s => (
                                <div key={s.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center px-5 py-3 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <p className="text-xs font-bold text-slate-700 capitalize">{s.membro}</p>
                                    <p className="text-xs font-bold text-slate-800">{s.seguradora || '—'}</p>
                                    <p className="text-xs font-black text-violet-600">{fmtMoeda(s.cobertura_morte || 0)}</p>
                                    <p className="text-xs font-black text-emerald-600">{fmtMoeda(s.mensalidade || 0)}</p>
                                    <div className="flex gap-1">
                                        <button onClick={() => openModal(s)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit2 size={13} /></button>
                                        <button onClick={() => excluir(s.id!)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 text-center py-4">Nenhum seguro de vida cadastrado.</p>
                    )}

                    <button onClick={() => openModal()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-violet-200 text-violet-600 hover:bg-violet-50 font-black text-xs uppercase tracking-widest transition-all">
                        <Plus size={13} /> Adicionar Seguro de Vida
                    </button>
                </div>
            )}

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900">{form.id ? 'Editar' : 'Novo'} Seguro de Vida</h3>
                            <button onClick={() => setModal(false)}><X size={20} className="text-slate-400" /></button>
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

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-black text-xs uppercase hover:bg-slate-50">Cancelar</button>
                            <button onClick={salvar} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase shadow-md hover:bg-emerald-700 flex items-center justify-center gap-2">
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
