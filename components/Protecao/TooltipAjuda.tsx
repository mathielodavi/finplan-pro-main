
import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipAjudaProps {
    texto: string;
    className?: string;
}

const TooltipAjuda: React.FC<TooltipAjudaProps> = ({ texto, className = '' }) => {
    const [aberto, setAberto] = useState(false);

    return (
        <span className={`relative inline-flex items-center ${className}`}>
            <button
                type="button"
                onMouseEnter={() => setAberto(true)}
                onMouseLeave={() => setAberto(false)}
                onFocus={() => setAberto(true)}
                onBlur={() => setAberto(false)}
                onClick={() => setAberto(v => !v)}
                className="text-slate-300 hover:text-emerald-500 transition-colors"
                aria-label="Ajuda"
            >
                <HelpCircle size={13} />
            </button>
            {aberto && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 px-3 py-2 bg-slate-800 text-white text-[10px] font-medium rounded-xl shadow-xl leading-relaxed">
                    {texto}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                </span>
            )}
        </span>
    );
};

export default TooltipAjuda;
