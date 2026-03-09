
import React, { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { ClienteSeguro, ParametrosCalculo } from '../../services/protecaoService';
import { calcularSucessao } from '../../utils/calculosFinanceiros';
import TooltipAjuda from './TooltipAjuda';

const lbl = "block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-0.5 mb-1.5";
const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;

// Campo monetário compacto
const CampoMonetario: React.FC<{ label: string; value: number; onChange: (v: number) => void; highlighted?: boolean }> = ({ label, value, onChange, highlighted }) => {
    const formatted = value > 0 ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nums = e.target.value.replace(/\D/g, '');
        onChange(nums ? parseInt(nums) / 100 : 0);
    };
    const baseInp = `w-full px-3 py-2 border rounded-xl font-semibold text-sm outline-none focus:ring-4 transition-all placeholder:text-slate-300 ${highlighted
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-500/10 focus:border-emerald-500'
        : 'bg-white border-slate-200 text-slate-700 focus:ring-emerald-500/10 focus:border-emerald-600'
        }`;
    return (
        <div>
            {label && <label className={lbl}>{label}</label>}
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300 pointer-events-none">R$</span>
                <input type="text" value={formatted} onChange={handleChange} className={`${baseInp} pl-8`} placeholder="0,00" />
            </div>
        </div>
    );
};

