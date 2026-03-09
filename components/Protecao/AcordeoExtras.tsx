
import React, { useState, useEffect } from 'react';
import { Package, ChevronDown, ChevronUp, Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { SeguroExtra, protecaoService, ClienteSeguro } from '../../services/protecaoService';

const inp = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all";
const lbl = "block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5";
const fmtMoeda = (v: number) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const TIPOS = ['Residencial', 'Automotivo', 'Empresarial', 'Responsabilidade Civil', 'Vida em Grupo', 'Outro'];

const EXTRA_VAZIO: Omit<SeguroExtra, 'id' | 'cliente_id'> = {
    tipo_seguro: '',
    descricao: '',
    inicio_vigencia: '',
    fim_vigencia: '',
    mensalidade: 0,
};

interface Props {
    dados: ClienteSeguro;
}

const AcordeoExtras: React.FC<Props> = ({ dados }) => {
    const [aberto, setAberto] = useState(false);
    const [extras, setExtras] = useState<SeguroExtra[]>([]);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState(false);
    const [form, setForm] = useState<Partial<SeguroExtra>>(EXTRA_VAZIO);

    useEffect(() => {
        if (aberto) loadExtras();
    }, [aberto]);

    const loadExtras = async () => {
        setLoading(true);
        try {
            const data = await protecaoService.getSegurosExtras(dados.cliente_id);
            setExtras(data);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (extra?: SeguroExtra) => {
        setForm(extra ? { ...extra } : { ...EXTRA_VAZIO, cliente_id: dados.cliente_id });
        setModal(true);
    };

    const salvar = async () => {
        const extra = { ...form, cliente_id: dados.cliente_id } as SeguroExtra;
        const saved = await protecaoService.upsertSeguroExtra(extra);
        setExtras(prev => form.id ? prev.map(e => e.id === form.id ? saved : e) : [...prev, saved]);
        setModal(false);
    };

    const excluir = async (id: string) => {
        await protecaoService.deleteSeguroExtra(id);
        setExtras(prev => prev.filter(e => e.id !== id));
    };

    const totalMensalidade = extras.reduce((a, e) => a + (e.mensalidade || 0), 0);

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button onClick={() => setAberto(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                        <Package size={18} className="text-slate-500" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Extras</p>
                        <p className="text-sm font-black text-slate-800">Proteções Adicionais</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {extras.length > 0 ? (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-slate-100 text-slate-600 border-slate-200">
                            {extras.length} {extras.length === 1 ? 'seguro' : 'seguros'}
                        </span>
                    ) : (
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border bg-slate-50 text-slate-400 border-slate-100">
                            Nenhum
                        </span>
                    )}
                    {aberto ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </button>

            {aberto && (
                <div className="border-t border-slate-50 px-6 py-6 space-y-4">
                    {/* Total de mensalidades */}
                    {extras.length > 0 && (
                        <div className="flex items-center justify-between bg-slate-50 rounded-xl px-5 py-3">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total de Mensalidades Extras</p>
                            <p className="text-base font-black text-slate-800">{fmtMoeda(totalMensalidade)}</p>
                        </div>
                    )}

                    {/* Lista */}
                    {loading ? (
                        <div className="py-8 flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" /></div>
                    ) : extras.length > 0 ? (
                        <div className="rounded-2xl border border-slate-100 overflow-hidden">
                            <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <span>Tipo</span><span>Descrição</span><span>Vigência</span><span>Mensalidade</span><span></span>
                            </div>
                            {extras.map(e => {
                                const vigencia = e.inicio_vigencia && e.fim_vigencia
                                    ? `${new Date(e.inicio_vigencia + 'T00:00:00').toLocaleDateString('pt-BR')} – ${new Date(e.fim_vigencia + 'T00:00:00').toLocaleDateString('pt-BR')}`
                                    : '—';
                                return (
                                    <div key={e.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center px-5 py-3 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <p className="text-xs font-bold text-slate-800">{e.tipo_seguro || '—'}</p>
                                        <p className="text-xs text-slate-500 truncate">{e.descricao || '—'}</p>
                                        <p className="text-[9px] text-slate-400 whitespace-nowrap">{vigencia}</p>
                                        <p className="text-xs font-black text-emerald-600">{fmtMoeda(e.mensalidade || 0)}</p>
                                        <div className="flex gap-1">
                                            <button onClick={() => openModal(e)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit2 size={13} /></button>
                                            <button onClick={() => excluir(e.id!)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 text-center py-4">Nenhuma proteção adicional cadastrada.</p>
                    )}

                    <button onClick={() => openModal()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:bg-slate-50 font-black text-xs uppercase tracking-widest transition-all">
                        <Plus size={13} /> Adicionar Proteção Extra
                    </button>
                </div>
            )}

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900">{form.id ? 'Editar' : 'Nova'} Proteção Extra</h3>
                            <button onClick={() => setModal(false)}><X size={20} className="text-slate-400" /></button>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className={lbl}>Tipo de Seguro</label>
                                <select value={form.tipo_seguro || ''} onChange={e => setForm(f => ({ ...f, tipo_seguro: e.target.value }))} className={inp}>
                                    <option value="">Selecione...</option>
                                    {TIPOS.map(t => <option key={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Descrição / Cobertura</label>
                                <input value={form.descricao || ''} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className={inp} placeholder="Ex: Casa da Praia, Veículo Família..." />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>Início da Vigência</label>
                                    <input type="date" value={form.inicio_vigencia || ''} onChange={e => setForm(f => ({ ...f, inicio_vigencia: e.target.value }))} className={inp} />
                                </div>
                                <div>
                                    <label className={lbl}>Fim da Vigência</label>
                                    <input type="date" value={form.fim_vigencia || ''} onChange={e => setForm(f => ({ ...f, fim_vigencia: e.target.value }))} className={inp} />
                                </div>
                            </div>
                            <div>
                                <label className={lbl}>Mensalidade (R$)</label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">R$</span>
                                    <input type="text"
                                        value={(form.mensalidade || 0) > 0 ? (form.mensalidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                                        onChange={e => { const n = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, mensalidade: n ? parseInt(n) / 100 : 0 })); }}
                                        className={`${inp} pl-9`} placeholder="0,00" />
                                </div>
                            </div>
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

export default AcordeoExtras;
