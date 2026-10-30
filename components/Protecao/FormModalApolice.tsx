import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import Modal from '../Modal';

export const inpApolice = "w-full px-3 h-9 bg-surface-2 border border-subtle rounded-[8px] font-bold text-main text-[12px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-surface focus:border-[color:var(--primary)] transition-all shadow-sm";
export const lblApolice = "block text-[10px] font-bold text-faint uppercase tracking-wider mb-1.5";

interface Props {
    titulo: string;
    erro: string | null;
    salvando: boolean;
    onCancelar: () => void;
    onSalvar: () => void;
    children: React.ReactNode;
}

/** Moldura dos formulários de apólice: modal, aviso de erro e botões. */
const FormModalApolice: React.FC<Props> = ({ titulo, erro, salvando, onCancelar, onSalvar, children }) => (
    <Modal isOpen onClose={onCancelar} title={titulo} size="md">
        <div className="space-y-5">
            {children}

            {erro && (
                <div className="px-3 py-2 rounded-lg bg-[rgba(248,113,113,0.12)] border border-[rgba(248,113,113,0.25)] text-[color:var(--danger)] text-[11px] font-semibold">
                    {erro}
                </div>
            )}

            <div className="flex gap-2 pt-2">
                <button onClick={onCancelar} disabled={salvando} className="flex-1 h-9 rounded-[8px] border border-subtle text-muted font-bold text-[10px] uppercase tracking-wider hover:bg-surface-2 shadow-sm disabled:opacity-50">Cancelar</button>
                <button onClick={onSalvar} disabled={salvando} className="flex-1 h-9 rounded-[8px] bg-[color:var(--primary)] text-white font-bold text-[10px] uppercase tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:opacity-90 flex items-center justify-center gap-1.5 disabled:opacity-60">
                    {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    {salvando ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </div>
    </Modal>
);

export default FormModalApolice;
