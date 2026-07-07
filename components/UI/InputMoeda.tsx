import React from 'react';

interface InputMoedaProps {
    label?: string;
    value: number | undefined;
    onChange: (valor: number) => void;
    placeholder?: string;
    helperText?: string;
    className?: string;
    disabled?: boolean;
}

/** Input monetário mascarado (R$ 1.234,56) — mesmo padrão de digitação em centavos usado em ResumoInvestimentos.tsx. */
const InputMoeda: React.FC<InputMoedaProps> = ({ label, value, onChange, placeholder, helperText, className = '', disabled }) => {
    const display = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value || 0);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const digits = e.target.value.replace(/\D/g, '');
        onChange(digits ? parseInt(digits, 10) / 100 : 0);
    };

    return (
        <div className="w-full">
            {label && <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">{label}</label>}
            <input
                type="text"
                inputMode="numeric"
                disabled={disabled}
                value={display}
                onChange={handleChange}
                placeholder={placeholder}
                className={`w-full bg-surface-2 border border-subtle text-main text-[12px] font-bold rounded-[8px] px-3 h-9 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-60 ${className}`}
            />
            {helperText && <p className="text-[9px] text-faint mt-1">{helperText}</p>}
        </div>
    );
};

export default InputMoeda;
