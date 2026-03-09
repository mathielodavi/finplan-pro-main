
import React from 'react';

interface CampoCalculadoProps {
    label: string;
    value: string | number;
    formatarMoeda?: boolean;
    highlight?: boolean;
    className?: string;
}

const CampoCalculado: React.FC<CampoCalculadoProps> = ({
    label,
    value,
    formatarMoeda = false,
    highlight = false,
    className = '',
}) => {
    const displayValue = formatarMoeda
        ? `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : String(value);

    return (
        <div className={className}>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">
                {label}
                <span className="ml-1.5 text-slate-300 font-medium normal-case tracking-normal">· calculado automaticamente</span>
            </label>
            <div
                className={`w-full px-4 py-2.5 border border-dashed rounded-xl font-bold text-sm select-none ${highlight
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-700'
                    : 'bg-slate-100/60 border-slate-200 text-slate-600'
                    }`}
            >
                {displayValue}
            </div>
        </div>
    );
};

export default CampoCalculado;
