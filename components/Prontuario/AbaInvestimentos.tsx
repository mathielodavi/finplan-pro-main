
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { investimentoService } from '../../services/investimentoService';
import { obterClientePorId, Cliente } from '../../services/clienteService';
import ResumoInvestimentos from '../Investimentos/ResumoInvestimentos';
import CarteiraInvestimentos from '../Investimentos/CarteiraInvestimentos';
import RebalanceamentoInvestimentos from '../Investimentos/RebalanceamentoInvestimentos';
import { useProntuarioNav } from '../../context/ProntuarioNavContext';
import { PieChart, Briefcase, RefreshCw } from 'lucide-react';

interface AbaInvestimentosProps {
  clienteId: string;
}

const menu = [
  { id: 'resumo', label: 'Resumo Geral', icon: <PieChart size={14} /> },
  { id: 'carteira', label: 'Carteira Ativa', icon: <Briefcase size={14} /> },
  { id: 'rebalanceamento', label: 'Aporte Mensal', icon: <RefreshCw size={14} /> },
];

const AbaInvestimentos: React.FC<AbaInvestimentosProps> = ({ clienteId }) => {
  const [activeSub, setActiveSub] = useState('resumo');
  const [ativos, setAtivos] = useState<any[]>([]);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const { setSubnav } = useProntuarioNav();

  // Publica as sub-abas no header enquanto Patrimônio estiver ativa
  useEffect(() => {
    setSubnav({ items: menu, activeId: activeSub, onSelect: setActiveSub });
    return () => setSubnav(null);
  }, [activeSub, setSubnav]);

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

  if (loading && ativos.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-6">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
        <p className="text-faint font-bold uppercase tracking-[0.2em] text-[10px]">Analizando Carteira...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="min-h-[500px] animate-slide-up">
        {activeSub === 'resumo' && <ResumoInvestimentos clienteId={clienteId} ativos={ativos} cliente={cliente} onRefresh={loadData} onNavigateAportes={() => setActiveSub('rebalanceamento')} />}
        {activeSub === 'carteira' && <CarteiraInvestimentos clienteId={clienteId} cliente={cliente} ativos={ativos} onRefresh={loadData} />}
        {activeSub === 'rebalanceamento' && <RebalanceamentoInvestimentos clienteId={clienteId} ativos={ativos} onFinish={() => { setActiveSub('resumo'); loadData(); }} />}
      </div>
    </div>
  );
};

export default AbaInvestimentos;
