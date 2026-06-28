
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Cliente, obterClientes as fetchClientes, buscarClientes as searchClientes, verificarExpiracaoContratos } from '../services/clienteService';

/** Resumo leve do cliente ativo, usado pelo header (breadcrumb + seletor). */
export interface ClienteAtivo {
  id: string;
  nome: string;
  status?: string;
}

interface ClienteContextType {
  clientes: Cliente[];
  loading: boolean;
  error: string | null;
  refreshClientes: () => Promise<void>;
  pesquisar: (termo: string) => Promise<void>;
  /** Cliente atualmente em foco (prontuário). Alimenta o header. */
  clienteAtivo: ClienteAtivo | null;
  setClienteAtivo: (cliente: ClienteAtivo | null) => void;
  /** IDs visitados recentemente (mais recente primeiro). */
  recentes: string[];
}

const ClienteContext = createContext<ClienteContextType | undefined>(undefined);

const RECENTES_KEY = 'tulipa_clientes_recentes';

export const ClienteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clienteAtivo, setClienteAtivoState] = useState<ClienteAtivo | null>(null);
  const [recentes, setRecentes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENTES_KEY) || '[]'); } catch { return []; }
  });

  const refreshClientes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchClientes();
      setClientes(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Automação de status por vigência + carga inicial da lista (para o seletor do header)
    verificarExpiracaoContratos().catch(console.error);
    refreshClientes().catch(console.error);
  }, [refreshClientes]);

  const setClienteAtivo = useCallback((cliente: ClienteAtivo | null) => {
    setClienteAtivoState(cliente);
    if (cliente?.id) {
      setRecentes(prev => {
        const next = [cliente.id, ...prev.filter(id => id !== cliente.id)].slice(0, 8);
        try { localStorage.setItem(RECENTES_KEY, JSON.stringify(next)); } catch { /* noop */ }
        return next;
      });
    }
  }, []);

  const pesquisar = useCallback(async (termo: string) => {
    try {
      setLoading(true);
      if (!termo.trim()) {
        await refreshClientes();
        return;
      }
      const data = await searchClientes(termo);
      setClientes(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [refreshClientes]);

  return (
    <ClienteContext.Provider value={{ clientes, loading, error, refreshClientes, pesquisar, clienteAtivo, setClienteAtivo, recentes }}>
      {children}
    </ClienteContext.Provider>
  );
};

export const useClienteContext = () => {
  const context = useContext(ClienteContext);
  if (!context) throw new Error('useClienteContext deve ser usado dentro de um ClienteProvider');
  return context;
};
