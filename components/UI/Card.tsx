import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

const Card: React.FC<CardProps> = ({ children, title, subtitle, actions, className = '', noPadding }) => {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-[0_2px_4px_rgba(0,0,0,0.02)] overflow-hidden transition-all hover:shadow-[0_8px_16px_rgba(0,0,0,0.04)] ${className}`}>
      {(title || actions) || subtitle ? (
        <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between gap-4">
          <div className="min-w-0">
            {title && <h3 className="font-bold text-slate-900 text-sm tracking-tight truncate">{title}</h3>}
            {subtitle && <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5 tracking-tight truncate">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
        </div>
      ) : null}
      <div className={`${noPadding ? '' : 'p-8'} relative`}>
        {children}
      </div>
    </div>
  );
};

export default Card;