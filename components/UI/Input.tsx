import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  as?: 'input' | 'select' | 'textarea';
}

const Input: React.FC<InputProps> = ({ label, error, helperText, as = 'input', className = '', ...props }) => {
  const Component = as;
  
  return (
    <div className="w-full space-y-2">
      {label && (
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
          {label}
        </label>
      )}
      <Component
        className={`
          w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl
          font-bold text-slate-700 placeholder:text-slate-400 placeholder:font-medium
          transition-all outline-none text-sm
          focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600
          disabled:bg-slate-100 disabled:cursor-not-allowed
          ${error ? 'border-rose-500 focus:ring-rose-500/10 focus:border-rose-500' : ''}
          ${className}
        `}
        {...(props as any)}
      />
      {error ? (
        <p className="text-[9px] font-black text-rose-500 ml-1 uppercase tracking-wider animate-slide-up">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-[9px] font-bold text-slate-400 ml-1 uppercase tracking-tight">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};

export default Input;