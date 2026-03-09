
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Cliente, obterClientes as fetchClientes, buscarClientes as searchClientes } from '../services/clienteService';

interface ClienteContextType {
  clientes: Cliente[];
  loading: boolean;
  error: string | null;
  refreshClientes: () => Promise<void>;
  pesquisar: (termo: string) => Promise<void>;
}

const ClienteContext = createContext<ClienteContextType | undefined>(undefined);

export const ClienteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <ClienteContext.Provider value={{ clientes, loading, error, refreshClientes, pesquisar }}>
      {children}
    </ClienteContext.Provider>
  );
};

export const useClienteContext = () => {
  const context = useContext(ClienteContext);
  if (!context) throw new Error('useClienteContext deve ser usado dentro de um ClienteProvider');
  return context;
};
