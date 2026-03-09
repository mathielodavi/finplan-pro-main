
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { investimentoService } from '../../services/investimentoService';
import { obterClientePorId, Cliente } from '../../services/clienteService';
import ResumoInvestimentos from '../Investimentos/ResumoInvestimentos';
import ProjetosInvestimentos from '../Investimentos/ProjetosInvestimentos';
import IndependenciaInvestimentos from '../Investimentos/IndependenciaInvestimentos';
import CarteiraInvestimentos from '../Investimentos/CarteiraInvestimentos';
import RebalanceamentoInvestimentos from '../Investimentos/RebalanceamentoInvestimentos';
import { PieChart, Target, Bird, Briefcase, RefreshCw } from 'lucide-react';

interface AbaInvestimentosProps {
  clienteId: string;
}

const AbaInvestimentos: React.FC<AbaInvestimentosProps> = ({ clienteId }) => {
  const [activeSub, setActiveSub] = useState('resumo');
  const [ativos, setAtivos] = useState<any[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [atData, cliData] = await Promise.all([
        investimentoService.getAtivos(clienteId),
        obterClientePorId(clienteId)
      ]);
      setAtivos(atData || []);
      setCliente(cliData);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => { loadData(); }, [loadData]);

  const patrimonioTotal = ativos.reduce((acc, cur) => acc + (cur.valor_atual || 0), 0);

  // Cálculo específico do patrimônio alocado em Independência para passar ao componente
  const patrimonioIndependencia = useMemo(() => {
    return ativos.reduce((acc, a) => {
      const linkIndep = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'independencia');
      const perc = linkIndep ? (linkIndep.percentual / 100) : 0;
      return acc + (a.valor_atual * perc);
    }, 0);
  }, [ativos]);

  const menu = [
    { id: 'resumo', label: 'Resumo Geral', icon: <PieChart size={14} /> },
    { id: 'projetos', label: 'Objetivos', icon: <Target size={14} /> },
    { id: 'independencia', label: 'Independência', icon: <Bird size={14} /> },
    { id: 'carteira', label: 'Carteira Ativa', icon: <Briefcase size={14} /> },
    { id: 'rebalanceamento', label: 'Aporte Mensal', icon: <RefreshCw size={14} /> },
  ];

  if (loading && ativos.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-6">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        <p className="text-slate-300 font-bold uppercase tracking-[0.2em] text-[10px]">Analizando Carteira...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shadow-inner w-full flex-wrap gap-1">
        {menu.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSub(item.id)}
            className={`px-4 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center transition-all whitespace-nowrap group relative ${activeSub === item.id
                ? 'bg-white text-emerald-600 shadow-md border border-slate-100'
                : 'text-slate-400 hover:text-slate-600 hover:bg-white/60 border border-transparent'
              }`}
          >
            <span className={`${activeSub === item.id ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'} transition-opacity`}>{item.icon}</span>
            <span className={`overflow-hidden transition-all duration-300 flex items-center ${activeSub === item.id ? 'max-w-xs opacity-100 ml-3' : 'max-w-0 opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-3'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-[500px] animate-slide-up">
        {activeSub === 'resumo' && <ResumoInvestimentos ativos={ativos} cliente={cliente} onRefresh={loadData} />}
        {activeSub === 'projetos' && <ProjetosInvestimentos clienteId={clienteId} ativos={ativos} />}
        {activeSub === 'independencia' && <IndependenciaInvestimentos clienteId={clienteId} patrimonioAtual={patrimonioIndependencia} />}
        {activeSub === 'carteira' && <CarteiraInvestimentos clienteId={clienteId} cliente={cliente} ativos={ativos} onRefresh={loadData} />}
        {activeSub === 'rebalanceamento' && <RebalanceamentoInvestimentos clienteId={clienteId} ativos={ativos} onFinish={() => { setActiveSub('resumo'); loadData(); }} />}
      </div>
    </div>
  );
};

export default AbaInvestimentos;
