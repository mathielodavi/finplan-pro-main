import React from 'react';
import { Search } from 'lucide-react';
import SidePanel from './SidePanel';

export const segBtnConsulta = (active: boolean) =>
  `flex-1 h-8 px-2.5 flex items-center justify-center rounded-md text-[11px] font-semibold transition-all ${active ? 'bg-surface-3 text-primary' : 'text-faint hover:text-muted active:bg-surface-3/60'}`;

interface Props {
  open: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo: string;
  termo: string;
  onTermo: (termo: string) => void;
  placeholder: string;
  /** Seletor segmentado abaixo da busca (ordem, grupo...). */
  opcoes?: { id: string; label: string }[];
  opcaoAtiva?: string;
  onOpcao?: (id: string) => void;
  children: React.ReactNode;
}

/** Estrutura comum das consultas por cliente da Visão Geral: drawer, busca e seletor. */
const PainelConsulta: React.FC<Props> = ({ open, onClose, titulo, subtitulo, termo, onTermo, placeholder, opcoes, opcaoAtiva, onOpcao, children }) => (
  <SidePanel open={open} onClose={onClose} title={titulo} subtitle={subtitulo} widthClass="max-w-lg">
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint pointer-events-none" />
        <input
          type="text"
          value={termo}
          onChange={e => onTermo(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 h-10 bg-surface-2 border border-subtle rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-[13px] text-main placeholder:text-faint"
        />
      </div>

      {opcoes && (
        <div className="flex bg-surface-2 p-0.5 rounded-lg border border-subtle">
          {opcoes.map(o => (
            <button key={o.id} type="button" onClick={() => onOpcao?.(o.id)} className={segBtnConsulta(opcaoAtiva === o.id)}>{o.label}</button>
          ))}
        </div>
      )}

      {children}
    </div>
  </SidePanel>
);

export const CarregandoConsulta: React.FC<{ texto: string }> = ({ texto }) => (
  <div className="py-16 flex flex-col items-center justify-center gap-3">
    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[color:var(--primary)]" />
    <p className="text-faint text-[11px] font-bold uppercase tracking-widest">{texto}</p>
  </div>
);

export const VazioConsulta: React.FC<{ texto: string }> = ({ texto }) => (
  <div className="py-16 text-center">
    <p className="text-faint text-[12px]">{texto}</p>
  </div>
);

export default PainelConsulta;
