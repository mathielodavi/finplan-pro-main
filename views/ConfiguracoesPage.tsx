
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { User, FileText, Activity, Landmark, Settings } from 'lucide-react';

// Sub-componentes
import PerfilConfig from '../components/Configuracoes/PerfilConfig';
import ContratosConfig from '../components/Configuracoes/ContratosConfig';
import AcompanhamentoConfig from '../components/Configuracoes/AcompanhamentoConfig';
import InvestimentosConfig from '../components/Configuracoes/InvestimentosConfig';

const ConfiguracoesPage: React.FC = () => {
  const { tab = 'perfil' } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const menuItems = [
    { id: 'perfil', label: 'Meu Perfil', icon: <User size={20} />, desc: 'Identidade e segurança' },
    { id: 'contratos', label: 'Contratos', icon: <FileText size={20} />, desc: 'Padrões de recebíveis' },
    { id: 'acompanhamento', label: 'Metodologia', icon: <Activity size={20} />, desc: 'Fases e Checklists' },
    { id: 'investimentos', label: 'Mercado', icon: <Landmark size={20} />, desc: 'Assets e Instituições' }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[600px]">
        <div className="flex bg-slate-50/50 border-b border-slate-100 px-4 pt-1">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(`/configuracoes/${item.id}`)}
              className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center transition-all relative group whitespace-nowrap rounded-t-2xl ${tab === item.id
                ? 'text-emerald-600 bg-white shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)] border border-slate-100 border-b-0 -mb-[1px]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50 border border-transparent'
                }`}
            >
              <span className={`transition-opacity ${tab === item.id ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'}`}>
                {item.icon}
              </span>
              <span className={`overflow-hidden transition-all duration-300 ease-in-out flex items-center ${tab === item.id ? 'max-w-[200px] opacity-100 ml-3' : 'max-w-0 opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:ml-3'}`}>
                {item.label}
              </span>
              {tab === item.id && <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600 rounded-t-full" />}
            </button>
          ))}
        </div>

        <div className="p-8 animate-slide-up">
          {tab === 'perfil' && <PerfilConfig />}
          {tab === 'contratos' && <ContratosConfig />}
          {tab === 'acompanhamento' && <AcompanhamentoConfig />}
          {tab === 'investimentos' && <InvestimentosConfig />}
        </div>
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
