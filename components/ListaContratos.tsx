
import React, { useState } from 'react';
import { Contrato, ContratoTipo } from '../types/contrato';
import { formatarMoeda, formatarData } from '../utils/formatadores';

interface ListaContratosProps {
  contratos: Contrato[];
  onEdit: (contrato: Contrato) => void;
  onDelete: (contrato: Contrato) => void;
}

const ListaContratos: React.FC<ListaContratosProps> = ({ contratos, onEdit, onDelete }) => {
  const [filtro, setFiltro] = useState<ContratoTipo | 'todos'>('todos');

  const contratosFiltrados = filtro === 'todos' 
    ? contratos 
    : contratos.filter(c => c.tipo === filtro);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button 
          onClick={() => setFiltro('todos')}
          className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${filtro === 'todos' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          Todos
        </button>
        <button 
          onClick={() => setFiltro('planejamento')}
          className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${filtro === 'planejamento' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          Planejamento
        </button>
        <button 
          onClick={() => setFiltro('extra')}
          className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all ${filtro === 'extra' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          Extras
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {contratosFiltrados.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum contrato encontrado</p>
          </div>
        ) : (
          contratosFiltrados.map((contrato) => (
            <div key={contrato.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${contrato.tipo === 'planejamento' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                    {contrato.tipo}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${contrato.status === 'ativo' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {contrato.status}
                  </span>
                </div>
                <h4 className="font-bold text-slate-800 line-clamp-1">{contrato.descricao || 'Sem descrição'}</h4>
                <div className="flex gap-4 text-[11px] text-slate-400 font-medium">
                  <span>Início: {formatarData(contrato.data_inicio)}</span>
                  {contrato.data_fim && <span>Fim: {formatarData(contrato.data_fim)}</span>}
                </div>
              </div>
              
              <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase block leading-none">Valor</span>
                  <span className="text-lg font-black text-slate-900">{formatarMoeda(contrato.valor)}</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onEdit(contrato)}
                    className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => onDelete(contrato)}
                    className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ListaContratos;
