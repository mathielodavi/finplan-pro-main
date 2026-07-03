
import React, { useState, useEffect } from 'react';
import { Shield, ChevronDown, ChevronUp, Settings, Zap, Edit3, Check, X } from 'lucide-react';
import { ClienteSeguro, ParametrosCalculo, protecaoService } from '../../services/protecaoService';
import { supabase } from '../../services/supabaseClient';

const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;
const fmtPct = (v: number) => `${Math.min(v, 100).toFixed(0)}%`;

const FATORES: Record<string, number> = {
    'Servidor Público': 3,
    'CLT': 6,
    'Autônomo/Liberal': 9,
    'Autônomo / Liberal': 9,
    'Empresário': 12,
};

const getFator = (regime: string | undefined) => FATORES[regime || ''] || 6;

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

interface Props {
    dados: ClienteSeguro;
    parametros: ParametrosCalculo;
    onUpdate: (campos: Partial<ClienteSeguro>) => void;
    saldoReserva: number;
}

const AcordeoReservaEmergencia: React.FC<Props> = ({ dados, parametros, onUpdate, saldoReserva }) => {
    const [aberto, setAberto] = useState(false);
    const [modalAberto, setModalAberto] = useState(false);
    const [modo, setModo] = useState<'manual' | 'automatico'>(dados.reserva_modo || 'manual');
    const [reservaManual, setReservaManual] = useState<number>(dados.reserva_ideal || 0);
    const [inclNaoObr, setInclNaoObr] = useState(dados.reserva_incluir_nao_obrigatorias ?? true);
    const [inclFinanc, setInclFinanc] = useState(dados.reserva_incluir_financiamentos ?? true);
    const [inclDividas, setInclDividas] = useState(dados.reserva_incluir_dividas ?? true);

    const [reservaLegada, setReservaLegada] = useState<number>(0);

    useEffect(() => {
        const fetchFallback = async () => {
            if (dados.cliente_id) {
                const { data } = await supabase
                    .from('clientes')
                    .select('reserva_recomendada')
                    .eq('id', dados.cliente_id)
                    .single();
                if (data?.reserva_recomendada !== undefined) {
                    setReservaLegada(data.reserva_recomendada);
                    if (reservaManual === 0) setReservaManual(data.reserva_recomendada);
                }
            }
        };
        fetchFallback();
    }, [dados.cliente_id]);

    const calcularReservaAutomatica = () => {
        let gastos = dados.despesas_obrigatorias || 0;
        if (inclNaoObr) gastos += dados.despesas_nao_obrigatorias || 0;
        if (inclFinanc) gastos += dados.financiamentos || 0;
        if (inclDividas) gastos += dados.dividas_mensais || 0;

        const fatorCliente = getFator(dados.regime_contratacao_cliente);
        const temConjuge = !!dados.casado_cliente;
        const fator = temConjuge
            ? (fatorCliente + getFator(dados.regime_contratacao_conjuge)) / 2
            : fatorCliente;

        return gastos * fator;
    };

    const reservaIdeal = modo === 'automatico' ? calcularReservaAutomatica() : (reservaLegada || 0);

    const pct = reservaIdeal > 0 ? (saldoReserva / reservaIdeal) * 100 : 0;

    const status: StatusType =
        saldoReserva <= 0 ? 'desprotegido' :
            pct >= 100 ? 'protegido' :
                pct >= 25 ? 'parcial' : 'desprotegido';

    const salvar = async () => {
        const reservaFinal = modo === 'automatico' ? calcularReservaAutomatica() : reservaManual;
        const campos: Partial<ClienteSeguro> = {
            reserva_modo: modo,
            reserva_incluir_nao_obrigatorias: inclNaoObr,
            reserva_incluir_financiamentos: inclFinanc,
            reserva_incluir_dividas: inclDividas,
        };
        // Atualiza modo e configurações no clientes_seguros
        await protecaoService.update(dados.cliente_id, campos);

        // Atualiza a reserva_recomendada da tabela clientes (Single Source of Truth)
        await supabase.from('clientes').update({ reserva_recomendada: reservaFinal }).eq('id', dados.cliente_id);

        setReservaLegada(reservaFinal);
        onUpdate(campos);
        setModalAberto(false);
    };

    const barW = Math.min(pct, 100);
    const barColor = status === 'protegido' ? 'bg-[color:var(--primary)]' : status === 'parcial' ? 'bg-amber-400' : 'bg-rose-400';

    return (
        <div className="bg-surface rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden">
            {/* Header do acordeão */}
            <button
                onClick={() => setAberto(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-2/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-[color:var(--primary-soft)] rounded-[8px] flex items-center justify-center shrink-0">
                        <Shield size={16} className="text-[color:var(--primary)]" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1 leading-none">Pilar 1</p>
                        <p className="text-[14px] font-bold text-main tracking-tight leading-none">Reserva de Emergência</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    {aberto ? <ChevronUp size={16} className="text-faint" /> : <ChevronDown size={16} className="text-faint" />}
                </div>
            </button>

            {/* Conteúdo */}
            {aberto && (
                <div className="border-t border-subtle px-5 py-5 space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-surface-2 border border-subtle rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Reserva Ideal</p>
                            <p className="text-[18px] font-bold text-main tracking-tight">{fmtMoeda(reservaIdeal)}</p>
                            <p className="text-[10px] font-bold text-faint uppercase tracking-wider mt-1 capitalize">{modo}</p>
                        </div>
                        <div className="bg-surface-2 border border-subtle rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Saldo Acumulado</p>
                            <p className={`text-[18px] font-bold tracking-tight ${saldoReserva > 0 ? 'text-[color:var(--primary)]' : 'text-[color:var(--danger)]'}`}>{fmtMoeda(saldoReserva)}</p>
                            <p className="text-[10px] font-bold text-faint uppercase tracking-wider mt-1">Ativos na carteira</p>
                        </div>
                        <div className="bg-surface-2 border border-subtle rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Preenchimento</p>
                            <p className={`text-[18px] font-bold tracking-tight ${status === 'protegido' ? 'text-[color:var(--primary)]' : status === 'parcial' ? 'text-[color:var(--warning)]' : 'text-[color:var(--danger)]'}`}>{fmtPct(pct)}</p>
                            <p className="text-[10px] font-bold text-faint uppercase tracking-wider mt-1">{status === 'protegido' ? 'Meta atingida' : status === 'parcial' ? 'Em construção' : 'Sem reserva'}</p>
                        </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold text-faint uppercase tracking-widest">
                            <span>Progresso da reserva</span>
                            <span>{fmtPct(pct)}</span>
                        </div>
                        <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                                style={{ width: `${barW}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[11px] font-medium text-[color:var(--text-muted)]">
                            <span>0%</span>
                            <span className="text-[color:var(--warning)] font-bold">25% — Parcial</span>
                            <span className="text-[color:var(--primary)] font-bold">100% — Protegido</span>
                        </div>
                    </div>

                    {/* Botão definir reserva */}
                    <button
                        onClick={() => setModalAberto(true)}
                        className="flex items-center gap-1.5 px-3 h-9 rounded-[8px] border border-subtle text-muted font-bold text-[10px] uppercase tracking-wider hover:border-[color:var(--primary)] hover:text-[color:var(--primary)] transition-all w-max shadow-[0_1px_2px_rgba(0,0,0,0.05)] bg-surface"
                    >
                        <Settings size={13} />
                        Definir Reserva Ideal
                    </button>

                    {/* Fator aplicado */}
                    <div className="bg-surface-2 border border-subtle rounded-xl p-4 text-[11px] font-bold text-muted space-y-1 shadow-sm">
                        <p className="font-bold text-faint uppercase tracking-wider mb-2 text-[10px]">Fator de Regime Aplicado</p>
                        <p>Cliente ({dados.regime_contratacao_cliente || '—'}): ×{getFator(dados.regime_contratacao_cliente)} meses</p>
                        {dados.casado_cliente && (
                            <p>Cônjuge ({dados.regime_contratacao_conjuge || '—'}): ×{getFator(dados.regime_contratacao_conjuge)} meses</p>
                        )}
                        {dados.casado_cliente && (
                            <p className="font-bold text-main pt-1 border-t border-subtle mt-2">
                                Fator médio aplicado: ×{((getFator(dados.regime_contratacao_cliente) + getFator(dados.regime_contratacao_conjuge)) / 2).toFixed(1)} meses
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de configuração */}
            {modalAberto && (
                <div className="fixed inset-0 bg-surface-3/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md p-5 space-y-6">
                        <div className="flex items-center justify-between border-b border-subtle pb-3">
                            <h3 className="text-[16px] font-bold text-main tracking-tight">Definir Reserva Ideal</h3>
                            <button onClick={() => setModalAberto(false)} className="text-faint hover:text-muted transition-colors">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Seleção de modo */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setModo('manual')}
                                className={`p-4 rounded-xl border text-left transition-all ${modo === 'manual' ? 'border-[color:var(--primary)] bg-surface-2 shadow-sm' : 'border-subtle hover:border-[color:var(--primary)]'}`}
                            >
                                <Edit3 size={16} className={modo === 'manual' ? 'text-[color:var(--primary)]' : 'text-faint'} />
                                <p className={`text-[12px] font-bold tracking-tight mt-2 ${modo === 'manual' ? 'text-[color:var(--primary)]' : 'text-main'}`}>Manual</p>
                                <p className="text-[10px] font-bold text-faint uppercase tracking-wider mt-0.5">Defino o valor</p>
                            </button>
                            <button
                                onClick={() => setModo('automatico')}
                                className={`p-4 rounded-xl border text-left transition-all ${modo === 'automatico' ? 'border-[color:var(--primary)] bg-surface-2 shadow-sm' : 'border-subtle hover:border-[color:var(--primary)]'}`}
                            >
                                <Zap size={16} className={modo === 'automatico' ? 'text-[color:var(--primary)]' : 'text-faint'} />
                                <p className={`text-[12px] font-bold tracking-tight mt-2 ${modo === 'automatico' ? 'text-[color:var(--primary)]' : 'text-main'}`}>Automatizado</p>
                                <p className="text-[10px] font-bold text-faint uppercase tracking-wider mt-0.5">Cálculo pelo sistema</p>
                            </button>
                        </div>

                        {/* Input manual */}
                        {modo === 'manual' && (
                            <div>
                                <label className="block text-[10px] font-bold text-faint uppercase tracking-wider mb-1.5">Valor da reserva ideal (R$)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-faint">R$</span>
                                    <input
                                        type="text"
                                        value={reservaManual > 0 ? reservaManual.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                                        onChange={e => {
                                            const nums = e.target.value.replace(/\D/g, '');
                                            setReservaManual(nums ? parseInt(nums) / 100 : 0);
                                        }}
                                        placeholder="0,00"
                                        className="w-full pl-8 pr-4 h-9 bg-surface-2 border border-subtle rounded-[8px] font-bold text-[12px] text-main outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-surface focus:border-[color:var(--primary)] transition-all shadow-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Opções para automático */}
                        {modo === 'automatico' && (
                            <div className="space-y-3">
                                <p className="text-[11px] font-bold text-[color:var(--text-muted)] uppercase tracking-widest">Incluir nos gastos base:</p>
                                {[
                                    { label: 'Despesas obrigatórias', value: true, readOnly: true },
                                    { label: 'Despesas não obrigatórias', state: inclNaoObr, setter: setInclNaoObr },
                                    { label: 'Financiamentos', state: inclFinanc, setter: setInclFinanc },
                                    { label: 'Dívidas mensais', state: inclDividas, setter: setInclDividas },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 border-b border-subtle last:border-0">
                                        <span className="text-[13px] text-main font-medium">{item.label}</span>
                                        {item.readOnly ? (
                                            <span className="text-[10px] font-bold text-[color:var(--primary)] uppercase">Sempre incluído</span>
                                        ) : (
                                            <button
                                                onClick={() => item.setter!(!item.state)}
                                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${item.state ? 'bg-emerald-600' : 'bg-surface-3'}`}
                                            >
                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-surface shadow transition-transform ${item.state ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <div className="bg-[color:var(--primary-soft)] rounded-[12px] border border-subtle p-4 mt-2">
                                    <p className="text-[11px] font-bold text-[color:var(--primary)] uppercase tracking-widest mb-1">Reserva calculada</p>
                                    <p className="text-[20px] font-bold text-[color:var(--primary)]">{fmtMoeda(calcularReservaAutomatica())}</p>
                                    <p className="text-[11px] font-medium text-[color:var(--primary)] mt-1">
                                        Fator: ×{dados.casado_cliente
                                            ? ((getFator(dados.regime_contratacao_cliente) + getFator(dados.regime_contratacao_conjuge)) / 2).toFixed(1)
                                            : getFator(dados.regime_contratacao_cliente)} meses
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-4">
                            <button onClick={() => setModalAberto(false)} className="flex-1 h-9 rounded-[8px] border border-subtle text-muted font-bold text-[10px] uppercase tracking-wider hover:bg-surface-2 shadow-sm">Cancelar</button>
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

export default AcordeoReservaEmergencia;
