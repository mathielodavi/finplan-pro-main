import React from 'react';

interface InputPercentualProps {
    label?: string;
    value: number | undefined;
    onChange: (valor: number) => void;
    placeholder?: string;
    helperText?: string;
    className?: string;
    casas?: number;
}

/** Input percentual (0,00%) com sufixo visual fixo — mesmo campo numérico decimal, apresentado de forma consistente. */
const InputPercentual: React.FC<InputPercentualProps> = ({ label, value, onChange, placeholder, helperText, className = '', casas = 2 }) => {
    return (
        <div className="w-full">
            {label && <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">{label}</label>}
            <div className="relative">
                <input
                    type="number"
                    step={Math.pow(10, -casas)}
                    min={0}
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                    placeholder={placeholder}
                    className={`w-full bg-surface-2 border border-subtle text-main text-[12px] font-bold rounded-[8px] pl-3 pr-7 h-9 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${className}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-faint pointer-events-none">%</span>
            </div>
            {helperText && <p className="text-[9px] text-faint mt-1">{helperText}</p>}
        </div>
    );
};

export default InputPercentual;
