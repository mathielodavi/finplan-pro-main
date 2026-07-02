
import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmacaoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
  /** Ação destrutiva/irreversível (padrão true): mostra aviso e botão vermelho. */
  danger?: boolean;
  /** Rótulo do botão de confirmação (padrão "Confirmar"). */
  confirmLabel?: string;
}

const Confirmacao: React.FC<ConfirmacaoProps> = ({
  isOpen, onClose, onConfirm, title, message, loading, danger = true, confirmLabel = 'Confirmar',
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-5">
        <p className="text-[13px] text-muted">{message}</p>
        {danger && (
          <div className="flex items-center gap-2 bg-surface-2 border border-subtle rounded-lg px-3 py-2.5 text-[11px] font-medium text-[color:var(--danger)]">
            <AlertTriangle size={14} className="shrink-0" />
            Esta ação não pode ser desfeita.
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-9 rounded-lg font-semibold text-[12px] transition-all flex items-center justify-center disabled:opacity-50"
            style={{ backgroundColor: danger ? 'var(--danger)' : 'var(--primary)', color: danger ? '#fff' : '#0b0e14' }}
          >
            {loading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default Confirmacao;
