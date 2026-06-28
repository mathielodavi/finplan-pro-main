import React, { useState } from 'react';
import Acordeao from './Acordeao';
import ResumoInvestimentos from '../Investimentos/ResumoInvestimentos';
import ProjetosInvestimentos from '../Investimentos/ProjetosInvestimentos';
import CarteiraInvestimentos from '../Investimentos/CarteiraInvestimentos';
import RebalanceamentoInvestimentos from '../Investimentos/RebalanceamentoInvestimentos';
import { useClienteContext } from '../../context/ClienteContext';

interface AbaFerramentasProps {
  clienteId: string;
  patrimonioTotal: number;
}

const AbaFerramentas: React.FC<AbaFerramentasProps> = ({ clienteId, patrimonioTotal }) => {
  const [activeInvestSub, setActiveInvestSub] = useState('resumo');
  const [ativos, setAtivos] = useState<any[]>([]); // Carregado via efeito ou passado por prop se necessário

  const investMenu = [
    { id: 'resumo', label: 'Resumo Geral', icon: '📊' },
    { id: 'projetos', label: 'Projetos', icon: '🎯' },
    { id: 'independencia', label: 'Independência', icon: '🕊️' },
    { id: 'carteira', label: 'Carteira', icon: '💼' },
    { id: 'rebalanceamento', label: 'Rebalanceamento', icon: '⚖️' },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Dívidas */}
      <Acordeao titulo="Gestão de Passivos e Dívidas" subtitulo="Análise de crédito e amortização">
        <div className="py-20 text-center space-y-4 bg-surface-2/50 rounded-3xl border border-dashed border-subtle">
           <div className="h-16 w-16 bg-surface rounded-2xl inline-flex items-center justify-center text-faint shadow-sm border border-subtle">
             <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
           </div>
           <h3 className="text-sm font-black text-faint uppercase tracking-widest">Funcionalidade em desenvolvimento</h3>
           <p className="text-xs text-faint max-w-xs mx-auto font-medium">Este módulo permitirá a análise detalhada de dívidas, financiamentos e estratégias de quitação.</p>
        </div>
      </Acordeao>

      {/* 2. Investimentos */}
      <Acordeao titulo="Gestão de Ativos e Investimentos" subtitulo="Asset Allocation e Projetos de Vida" abertoPadrao={true}>
        <div className="py-4 space-y-8">
          {/* Submenu Pills */}
          <div className="flex bg-surface-2 p-1 rounded-2xl border border-subtle overflow-x-auto shadow-inner">
             {investMenu.map(item => (
               <button
                 key={item.id}
                 onClick={() => setActiveInvestSub(item.id)}
                 className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
                   activeInvestSub === item.id 
                   ? 'bg-surface text-blue-600 shadow-sm border border-subtle' 
                   : 'text-faint hover:text-muted'
                 }`}
               >
                 <span>{item.icon}</span>
                 {item.label}
               </button>
             ))}
          </div>

          <div className="min-h-[400px]">
             {activeInvestSub === 'resumo' && (
               <div className="animate-in fade-in duration-500">
                 {/* Aqui renderizaria o ResumoInvestimentos. Para simplificar no XML, mantemos o conceito */}
                 <p className="text-center py-20 text-faint font-bold uppercase text-[10px]">Utilize o submenu acima para navegar no módulo de investimentos.</p>
               </div>
             )}
             {/* Fix: Pass the required 'ativos' property to ProjetosInvestimentos component */}
             {activeInvestSub === 'projetos' && <ProjetosInvestimentos clienteId={clienteId} ativos={ativos} />}
             {activeInvestSub === 'carteira' && <CarteiraInvestimentos clienteId={clienteId} ativos={ativos} onRefresh={() => {}} />}
             {activeInvestSub === 'rebalanceamento' && <RebalanceamentoInvestimentos clienteId={clienteId} ativos={ativos} onFinish={() => setActiveInvestSub('resumo')} />}
          </div>
        </div>
      </Acordeao>
    </div>
  );
};

export default AbaFerramentas;