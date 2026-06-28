import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

interface AlertProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
}

const Alert: React.FC<AlertProps> = ({ type = 'info', title, message, onClose }) => {
  const styles = {
    success: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', icon: <CheckCircle2 size={18} /> },
    error: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', icon: <AlertCircle size={18} /> },
    warning: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', icon: <AlertCircle size={18} /> },
    info: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', icon: <Info size={18} /> }
  };

  return (
    <div className={`${styles[type].bg} ${styles[type].border} border p-4 rounded-2xl flex items-start gap-3 animate-slide-up shadow-sm`}>
      <div className={`${styles[type].text} mt-0.5`}>{styles[type].icon}</div>
      <div className="flex-1 min-w-0">
        {title && <h4 className={`${styles[type].text} font-black text-[10px] uppercase tracking-widest mb-1`}>{title}</h4>}
        <p className={`${styles[type].text} text-xs font-semibold leading-relaxed`}>{message}</p>
      </div>
      {onClose && (
        <button onClick={onClose} className={`${styles[type].text} hover:opacity-60 transition-opacity`}>
          <X size={16} strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

export default Alert;