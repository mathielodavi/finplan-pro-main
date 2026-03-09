import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { LogOut, ChevronRight } from 'lucide-react';

const Navbar: React.FC = () => {
  const { logout } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Visão Geral';
    if (path.includes('/clientes')) return 'Gestão de Carteira';
    if (path.includes('/configuracoes')) return 'Ajustes do Sistema';
    if (path.includes('/conciliacao')) return 'Fluxo de Caixa';
    return 'Tulipa Financeiro';
  };

  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 flex justify-between items-center sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Tulipa</span>
          <ChevronRight size={12} className="opacity-50" />
          <span className="text-emerald-600">{location.pathname.split('/')[1] || 'Home'}</span>
        </div>
        <div className="h-4 w-px bg-slate-200 mx-2 hidden sm:block"></div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight hidden sm:block">{getPageTitle()}</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Placeholder for future topbar actions */}
      </div>
    </header>
  );
};

export default Navbar;