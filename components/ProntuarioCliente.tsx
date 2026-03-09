
import React, { useState } from 'react';
import { Cliente } from '../services/clienteService';
import { formatarMoeda, formatarData } from '../utils/formatadores';

interface ProntuarioClienteProps {
  cliente: Cliente;
  onEdit: () => void;
  onBack: () => void;
}

const ProntuarioCliente: React.FC<ProntuarioClienteProps> = ({ cliente, onEdit, onBack }) => {
  const [activeTab, setActiveTab] = useState('resumo');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
           <button onClick={onBack} className="text-xs font-black text-blue-600 uppercase tracking-widest mb-1 hover:underline flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Voltar para Lista
           </button>
           <h1 className="text-3xl font-black text-slate-900 tracking-tight">{cliente.nome}</h1>
           <p className="text-slate-500 text-sm">Prontuário consolidado do cliente</p>
        </div>
        <div className="flex gap-2">
           <button 
            onClick={onEdit}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
           >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Editar Dados
           </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patrimônio Total</span>
           <p className="text-2xl font-black text-slate-900 mt-1">{formatarMoeda(cliente.patrimonio_total)}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aporte Mensal</span>
           <p className="text-2xl font-black text-blue-600 mt-1">{formatarMoeda(cliente.aporte_mensal)}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Última Importação</span>
           <p className="text-2xl font-black text-slate-900 mt-1">{formatarData(cliente.data_ultima_importacao)}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
         <div className="flex border-b border-slate-100 overflow-x-auto bg-slate-50/50">
            {['resumo', 'contratos', 'investimentos', 'reuniões'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                  activeTab === tab 
                  ? 'border-blue-600 text-blue-600 bg-white' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
         </div>
         <div className="p-8">
            {activeTab === 'resumo' && (
              <div className="space-y-4">
                 <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">Status do Planejamento</h3>
                 <p className="text-slate-500 text-sm leading-relaxed">
                   Os dados básicos do cliente indicam um patrimônio de {formatarMoeda(cliente.patrimonio_total)} com capacidade de investimento mensal de {formatarMoeda(cliente.aporte_mensal)}.
                 </p>
                 <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                    <p className="text-blue-700 text-xs font-bold uppercase tracking-widest mb-2">Informações Adicionais</p>
                    <ul className="text-sm text-blue-900 space-y-1 font-medium">
                       <li>• Criado em: {formatarData(cliente.criado_em)}</li>
                       <li>• ID Interno: {cliente.id}</li>
                    </ul>
                 </div>
              </div>
            )}
            {activeTab !== 'resumo' && (
              <div className="py-20 text-center space-y-4">
                 <div className="h-16 w-16 bg-slate-50 rounded-full inline-flex items-center justify-center text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                 </div>
                 <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Módulo em Desenvolvimento</p>
                 <p className="text-slate-400 text-xs">Esta funcionalidade estará disponível nas próximas fases do projeto.</p>
              </div>
            )}
         </div>
      </div>
    </div>
  );
};

export default ProntuarioCliente;
