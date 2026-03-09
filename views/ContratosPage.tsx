
import React, { useState, useEffect } from 'react';
import { useClienteContext } from '../context/ClienteContext';
import { useContratoContext } from '../context/ContratoContext';
import { Cliente } from '../services/clienteService';
import { Contrato } from '../types/contrato';
import ListaContratos from '../components/ListaContratos';
import FormularioContrato from '../components/FormularioContrato';
import Modal from '../components/Modal';
import Confirmacao from '../components/Confirmacao';
import { useAuth } from '../hooks/useAuth';

const ContratosPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { clientes, refreshClientes } = useClienteContext();
  const { contratos, carregarContratos, salvarContrato, excluirContrato, loading, error } = useContratoContext();
  
  const [clienteId, setClienteId] = useState<string>('');
  const [modalAberto, setModalAberto] = useState(false);
  const [contratoEditando, setContratoEditando] = useState<Contrato | null>(null);
  const [contratoExcluindo, setContratoExcluindo] = useState<Contrato | null>(null);

  useEffect(() => {
    refreshClientes();
  }, [refreshClientes]);

  useEffect(() => {
    if (clienteId) {
      carregarContratos(clienteId);
    }
  }, [clienteId, carregarContratos]);

  const handleSalvar = async (dados: Partial<Contrato>) => {
    await salvarContrato(dados);
    setModalAberto(false);
  };

  const handleConfirmarExclusao = async () => {
    if (contratoExcluindo) {
      try {
        await excluirContrato(contratoExcluindo);
        setContratoExcluindo(null);
      } catch (err) {
        // Erro já tratado no contexto, exibido no alerta global se necessário
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black shadow-blue-200 shadow-lg cursor-pointer" onClick={() => window.location.hash = '/dashboard'}>V</div>
          <span className="text-xl font-bold tracking-tight text-slate-800">Vibe <span className="text-blue-600">Financeiro</span></span>
        </div>
        <div className="flex items-center space-x-6">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-sm font-bold text-slate-900">{user?.user_metadata?.full_name || 'Consultor'}</span>
            <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded">
              {user?.user_metadata?.role || 'CONSULTOR'}
            </span>
          </div>
          <button onClick={() => logout()} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900">Sair</button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8 space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Gestão de Contratos</h1>
            <p className="text-slate-500 font-medium">Controle os acordos de planejamento e serviços extras.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select 
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 min-w-[250px]"
            >
              <option value="">Selecione um Cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <button 
              disabled={!clienteId}
              onClick={() => { setContratoEditando(null); setModalAberto(true); }}
              className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Novo Contrato
            </button>
          </div>
        </header>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded-2xl flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {clienteId ? (
          loading && !contratos.length ? (
            <div className="py-20 text-center animate-pulse">
               <div className="h-8 w-8 bg-blue-600 rounded-full mx-auto mb-4 animate-bounce"></div>
               <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Carregando Contratos...</p>
            </div>
          ) : (
            <ListaContratos 
              contratos={contratos} 
              onEdit={(c) => { setContratoEditando(c); setModalAberto(true); }}
              onDelete={setContratoExcluindo}
            />
          )
        ) : (
          <div className="bg-white p-20 rounded-3xl border border-slate-100 text-center space-y-4">
            <div className="h-20 w-20 bg-slate-50 rounded-full inline-flex items-center justify-center text-slate-300">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
               </svg>
            </div>
            <p className="text-slate-500 font-medium">Selecione um cliente para visualizar e gerenciar seus contratos.</p>
          </div>
        )}
      </main>

      <Modal isOpen={modalAberto} onClose={() => setModalAberto(false)} title={contratoEditando ? 'Editar Contrato' : 'Novo Contrato'}>
        <FormularioContrato 
          clienteId={clienteId}
          contratoInicial={contratoEditando}
          onSuccess={handleSalvar}
          onCancel={() => setModalAberto(false)}
        />
      </Modal>

      <Confirmacao 
        isOpen={!!contratoExcluindo}
        onClose={() => setContratoExcluindo(null)}
        onConfirm={handleConfirmarExclusao}
        title="Excluir Contrato"
        message={`Tem certeza que deseja remover o contrato "${contratoExcluindo?.descricao}"?`}
        loading={loading}
      />

      <footer className="py-6 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-t border-slate-100 bg-white">
        © {new Date().getFullYear()} Vibe Financeiro - Área do Consultor
      </footer>
    </div>
  );
};

export default ContratosPage;
