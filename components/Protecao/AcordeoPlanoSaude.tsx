
import React, { useState, useEffect } from 'react';
import { Heart, ChevronDown, ChevronUp, Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { PlanoSaude, protecaoService, ClienteSeguro, DependenteSeguro } from '../../services/protecaoService';

const inp = "w-full px-3 h-9 bg-surface-2 border border-subtle rounded-[8px] font-bold text-main text-[12px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-surface focus:border-[color:var(--primary)] transition-all shadow-sm";
const lbl = "block text-[10px] font-bold text-faint uppercase tracking-wider mb-1.5";
const fmtMoeda = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

type StatusType = 'protegido' | 'parcial' | 'desprotegido';

interface StatusBadgeProps { status: StatusType; }
const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const map = {
        protegido: { label: 'Protegido', cls: 'text-[color:var(--primary)] bg-[rgba(16,185,129,0.12)] border-[rgba(16,185,129,0.25)]' },
        parcial: { label: 'Parcialmente Protegido', cls: 'text-[color:var(--warning)] bg-[rgba(251,191,36,0.12)] border-[rgba(251,191,36,0.25)]' },
        desprotegido: { label: 'Desprotegido', cls: 'text-[color:var(--danger)] bg-[rgba(248,113,113,0.12)] border-[rgba(248,113,113,0.25)]' },
    };
    const { label, cls } = map[status];
    return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border ${cls}`}>
            {label}
        </span>
    );
};

const PLANO_VAZIO: Omit<PlanoSaude, 'id' | 'cliente_id'> = {
    membro: 'cliente',
    operadora: '',
    cobertura: 'Nacional',
    coparticipacao: false,
    uti: false,
    quarto_privativo: false,
    obstetricia: false,
    mensalidade: 0,
};

interface Props {
    dados: ClienteSeguro;
    dependentes: DependenteSeguro[];
    defaultAberto?: boolean;
}

const AcordeoPlanoSaude: React.FC<Props> = ({ dados, dependentes, defaultAberto }) => {
    const [aberto, setAberto] = useState(defaultAberto ?? false);
    const [planos, setPlanos] = useState<PlanoSaude[]>([]);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<PlanoSaude>>(PLANO_VAZIO);

    const membros = [
        'cliente',
        ...(dados.casado_cliente ? ['conjuge'] : []),
        ...dependentes.filter(d => d.nome_dependente?.trim()).map(d => d.nome_dependente),
    ];

    useEffect(() => {
        if (aberto) loadPlanos();
    }, [aberto]);

    const loadPlanos = async () => {
        setLoading(true);
        try {
            const data = await protecaoService.getPlanosSaude(dados.cliente_id);
            setPlanos(data);
        } finally {
            setLoading(false);
        }
    };

    // Status logic: todos os membros com plano = Protegido, alguns = Parcial, nenhum = Desprotegido
    const membrosComPlano = new Set(planos.map(p => p.membro));
    const todosProtegidos = membros.every(m => membrosComPlano.has(m));
    const alguemProtegido = membros.some(m => membrosComPlano.has(m));
    const status: StatusType = todosProtegidos ? 'protegido' : alguemProtegido ? 'parcial' : 'desprotegido';

    const openNovoModal = () => {
        setForm({ ...PLANO_VAZIO, cliente_id: dados.cliente_id, membro: membros[0] });
        setModal(true);
    };

    const openEditModal = (p: PlanoSaude) => {
        setForm({ ...p });
        setModal(true);
    };

    const salvar = async () => {
        if (!form.membro || !form.operadora) return;
        const plano = { ...form, cliente_id: dados.cliente_id } as PlanoSaude;
        const saved = await protecaoService.upsertPlanoSaude(plano);
        setPlanos(prev => form.id ? prev.map(p => p.id === form.id ? saved : p) : [...prev, saved]);
        setModal(false);
    };

    const excluir = async (id: string) => {
        await protecaoService.deletePlanoSaude(id);
        setPlanos(prev => prev.filter(p => p.id !== id));
    };

    const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
        <button type="button" onClick={() => onChange(!value)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${value ? 'bg-[color:var(--primary)]' : 'bg-surface-3'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-surface shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
    );

    return (
        <div className={defaultAberto ? '' : 'bg-surface rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden'}>
            <button onClick={() => setAberto(v => !v)}
                className={`w-full flex items-center justify-between px-5 py-4 hover:bg-surface-2/50 transition-colors ${defaultAberto ? 'hidden' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-surface-2 rounded-[8px] flex items-center justify-center shrink-0">
                        <Heart size={16} className="text-[color:var(--danger)]" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider leading-none mb-1">Pilar 2</p>
                        <p className="text-[14px] font-bold text-main tracking-tight leading-none">Plano de Saúde</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    {aberto ? <ChevronUp size={16} className="text-faint" /> : <ChevronDown size={16} className="text-faint" />}
                </div>
            </button>

            {aberto && (
                <div className={`space-y-5 ${defaultAberto ? '' : 'border-t border-subtle px-5 py-5'}`}>
                    {/* Cobertura por membro */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {membros.map(m => {
                            const coberto = membrosComPlano.has(m);
                            return (
                                <div key={m} className={`p-2.5 rounded-xl border text-center shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${coberto ? 'bg-surface-2 border-subtle' : 'bg-surface-2/50 border-subtle'}`}>
                                    <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1 capitalize">{m}</p>
                                    <p className={`text-[11px] font-bold ${coberto ? 'text-[color:var(--primary)]' : 'text-[color:var(--danger)]'}`}>
                                        {coberto ? '✓ Com plano' : '✗ Sem plano'}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Lista de planos */}
                    {loading ? (
                        <div className="py-6 flex justify-center"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[color:var(--primary)]" /></div>
                    ) : planos.length > 0 ? (
                        <div className="rounded-xl border border-subtle overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] bg-surface">
                            <div className="bg-surface px-4 py-3 border-b border-subtle grid grid-cols-[1fr_1fr_auto_auto] gap-3 text-[10px] font-bold text-faint uppercase tracking-wider">
                                <span>Membro</span><span>Operadora / Cobertura</span><span>Mensalidade</span><span></span>
                            </div>
                            <div className="divide-y divide-subtle">
                                {planos.map(p => (
                                    <div key={p.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-center px-4 py-2.5 hover:bg-surface-2 transition-colors">
                                        <p className="text-[12px] font-bold text-main capitalize tracking-tight">{p.membro}</p>
                                        <div>
                                            <p className="text-[12px] font-bold text-main tracking-tight leading-none mb-1">{p.operadora || '—'}</p>
                                            <p className="text-[10px] font-bold text-faint tracking-wider uppercase">{p.cobertura}</p>
                                        </div>
                                        <p className="text-[13px] font-bold text-[color:var(--primary)] tracking-tight">{fmtMoeda(p.mensalidade || 0)}</p>
                                        <div className="flex gap-1">
                                            <button onClick={() => openEditModal(p)} className="p-1.5 text-faint hover:text-[color:var(--primary)] hover:bg-surface-2 rounded-lg transition-colors"><Edit2 size={13} /></button>
                                            <button onClick={() => excluir(p.id!)} className="p-1.5 text-faint hover:text-[color:var(--danger)] hover:bg-surface-2 rounded-lg transition-colors"><Trash2 size={13} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-faint text-center py-4">Nenhum plano de saúde cadastrado.</p>
                    )}

                    <button onClick={openNovoModal}
                        className="flex items-center gap-1.5 px-3 h-9 rounded-[8px] border border-dashed border-subtle text-[color:var(--primary)] hover:bg-surface-2 font-bold text-[10px] uppercase tracking-wider transition-all w-max shadow-sm">
                        <Plus size={13} /> Adicionar Plano de Saúde
                    </button>
                </div>
            )}

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-surface-3/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-subtle pb-3">
                            <h3 className="text-[16px] font-bold text-main tracking-tight">{form.id ? 'Editar' : 'Novo'} Plano de Saúde</h3>
                            <button onClick={() => setModal(false)}><X size={18} className="text-faint hover:text-muted transition-colors" /></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className={lbl}>Membro</label>
                                <select value={form.membro} onChange={e => setForm(f => ({ ...f, membro: e.target.value }))} className={inp}>
                                    {membros.map(m => <option key={m} value={m} className="capitalize">{m === 'cliente' ? dados.nome_cliente || 'Cliente' : m === 'conjuge' ? dados.nome_conjuge || 'Cônjuge' : m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Operadora</label>
                                <input value={form.operadora || ''} onChange={e => setForm(f => ({ ...f, operadora: e.target.value }))} className={inp} placeholder="Ex: Unimed, Bradesco..." />
                            </div>
                            <div>
                                <label className={lbl}>Cobertura</label>
                                <select value={form.cobertura || 'Nacional'} onChange={e => setForm(f => ({ ...f, cobertura: e.target.value }))} className={inp}>
                                    <option>Nacional</option><option>Estadual</option><option>Municipal</option>
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Mensalidade (R$)</label>
                                <input type="text"
                                    value={(form.mensalidade || 0) > 0 ? (form.mensalidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                                    onChange={e => { const n = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, mensalidade: n ? parseInt(n) / 100 : 0 })); }}
                                    className={inp} placeholder="0,00" />
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <p className={lbl}>Coberturas incluídas</p>
                            {[
                                { key: 'coparticipacao', label: 'Coparticipação', desc: 'Possui coparticipação nos procedimentos' },
                                { key: 'uti', label: 'UTI', desc: 'Cobre internação em UTI' },
                                { key: 'quarto_privativo', label: 'Quarto Privativo', desc: 'Internação em quarto individual' },
                                { key: 'obstetricia', label: 'Obstetrícia', desc: 'Cobre partos e procedimentos obstétricos' },
                            ].map(({ key, label, desc }) => (
                                <div key={key} className="flex items-center justify-between py-2.5 border-b border-subtle last:border-0">
                                    <div>
                                        <p className="text-[12px] font-bold text-main tracking-tight">{label}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-faint">{desc}</p>
                                    </div>
                                    <button type="button"
                                        onClick={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))}
                                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${(form as any)[key] ? 'bg-[color:var(--primary)]' : 'bg-surface-3'}`}>
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-surface shadow transition-transform ${(form as any)[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-4">
                            <button onClick={() => setModal(false)} className="flex-1 h-9 rounded-[8px] border border-subtle text-muted font-bold text-[10px] uppercase tracking-wider hover:bg-surface-2 shadow-sm">Cancelar</button>
                            <button onClick={salvar} className="flex-1 h-9 rounded-[8px] bg-[color:var(--primary)] text-white font-bold text-[10px] uppercase tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:opacity-90 flex items-center justify-center gap-1.5">
                                <Check size={13} /> Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcordeoPlanoSaude;
