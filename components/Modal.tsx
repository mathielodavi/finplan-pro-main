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
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'wide';
}

// DESIGN.MD §7: Largura máxima controlada, padding 24px, botão X discreto,
// sem backdrop-blur excessivo, border-radius 12-16px
const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  headerActions,
  children,
  size = 'lg',
}) => {
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

  // DESIGN.MD §7: max-w-lg ou max-w-2xl para tarefas simples
  const sizeMap: Record<string, string> = {
    sm:   'max-w-sm',
    md:   'max-w-lg',
    lg:   'max-w-2xl',
    xl:   'max-w-4xl',
    wide: 'max-w-6xl',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div
        className={`w-full ${sizeMap[size]} flex flex-col overflow-hidden animate-fade-in`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          border: '1px solid var(--border)',
          maxHeight: '90vh',
        }}
      >
        {/* Header — DESIGN.MD §7: padding 24px, título 16px semi-bold, X discreto */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold truncate"
              style={{
                fontSize: '16px',
                color: 'var(--text-main)',
                lineHeight: 1.3,
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <div
                className="mt-1"
                style={{ fontSize: '12px', color: 'var(--text-muted)' }}
              >
                {subtitle}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-4 shrink-0">
            {headerActions && (
              <div className="flex items-center gap-2">{headerActions}</div>
            )}
            {/* DESIGN.MD §7: botão X discreto no canto superior direito. Hover/active via classes
                Tailwind (auto-seguras em touch) em vez de onMouseEnter/onMouseLeave — ver nota
                equivalente em components/Layout/Sidebar.tsx. Alvo de 40px (era 32px). */}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-transparent text-muted bg-transparent cursor-pointer transition-colors duration-150 hover:bg-[var(--border-light)] hover:text-[color:var(--danger)] active:bg-[var(--border-light)] active:text-[color:var(--danger)]"
              title="Fechar"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body — DESIGN.MD §7: padding 24px */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: '24px' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;