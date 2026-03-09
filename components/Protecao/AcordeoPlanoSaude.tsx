
import React, { useState, useEffect } from 'react';
import { Heart, ChevronDown, ChevronUp, Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { PlanoSaude, protecaoService, ClienteSeguro, DependenteSeguro } from '../../services/protecaoService';

const inp = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all";
const lbl = "block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5";
const fmtMoeda = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

type StatusType = 'protegido' | 'parcial' | 'desprotegido';

interface StatusBadgeProps { status: StatusType; }
const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const map = {
        protegido: { label: 'Protegido', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        parcial: { label: 'Parcialmente Protegido', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
        desprotegido: { label: 'Desprotegido', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
    };
    const { label, cls } = map[status];
    return (
        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${cls}`}>
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
}

const AcordeoPlanoSaude: React.FC<Props> = ({ dados, dependentes }) => {
    const [aberto, setAberto] = useState(false);
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
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${value ? 'bg-emerald-600' : 'bg-slate-200'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
    );

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button onClick={() => setAberto(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-rose-50 rounded-xl flex items-center justify-center shrink-0">
                        <Heart size={18} className="text-rose-400" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilar 2</p>
                        <p className="text-sm font-black text-slate-800">Plano de Saúde</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    {aberto ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </button>

            {aberto && (
                <div className="border-t border-slate-50 px-6 py-6 space-y-4">
                    {/* Cobertura por membro */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {membros.map(m => {
                            const coberto = membrosComPlano.has(m);
                            return (
                                <div key={m} className={`p-3 rounded-xl border text-center ${coberto ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 capitalize">{m}</p>
                                    <p className={`text-xs font-black ${coberto ? 'text-emerald-600' : 'text-rose-400'}`}>
                                        {coberto ? '✓ Com plano' : '✗ Sem plano'}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Lista de planos */}
                    {loading ? (
                        <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" /></div>
                    ) : planos.length > 0 ? (
                        <div className="rounded-2xl border border-slate-100 overflow-hidden">
                            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 grid grid-cols-[1fr_1fr_auto_auto] gap-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <span>Membro</span><span>Operadora / Cobertura</span><span>Mensalidade</span><span></span>
                            </div>
                            {planos.map(p => (
                                <div key={p.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-center px-5 py-3 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <p className="text-xs font-bold text-slate-700 capitalize">{p.membro}</p>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">{p.operadora || '—'}</p>
                                        <p className="text-[9px] text-slate-400">{p.cobertura}</p>
                                    </div>
                                    <p className="text-xs font-black text-emerald-600">{fmtMoeda(p.mensalidade || 0)}</p>
                                    <div className="flex gap-1">
                                        <button onClick={() => openEditModal(p)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit2 size={13} /></button>
                                        <button onClick={() => excluir(p.id!)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 text-center py-4">Nenhum plano de saúde cadastrado.</p>
                    )}

                    <button onClick={openNovoModal}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-black text-xs uppercase tracking-widest transition-all">
                        <Plus size={13} /> Adicionar Plano de Saúde
                    </button>
                </div>
            )}

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900">{form.id ? 'Editar' : 'Novo'} Plano de Saúde</h3>
                            <button onClick={() => setModal(false)}><X size={20} className="text-slate-400" /></button>
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
                                <div key={key} className="flex items-center justify-between py-2 border-b border-slate-50">
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">{label}</p>
                                        <p className="text-[9px] text-slate-400">{desc}</p>
                                    </div>
                                    <button type="button"
                                        onClick={() => setForm(f => ({ ...f, [key]: !(f as any)[key] }))}
                                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${(form as any)[key] ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${(form as any)[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                    </button>
                                </div>
                            ))}
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

export default AcordeoPlanoSaude;
