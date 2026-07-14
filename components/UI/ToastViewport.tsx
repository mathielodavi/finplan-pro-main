import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { toast, ToastItem, ToastTipo } from '../../utils/toast';

const ESTILO: Record<ToastTipo, { icon: React.ReactNode; cor: string }> = {
  success: { icon: <CheckCircle2 size={16} />, cor: 'var(--primary)' },
  error: { icon: <AlertCircle size={16} />, cor: 'var(--danger)' },
  info: { icon: <Info size={16} />, cor: 'var(--info)' },
};

/** Único assinante do singleton `toast` — monta uma vez em App.tsx, visível em toda rota. */
const ToastViewport: React.FC = () => {
  const [itens, setItens] = useState<ToastItem[]>([]);

  useEffect(() => toast.subscribe(setItens), []);

  if (itens.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[999999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {itens.map(item => {
        const { icon, cor } = ESTILO[item.tipo];
        return (
          <div
            key={item.id}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] animate-fade-in"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <div className="shrink-0 mt-0.5" style={{ color: cor }}>{icon}</div>
            <p className="flex-1 text-[12px] font-medium leading-relaxed" style={{ color: 'var(--text-main)' }}>{item.mensagem}</p>
            <button
              onClick={() => toast.dismiss(item.id)}
              className="shrink-0 p-0.5 rounded-md transition-colors hover:opacity-70"
              style={{ color: 'var(--text-faint)' }}
              title="Fechar"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
};

export default ToastViewport;
