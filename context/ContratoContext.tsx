
import React, { createContext, useContext, useState, useCallback } from 'react';
import { Contrato } from '../types/contrato';
import * as contratoService from '../services/contratoService';

interface ContratoContextType {
  contratos: Contrato[];
  loading: boolean;
  error: string | null;
  carregarContratos: (clienteId: string) => Promise<void>;
  salvarContrato: (dados: Partial<Contrato>) => Promise<void>;
  excluirContrato: (contrato: Contrato) => Promise<void>;
}

const ContratoContext = createContext<ContratoContextType | undefined>(undefined);

export const ContratoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const carregarContratos = useCallback(async (clienteId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await contratoService.obterContratosPorCliente(clienteId);
      setContratos(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const salvarContrato = async (dados: Partial<Contrato>) => {
    try {
      setLoading(true);
      if (dados.id) {
        await contratoService.atualizarContrato(dados.id, dados);
      } else {
        await contratoService.criarContrato(dados);
      }
      if (dados.cliente_id) await carregarContratos(dados.cliente_id);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const excluirContrato = async (contrato: Contrato) => {
    try {
      setLoading(true);
      // FIX: Pass contrato.id which is a string as expected by the service
      await contratoService.deletarContrato(contrato.id);
      await carregarContratos(contrato.cliente_id);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return (
    <ContratoContext.Provider value={{ contratos, loading, error, carregarContratos, salvarContrato, excluirContrato }}>
      {children}
    </ContratoContext.Provider>
  );
};

export const useContratoContext = () => {
  const context = useContext(ContratoContext);
  if (!context) throw new Error('useContratoContext deve ser usado dentro de um ContratoProvider');
  return context;
};