
import React, { useMemo } from 'react';
import { Building2 } from 'lucide-react';
import { ClienteSeguro, ParametrosCalculo } from '../../services/protecaoService';
import { calcularSucessao } from '../../utils/calculosFinanceiros';
import TooltipAjuda from './TooltipAjuda';

const lbl = "block text-[12px] font-semibold text-[color:var(--text-muted)] ml-1 mb-1.5";
const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;

// Campo monetário compacto
const CampoMonetario: React.FC<{ label: string; value: number; onChange: (v: number) => void; highlighted?: boolean }> = ({ label, value, onChange, highlighted }) => {
    const formatted = value > 0 ? value.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '';
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nums = e.target.value.replace(/\D/g, '');
        onChange(nums ? parseInt(nums) / 100 : 0);
    };
    const baseInp = `w-full px-3 h-[36px] border rounded-lg font-medium text-[13px] outline-none focus:ring-4 transition-all placeholder:text-faint ${highlighted
        ? 'bg-[color:var(--primary-soft)] border-subtle text-[color:var(--primary)] focus:ring-emerald-500/10 focus:border-[color:var(--primary)]'
        : 'bg-surface border-subtle text-main focus:ring-emerald-500/10 focus:border-[color:var(--primary)]'
        }`;
    return (
        <div>
            {label && <label className={lbl}>{label}</label>}
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-faint pointer-events-none">R$</span>
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
                className="w-full px-3 h-[36px] pr-8 bg-surface border border-subtle text-main rounded-lg font-medium text-[13px] outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-[color:var(--primary)] transition-all"
                placeholder="0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-faint">%</span>
        </div>
    </div>
);

// Campo somente-leitura
const CampoCalc: React.FC<{ value: number }> = ({ value }) => (
    <div className="w-full px-3 h-[36px] flex items-center justify-end bg-surface-2 border border-dashed border-subtle rounded-lg font-semibold text-[13px] text-[color:var(--text-muted)]">
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
    <div className="grid grid-cols-[1fr_140px_140px_140px] gap-3 items-center py-2.5 border-b border-[color:var(--border)] last:border-0">
        <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-main">{label}</span>
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
            <div className="rounded-[12px] border border-[color:var(--border)] overflow-hidden shadow-[var(--shadow-card)] bg-surface">
                <div className="bg-surface-2 px-5 py-3.5 border-b border-[color:var(--border)] flex items-center gap-2">
                    <Building2 size={16} className="text-[color:var(--primary)]" />
                    <p className="text-[12px] font-semibold text-main uppercase tracking-widest">Custos do Inventário</p>
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
                            <div className="flex items-center gap-2 px-3 h-[36px] bg-surface-2 border border-subtle rounded-lg">
                                <span className="text-[14px] font-bold text-[color:var(--warning)]">{percEfetivoTotal.toFixed(1)}%</span>
                                <span className="text-[11px] font-semibold text-[color:var(--warning)]">sobre os bens</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-faint mt-3 font-medium">
                        Se os campos acima não forem preenchidos, o sistema usará o custo padrão de {parametros.perc_custos_inventario}% configurado nos parâmetros globais.
                    </p>
                </div>
            </div>

            {/* Tabela de itens */}
            <div className="rounded-[12px] border border-[color:var(--border)] overflow-hidden shadow-[var(--shadow-card)] bg-surface">
                <div className="grid grid-cols-[1fr_140px_140px_140px] gap-3 px-5 py-3.5 bg-surface-2 border-b border-[color:var(--border)]">
                    <span className="text-[11px] font-bold text-[color:var(--text-muted)] uppercase tracking-widest">Item</span>
                    <span className="text-[11px] font-bold text-[color:var(--primary)] uppercase tracking-widest text-center">Cliente</span>
                    <span className="text-[11px] font-bold text-[color:var(--primary)] uppercase tracking-widest text-center">Cônjuge</span>
                    <span className="text-[11px] font-bold text-[color:var(--text-muted)] uppercase tracking-widest text-center">Família</span>
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
                <div className="p-5 bg-surface shadow-sm border border-[color:var(--border)] rounded-[12px]">
                    <p className="text-[11px] font-bold text-[color:var(--text-muted)] uppercase tracking-widest mb-2">Total de Necessidades</p>
                    <p className="text-[22px] font-bold text-main">{fmtMoeda(resultado.totalNecessidades)}</p>
                    <p className="text-[11px] font-medium text-[color:var(--text-muted)] mt-1">Funeral + Inventário + Dívidas</p>
                </div>
                <div className="p-5 bg-[color:var(--primary-soft)] border border-subtle shadow-sm rounded-[12px]">
                    <p className="text-[11px] font-bold text-[color:var(--primary)] uppercase tracking-widest mb-2">Ativos Previdenciários Disponíveis</p>
                    <p className="text-[22px] font-bold text-[color:var(--primary)]">{fmtMoeda(resultado.ativosPrevidenciarios)}</p>
                    <p className="text-[11px] font-medium text-[color:var(--primary)] mt-1">PGBL + VGBL (isento de inventário)</p>
                </div>
                <div className="p-5 bg-[color:var(--danger)] rounded-[12px] text-white shadow-sm">
                    <p className="text-[11px] font-bold text-white/70 uppercase tracking-widest mb-2">Cobertura Necessária — Sucessão</p>
                    <p className="text-[22px] font-bold tracking-tight">{fmtMoeda(resultado.coberturaSucessao)}</p>
                    <p className="text-[11px] font-medium text-white/70 mt-1">Necessidades − Ativos previdenciários</p>
                </div>
            </div>
        </div>
    );
};

export default EtapaSucessao;