// Campo percentual compacto
const CampoPercentual: React.FC<{ label: string; value: number; onChange: (v: number) => void; tooltip?: string }> = ({ label, value, onChange, tooltip }) => (
    <div>
        <div className="flex items-center gap-1 mb-1.5">
            <label className={`${lbl} mb-0`}>{label}</label>
            {tooltip && <TooltipAjuda texto={tooltip} />}
        </div>
        <div className="relative">
            <input
                type="number"
                min={0} max={100} step={0.5}
                value={value || ''}
                onChange={e => onChange(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 pr-8 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all"
                placeholder="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">%</span>
        </div>
    </div>
);

// Campo somente-leitura
const CampoCalc: React.FC<{ value: number }> = ({ value }) => (
    <div className="w-full px-3 py-2 bg-slate-100 border border-dashed border-slate-200 rounded-xl font-semibold text-sm text-slate-600 text-right">
        {fmtMoeda(value)}
    </div>
);

interface LinhaProps {
    label: string;
    tooltip?: string;
    campoCliente: keyof ClienteSeguro;
    campoConjuge: keyof ClienteSeguro;
    dados: ClienteSeguro;
    onChange: (campo: keyof ClienteSeguro, v: number) => void;
    somaFamilia: number;
}

const Linha: React.FC<LinhaProps> = ({ label, tooltip, campoCliente, campoConjuge, dados, onChange, somaFamilia }) => (
    <div className="grid grid-cols-[1fr_140px_140px_140px] gap-3 items-center py-3 border-b border-slate-50 last:border-0">
        <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-700">{label}</span>
            {tooltip && <TooltipAjuda texto={tooltip} />}
        </div>
        <CampoMonetario label="" value={dados[campoCliente] as number || 0} onChange={v => onChange(campoCliente, v)} />
        <CampoMonetario label="" value={dados[campoConjuge] as number || 0} onChange={v => onChange(campoConjuge, v)} />
        <CampoCalc value={somaFamilia} />
    </div>
);

interface Props {
    dados: ClienteSeguro;
    onChange: (campo: keyof ClienteSeguro, valor: any) => void;
    parametros: ParametrosCalculo;
}

const EtapaSucessao: React.FC<Props> = ({ dados, onChange, parametros }) => {
    const resultado = useMemo(() => calcularSucessao(
        dados.funeral_cliente || 0, dados.funeral_conjuge || 0,
        dados.bens_cliente || 0, dados.bens_conjuge || 0,
        dados.investimentos_cliente || 0, dados.investimentos_conjuge || 0,
        dados.dividas_cliente || 0, dados.dividas_conjuge || 0,
        dados.pgbl_cliente || 0, dados.pgbl_conjuge || 0,
        dados.vgbl_cliente || 0, dados.vgbl_conjuge || 0,
        parametros.perc_custos_inventario,
        dados.honorarios_perc,
        dados.itcmd_perc,
    ), [dados, parametros]);

    const percEfetivoTotal = (dados.honorarios_perc !== undefined && dados.itcmd_perc !== undefined)
        ? dados.honorarios_perc + dados.itcmd_perc
        : parametros.perc_custos_inventario;

    return (
        <div className="space-y-4">
            {/* Configuração de custos do inventário */}
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                    <Building2 size={14} className="text-emerald-500" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Custos do Inventário</p>
                </div>
                <div className="px-5 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <CampoPercentual
                            label="Honorários (%)"
                            value={dados.honorarios_perc || 0}
                            onChange={v => onChange('honorarios_perc', v)}
                            tooltip="Percentual estimado de honorários advocatícios e custos cartoriais sobre o valor dos bens."
                        />
                        <CampoPercentual
                            label="ITCMD (%)"
                            value={dados.itcmd_perc || 0}
                            onChange={v => onChange('itcmd_perc', v)}
                            tooltip="Imposto sobre Transmissão Causa Mortis e Doação. Varia por estado (máx. 8% pelo Senado). Em SP: 4%."
                        />
                        <div className="flex flex-col justify-end">
                            <label className={lbl}>Custo Total do Inventário</label>
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                                <span className="text-base font-black text-amber-700">{percEfetivoTotal.toFixed(1)}%</span>
                                <span className="text-xs text-amber-500">sobre os bens</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-3 font-medium">
                        Se os campos acima não forem preenchidos, o sistema usará o custo padrão de {parametros.perc_custos_inventario}% configurado nos parâmetros globais.
                    </p>
                </div>
            </div>

            {/* Tabela de itens */}
            <div className="rounded-2xl border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-[1fr_140px_140px_140px] gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Item</span>
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest text-center">Cliente</span>
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest text-center">Cônjuge</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Família</span>
                </div>
                <div className="px-5">
                    <Linha label="Funeral / Luto" campoCliente="funeral_cliente" campoConjuge="funeral_conjuge"
                        dados={dados} onChange={onChange} somaFamilia={resultado.totalFuneral} />
                    <Linha label="Bens (imóveis e móveis)"
                        tooltip={`Base de cálculo: bens + investimentos + dívidas. O custo de inventário (${percEfetivoTotal.toFixed(1)}%) é aplicado sobre o total.`}
                        campoCliente="bens_cliente" campoConjuge="bens_conjuge"
                        dados={dados} onChange={onChange} somaFamilia={resultado.custoInventario} />
                    <Linha label="Investimentos Líquidos"
                        tooltip="Investimentos financeiros em geral (exceto previdência). Entram na base de cálculo do inventário junto com bens e dívidas."
                        campoCliente="investimentos_cliente" campoConjuge="investimentos_conjuge"
                        dados={dados} onChange={onChange}
                        somaFamilia={(dados.investimentos_cliente || 0) + (dados.investimentos_conjuge || 0)} />
                    <Linha label="Dívidas" campoCliente="dividas_cliente" campoConjuge="dividas_conjuge"
                        dados={dados} onChange={onChange}
                        somaFamilia={(dados.dividas_cliente || 0) + (dados.dividas_conjuge || 0)} />
                    <Linha label="Previdência PGBL"
                        tooltip="Saldo de PGBL. A previdência passa diretamente aos beneficiários, sem inventário."
                        campoCliente="pgbl_cliente" campoConjuge="pgbl_conjuge"
                        dados={dados} onChange={onChange}
                        somaFamilia={(dados.pgbl_cliente || 0) + (dados.pgbl_conjuge || 0)} />
                    <Linha label="Previdência VGBL"
                        tooltip="Saldo de VGBL. Indicado para quem usa declaração simplificada de IR."
                        campoCliente="vgbl_cliente" campoConjuge="vgbl_conjuge"
                        dados={dados} onChange={onChange}
                        somaFamilia={(dados.vgbl_cliente || 0) + (dados.vgbl_conjuge || 0)} />
                </div>
            </div>

            {/* Resultado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total de Necessidades</p>
                    <p className="text-xl font-black text-slate-800">{fmtMoeda(resultado.totalNecessidades)}</p>
                    <p className="text-[9px] text-slate-400 mt-1">Funeral + Inventário + Dívidas</p>
                </div>
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2">Ativos Previdenciários Disponíveis</p>
                    <p className="text-xl font-black text-emerald-700">{fmtMoeda(resultado.ativosPrevidenciarios)}</p>
                    <p className="text-[9px] text-emerald-400 mt-1">PGBL + VGBL (isento de inventário)</p>
                </div>
                <div className="p-5 bg-rose-600 rounded-2xl text-white">
                    <p className="text-[9px] font-black text-rose-200 uppercase tracking-widest mb-2">Cobertura Necessária — Sucessão</p>
                    <p className="text-2xl font-black tracking-tighter">{fmtMoeda(resultado.coberturaSucessao)}</p>
                    <p className="text-[9px] text-rose-300 mt-1">Necessidades − Ativos previdenciários</p>
                </div>
            </div>
        </div>
    );
};

export default EtapaSucessao;
