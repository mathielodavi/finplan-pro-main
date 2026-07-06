
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
            <label className="block text-[9px] font-semibold text-faint uppercase tracking-widest ml-1 mb-1.5">
                {label}{required && <span className="text-[color:var(--danger)] ml-0.5">*</span>}
            </label>
            <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-faint pointer-events-none">
                    R$
                </span>
                <input
                    type="text"
                    value={formattedValue}
                    onChange={handleChange}
                    disabled={disabled}
                    placeholder={placeholder}
                    className={`w-full pl-9 pr-4 py-2.5 bg-surface border border-subtle rounded-xl font-bold text-main text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-[color:var(--primary)] transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                />
            </div>
        </div>
    );
};

export default CampoMonetario;
