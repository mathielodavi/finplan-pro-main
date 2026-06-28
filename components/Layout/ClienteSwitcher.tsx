import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClienteContext } from '../../context/ClienteContext';
import { Search, ChevronsUpDown, Check, Clock, Users } from 'lucide-react';

/**
 * Seletor global de cliente para o header. Permite buscar e transitar entre
 * clientes sem voltar à lista. Visível em telas client-scoped (DESIGN.MD §8).
 */
const ClienteSwitcher: React.FC = () => {
  const navigate = useNavigate();
  const { clientes, clienteAtivo, recentes } = useClienteContext();
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setTermo('');
  }, [open]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const filtrados = useMemo(() => {
    const t = termo.toLowerCase().trim();
    const base = t ? clientes.filter(c => c.nome.toLowerCase().includes(t)) : clientes;
    return base.slice(0, 50);
  }, [clientes, termo]);

  const recentesResolvidos = useMemo(() => {
    if (termo.trim()) return [];
    return recentes
      .map(id => clientes.find(c => c.id === id))
      .filter(Boolean)
      .slice(0, 4) as typeof clientes;
  }, [recentes, clientes, termo]);

  const selecionar = (id?: string) => {
    if (!id) return;
    setOpen(false);
    navigate(`/clientes/${id}`);
  };

  const Linha = ({ c }: { c: any }) => (
    <button
      onClick={() => selecionar(c.id)}
      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-surface-3 group"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-7 w-7 rounded-full bg-surface-3 border border-subtle flex items-center justify-center text-[11px] font-bold text-muted shrink-0">
          {c.nome.charAt(0).toUpperCase()}
        </div>
        <span className="text-[13px] font-medium text-main truncate">{c.nome}</span>
      </div>
      {clienteAtivo?.id === c.id && <Check size={14} className="text-primary shrink-0" />}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-lg border border-subtle bg-surface-2 hover:border-strong transition-colors min-w-[180px] max-w-[260px]"
      >
        <Users size={14} className="text-faint shrink-0" />
        <span className="text-[13px] font-medium text-main truncate flex-1 text-left">
          {clienteAtivo?.nome || 'Selecionar cliente'}
        </span>
        <ChevronsUpDown size={14} className="text-faint shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[320px] rounded-xl border border-subtle bg-surface shadow-[var(--shadow-float)] z-50 overflow-hidden animate-fade-in">
          <div className="p-2 border-b border-subtle">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-faint" />
              <input
                ref={inputRef}
                value={termo}
                onChange={e => setTermo(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full h-9 pl-8 pr-3 bg-surface-2 border border-subtle rounded-lg text-[13px] text-main placeholder:text-faint outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto p-1.5">
            {recentesResolvidos.length > 0 && (
              <>
                <p className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  <Clock size={11} /> Recentes
                </p>
                {recentesResolvidos.map(c => <Linha key={`r-${c.id}`} c={c} />)}
                <div className="h-px bg-subtle my-1.5 mx-2" />
              </>
            )}

            {filtrados.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-faint">Nenhum cliente encontrado</p>
            ) : (
              filtrados.map(c => <Linha key={c.id} c={c} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClienteSwitcher;
