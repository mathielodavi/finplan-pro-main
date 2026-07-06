
import React, { useState, useEffect } from 'react';
import { Package, ChevronDown, ChevronUp, Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { SeguroExtra, protecaoService, ClienteSeguro } from '../../services/protecaoService';

const inp = "w-full px-3 h-9 bg-surface-2 border border-subtle rounded-[8px] font-bold text-main text-[12px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-surface focus:border-[color:var(--primary)] transition-all shadow-sm";
const lbl = "block text-[10px] font-bold text-faint uppercase tracking-wider mb-1.5";
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
    defaultAberto?: boolean;
}

const AcordeoExtras: React.FC<Props> = ({ dados, defaultAberto }) => {
    const [aberto, setAberto] = useState(defaultAberto ?? false);
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
        <div className={defaultAberto ? '' : 'bg-surface rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden'}>
            <button onClick={() => setAberto(v => !v)}
                className={`w-full flex items-center justify-between px-5 py-4 hover:bg-surface-2/50 transition-colors ${defaultAberto ? 'hidden' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-surface-2 rounded-[8px] flex items-center justify-center shrink-0">
                        <Package size={16} className="text-muted" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider leading-none mb-1">Extras</p>
                        <p className="text-[14px] font-bold text-main tracking-tight leading-none">Proteções Adicionais</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {extras.length > 0 ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-surface-2 text-muted border-[color:var(--border)]">
                            {extras.length} {extras.length === 1 ? 'seguro' : 'seguros'}
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-surface-2 text-faint border-[color:var(--border)]">
                            Nenhum
                        </span>
                    )}
                    {aberto ? <ChevronUp size={16} className="text-faint" /> : <ChevronDown size={16} className="text-faint" />}
                </div>
            </button>

            {aberto && (
                <div className={`space-y-5 ${defaultAberto ? '' : 'border-t border-subtle px-5 py-5'}`}>
                    {/* Total de mensalidades */}
                    {extras.length > 0 && (
                        <div className="flex items-center justify-between bg-surface-2 border border-subtle rounded-xl px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Total de Mensalidades Extras</p>
                            <p className="text-[16px] font-bold text-main tracking-tight">{fmtMoeda(totalMensalidade)}</p>
                        </div>
                    )}

                    {/* Lista */}
                    {loading ? (
                        <div className="py-6 flex justify-center"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[color:var(--primary)]" /></div>
                    ) : extras.length > 0 ? (
                        <div className="rounded-xl border border-subtle overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)] bg-surface">
                            <div className="bg-surface px-4 py-3 border-b border-subtle grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 text-[10px] font-bold text-faint uppercase tracking-wider">
                                <span>Tipo</span><span>Descrição</span><span>Vigência</span><span>Mensalidade</span><span></span>
                            </div>
                            <div className="divide-y divide-subtle">
                                {extras.map(e => {
                                    const vigencia = e.inicio_vigencia && e.fim_vigencia
                                        ? `${new Date(e.inicio_vigencia + 'T00:00:00').toLocaleDateString('pt-BR')} – ${new Date(e.fim_vigencia + 'T00:00:00').toLocaleDateString('pt-BR')}`
                                        : '—';
                                    return (
                                        <div key={e.id} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 hover:bg-surface-2 transition-colors">
                                            <p className="text-[12px] font-bold text-main tracking-tight">{e.tipo_seguro || '—'}</p>
                                            <p className="text-[12px] font-medium text-muted truncate tracking-tight">{e.descricao || '—'}</p>
                                            <p className="text-[10px] font-bold text-faint uppercase tracking-wider whitespace-nowrap">{vigencia}</p>
                                            <p className="text-[13px] font-bold text-[color:var(--primary)] tracking-tight">{fmtMoeda(e.mensalidade || 0)}</p>
                                            <div className="flex gap-1">
                                                <button onClick={() => openModal(e)} className="p-1.5 text-faint hover:text-[color:var(--primary)] hover:bg-surface-2 rounded-lg transition-colors"><Edit2 size={13} /></button>
                                                <button onClick={() => excluir(e.id!)} className="p-1.5 text-faint hover:text-[color:var(--danger)] hover:bg-surface-2 rounded-lg transition-colors"><Trash2 size={13} /></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-faint text-center py-4">Nenhuma proteção adicional cadastrada.</p>
                    )}

                    <button onClick={() => openModal()}
                        className="flex items-center gap-1.5 px-3 h-9 rounded-[8px] border border-dashed border-subtle text-muted hover:bg-surface-2 hover:text-main hover:border-subtle font-bold text-[10px] uppercase tracking-wider transition-all w-max shadow-sm">
                        <Plus size={13} /> Adicionar Proteção Extra
                    </button>
                </div>
            )}

            {/* Modal */}
            {modal && (
                <div className="fixed inset-0 bg-surface-3/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-5 space-y-5">
                        <div className="flex items-center justify-between border-b border-subtle pb-3">
                            <h3 className="text-[16px] font-bold text-main tracking-tight">{form.id ? 'Editar' : 'Nova'} Proteção Extra</h3>
                            <button onClick={() => setModal(false)}><X size={18} className="text-faint hover:text-muted transition-colors" /></button>
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
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-faint">R$</span>
                                    <input type="text"
                                        value={(form.mensalidade || 0) > 0 ? (form.mensalidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                                        onChange={e => { const n = e.target.value.replace(/\D/g, ''); setForm(f => ({ ...f, mensalidade: n ? parseInt(n) / 100 : 0 })); }}
                                        className={`${inp} pl-9`} placeholder="0,00" />
                                </div>
                            </div>
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

export default AcordeoExtras;
