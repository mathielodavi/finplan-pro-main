
import React from 'react';
import { mascaraMoeda, parseMoeda } from '../../utils/calculosFinanceiros';

interface CampoMonetarioProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    tooltip?: string;
    required?: boolean;
}

const CampoMonetario: React.FC<CampoMonetarioProps> = ({
    label,
    value,
    onChange,
    placeholder = '0,00',
    disabled = false,
    className = '',
    required = false,
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(parseMoeda(e.target.value));
    };

    const formattedValue = value > 0 ? mascaraMoeda(String(Math.round(value * 100))) : '';

    return (
        <div className={className}>
            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1.5">
                {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
            </label>
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 pointer-events-none">
                    R$
                </span>
                <input
                    type="text"
                    value={formattedValue}
                    onChange={handleChange}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={`w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-600 transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
            </div>
        </div>
    );
};

export default CampoMonetario;
