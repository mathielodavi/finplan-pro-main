import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'emerald' | 'navy';
  size?: 'sm' | 'md';
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', size = 'md' }) => {
  const variants = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    info: "bg-sky-50 text-sky-600 border-sky-100",
    warning: "bg-amber-50 text-amber-600 border-amber-100",
    danger: "bg-rose-50 text-rose-600 border-rose-100",
    neutral: "bg-slate-50 text-slate-500 border-slate-200",
    navy: "bg-slate-900 text-white border-slate-800"
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[8px]",
    md: "px-2.5 py-1 text-[10px]"
  };

  return (
    <span className={`
      inline-flex items-center font-bold tracking-tight border rounded-lg whitespace-nowrap
      ${variants[variant]} ${sizes[size]}
    `}>
      {children}
    </span>
  );
};

export default Badge;