
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useProntuarioNav } from '../context/ProntuarioNavContext';
import { User, FileText, Activity, Landmark } from 'lucide-react';

// Sub-componentes
import PerfilConfig from '../components/Configuracoes/PerfilConfig';
import ContratosConfig from '../components/Configuracoes/ContratosConfig';
import AcompanhamentoConfig from '../components/Configuracoes/AcompanhamentoConfig';
import InvestimentosConfig from '../components/Configuracoes/InvestimentosConfig';

const CONFIGURACOES_TABS = [
  { id: 'perfil', label: 'Meu Perfil', icon: <User size={16} /> },
  { id: 'contratos', label: 'Contratos', icon: <FileText size={16} /> },
  { id: 'acompanhamento', label: 'Metodologia', icon: <Activity size={16} /> },
  { id: 'investimentos', label: 'Mercado', icon: <Landmark size={16} /> },
];

const ConfiguracoesPage: React.FC = () => {
  const { tab } = useParams<{ tab: string }>();
  const { setNav } = useProntuarioNav();
  const [activeTab, setActiveTab] = useState(tab || 'perfil');

  // Publica as abas de Ajustes no header (Navbar) — layout padrão de navegação
  // por abas em telas com múltiplas visões (ver DESIGN.MD §8).
  useEffect(() => {
    setNav({ tabs: CONFIGURACOES_TABS, activeTab, setActiveTab });
    return () => setNav(null);
  }, [activeTab, setNav]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-surface rounded-[16px] border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden min-h-[600px]">
        <div className="p-8">
          {activeTab === 'perfil' && <PerfilConfig />}
          {activeTab === 'contratos' && <ContratosConfig />}
          {activeTab === 'acompanhamento' && <AcompanhamentoConfig />}
          {activeTab === 'investimentos' && <InvestimentosConfig />}
        </div>
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
