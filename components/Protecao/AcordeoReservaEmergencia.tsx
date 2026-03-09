
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
    const barColor = status === 'protegido' ? 'bg-emerald-500' : status === 'parcial' ? 'bg-amber-400' : 'bg-rose-400';

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Header do acordeão */}
            <button
                onClick={() => setAberto(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                        <Shield size={18} className="text-emerald-500" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilar 1</p>
                        <p className="text-sm font-black text-slate-800">Reserva de Emergência</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={status} />
                    {aberto ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </button>

            {/* Conteúdo */}
            {aberto && (
                <div className="border-t border-slate-50 px-6 py-6 space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 rounded-2xl p-5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Reserva Ideal</p>
                            <p className="text-xl font-black text-slate-800">{fmtMoeda(reservaIdeal)}</p>
                            <p className="text-[9px] text-slate-400 mt-1 capitalize">{modo}</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Saldo Acumulado</p>
                            <p className={`text-xl font-black ${saldoReserva > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{fmtMoeda(saldoReserva)}</p>
                            <p className="text-[9px] text-slate-400 mt-1">Ativos de reserva na carteira</p>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Grau de Preenchimento</p>
                            <p className={`text-xl font-black ${status === 'protegido' ? 'text-emerald-600' : status === 'parcial' ? 'text-amber-600' : 'text-rose-500'}`}>{fmtPct(pct)}</p>
                            <p className="text-[9px] text-slate-400 mt-1">{status === 'protegido' ? 'Meta atingida' : status === 'parcial' ? 'Em construção' : 'Sem reserva'}</p>
                        </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <span>Progresso da reserva</span>
                            <span>{fmtPct(pct)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                                style={{ width: `${barW}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400">
                            <span>0%</span>
                            <span className="text-amber-500 font-bold">25% — Parcial</span>
                            <span className="text-emerald-500 font-bold">100% — Protegido</span>
                        </div>
                    </div>

                    {/* Botão definir reserva */}
                    <button
                        onClick={() => setModalAberto(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                        <Settings size={13} />
                        Definir Reserva Ideal
                    </button>

                    {/* Fator aplicado */}
                    <div className="bg-slate-50 rounded-xl p-4 text-[9px] text-slate-500 space-y-0.5">
                        <p className="font-black text-slate-400 uppercase tracking-widest mb-2">Fator de Regime Aplicado</p>
                        <p>Cliente ({dados.regime_contratacao_cliente || '—'}): ×{getFator(dados.regime_contratacao_cliente)} meses</p>
                        {dados.casado_cliente && (
                            <p>Cônjuge ({dados.regime_contratacao_conjuge || '—'}): ×{getFator(dados.regime_contratacao_conjuge)} meses</p>
                        )}
                        {dados.casado_cliente && (
                            <p className="font-bold text-slate-600 pt-1">
                                Fator médio aplicado: ×{((getFator(dados.regime_contratacao_cliente) + getFator(dados.regime_contratacao_conjuge)) / 2).toFixed(1)} meses
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de configuração */}
            {modalAberto && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900">Definir Reserva Ideal</h3>
                            <button onClick={() => setModalAberto(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Seleção de modo */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setModo('manual')}
                                className={`p-4 rounded-2xl border-2 text-left transition-all ${modo === 'manual' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-emerald-200'}`}
                            >
                                <Edit3 size={16} className={modo === 'manual' ? 'text-emerald-600' : 'text-slate-400'} />
                                <p className={`text-xs font-black mt-2 ${modo === 'manual' ? 'text-emerald-700' : 'text-slate-600'}`}>Manual</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">Defino o valor</p>
                            </button>
                            <button
                                onClick={() => setModo('automatico')}
                                className={`p-4 rounded-2xl border-2 text-left transition-all ${modo === 'automatico' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-emerald-200'}`}
                            >
                                <Zap size={16} className={modo === 'automatico' ? 'text-emerald-600' : 'text-slate-400'} />
                                <p className={`text-xs font-black mt-2 ${modo === 'automatico' ? 'text-emerald-700' : 'text-slate-600'}`}>Automatizado</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">Cálculo pelo sistema</p>
                            </button>
                        </div>

                        {/* Input manual */}
                        {modo === 'manual' && (
                            <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valor da reserva ideal (R$)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300">R$</span>
                                    <input
                                        type="text"
                                        value={reservaManual > 0 ? reservaManual.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                                        onChange={e => {
                                            const nums = e.target.value.replace(/\D/g, '');
                                            setReservaManual(nums ? parseInt(nums) / 100 : 0);
                                        }}
                                        placeholder="0,00"
                                        className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Opções para automático */}
                        {modo === 'automatico' && (
                            <div className="space-y-3">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Incluir nos gastos base:</p>
                                {[
                                    { label: 'Despesas obrigatórias', value: true, readOnly: true },
                                    { label: 'Despesas não obrigatórias', state: inclNaoObr, setter: setInclNaoObr },
                                    { label: 'Financiamentos', state: inclFinanc, setter: setInclFinanc },
                                    { label: 'Dívidas mensais', state: inclDividas, setter: setInclDividas },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50">
                                        <span className="text-sm text-slate-600 font-medium">{item.label}</span>
                                        {item.readOnly ? (
                                            <span className="text-[9px] font-black text-emerald-500 uppercase">Sempre incluído</span>
                                        ) : (
                                            <button
                                                onClick={() => item.setter!(!item.state)}
                                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${item.state ? 'bg-emerald-600' : 'bg-slate-200'}`}
                                            >
                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${item.state ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <div className="bg-emerald-50 rounded-xl p-4 mt-2">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Reserva calculada</p>
                                    <p className="text-xl font-black text-emerald-700">{fmtMoeda(calcularReservaAutomatica())}</p>
                                    <p className="text-[9px] text-emerald-600 mt-1">
                                        Fator: ×{dados.casado_cliente
                                            ? ((getFator(dados.regime_contratacao_cliente) + getFator(dados.regime_contratacao_conjuge)) / 2).toFixed(1)
                                            : getFator(dados.regime_contratacao_cliente)} meses
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setModalAberto(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-black text-xs uppercase hover:bg-slate-50">Cancelar</button>
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

export default AcordeoReservaEmergencia;
