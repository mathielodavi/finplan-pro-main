import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Largura máxima do drawer. Padrão: max-w-md. */
  widthClass?: string;
  /** 'transparent' remove o blur/escurecimento do overlay — útil quando o conteúdo atrás
   *  do drawer precisa continuar visível (ex.: simulação ao vivo de um gráfico). */
  overlay?: 'default' | 'transparent';
  /** Rodapé fixo de ações (botões). Opcional. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Drawer lateral reutilizável (desliza da direita), extraído do padrão usado em
 * components/Dividas/PanelDetalheCredito.tsx. Inclui overlay com blur, header com
 * título + botão fechar, corpo scrollável e rodapé opcional de ações.
 */
const SidePanel: React.FC<SidePanelProps> = ({ open, onClose, title, subtitle, widthClass = 'max-w-md', overlay = 'default', footer, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) {
      document.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[9998] transition-opacity animate-fade-in ${overlay === 'transparent' ? 'bg-transparent' : 'bg-surface-3/40 backdrop-blur-sm'}`}
        onClick={onClose}
      />
      <div className={`fixed inset-y-0 right-0 w-full ${widthClass} bg-surface shadow-2xl z-[9999] transform transition-transform animate-slide-left flex flex-col border-l border-subtle`}>
        <div className="px-6 py-4 border-b border-subtle flex justify-between items-center bg-surface-2 shrink-0">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-main tracking-tight truncate">{title}</h2>
            {subtitle && <p className="text-[11px] font-medium text-muted mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center text-faint hover:text-main hover:bg-surface-3 active:bg-surface-3 rounded-full transition-colors shrink-0"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 border-t border-subtle bg-surface-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  );
};

export default SidePanel;
