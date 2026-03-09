import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl' | 'wide';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, subtitle, headerActions, children, size = 'wide' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    wide: 'max-w-6xl'
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-10 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div 
        className={`bg-white rounded-3xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.3)] w-full ${sizeClasses[size]} flex flex-col overflow-hidden border border-slate-100 animate-slide-up max-h-[90vh]`}
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-50 shrink-0">
          <div className="flex-1">
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">{title}</h3>
            {subtitle ? (
              <div className="mt-2">{subtitle}</div>
            ) : (
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2">Parâmetro Estratégico Tulipa</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
            <button 
              onClick={onClose}
              className="p-2.5 hover:bg-slate-50 rounded-xl transition-all text-slate-300 hover:text-rose-500 group border border-transparent hover:border-slate-100"
            >
              <X size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-white">
          <div className="animate-fade-in delay-100">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;