
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LayoutDashboard, Users, Settings, Briefcase, Scale, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  isExpanded: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, badge, isExpanded }) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      title={!isExpanded ? label : undefined}
      className={`
        flex items-center justify-between py-3 rounded-xl transition-all duration-200 group
        ${isExpanded ? 'px-5' : 'px-0 justify-center'}
        ${isActive
          ? 'bg-emerald-600 text-white shadow-md'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        }
      `}
    >
      <div className="flex items-center gap-3">
        <span className={`transition-transform duration-200 ${!isExpanded ? 'mx-auto' : ''} ${isActive ? '' : 'text-slate-400 group-hover:text-emerald-600'}`}>
          {React.cloneElement(icon as any, { size: 18 })}
        </span>
        {isExpanded && <span className="font-semibold text-xs tracking-tight whitespace-nowrap overflow-hidden transition-all">{label}</span>}
      </div>
      {badge && isExpanded && (
        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold whitespace-nowrap ${isActive ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
          {badge}
        </span>
      )}
    </Link>
  );
};

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

  // Persist the expanded state of the sidebar
  const [isExpanded, setIsExpanded] = React.useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleSidebar = () => {
    setIsExpanded(prev => {
      const newState = !prev;
      localStorage.setItem('sidebar_expanded', JSON.stringify(newState));
      return newState;
    });
  };

  return (
    <aside className={`${isExpanded ? 'w-64' : 'w-20'} bg-white border-r border-slate-100 flex flex-col h-full z-40 transition-all duration-300 relative group/sidebar`}>
      <button
        onClick={toggleSidebar}
        className="absolute -right-3.5 top-8 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-md z-50 transform hover:scale-110"
      >
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`p-6 ${!isExpanded ? 'px-4' : ''}`}>
          <div className={`flex items-center gap-3 mb-8 ${isExpanded ? 'px-2' : 'justify-center'}`}>
            <div className="h-8 w-8 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <Briefcase size={18} />
            </div>
            {isExpanded && (
              <div className="overflow-hidden whitespace-nowrap">
                <span className="text-base font-bold tracking-tight text-slate-900 block leading-none uppercase">Tulipa</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Vibe Financeiro</span>
              </div>
            )}
          </div>

          <nav className="space-y-1">
            <NavItem to="/dashboard" label="Visão Geral" icon={<LayoutDashboard />} isExpanded={isExpanded} />
            <NavItem to="/clientes" label="Clientes" icon={<Users />} isExpanded={isExpanded} />
            <NavItem to="/configuracoes" label="Ajustes" icon={<Settings />} isExpanded={isExpanded} />

            <div className="pt-6 pb-2 h-10 flex items-center">
              {isExpanded ? (
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-4 whitespace-nowrap transition-opacity duration-300">Módulos</span>
              ) : (
                <div className="w-full h-px bg-slate-100 mx-2" />
              )}
            </div>
            <NavItem to="/carteira" label="Carteira" icon={<Briefcase />} badge="Beta" isExpanded={isExpanded} />
            <NavItem to="/conciliacao" label="Conciliação" icon={<Scale />} isExpanded={isExpanded} />
          </nav>
        </div>

        <div className={`mt-auto p-6 border-t border-slate-50 ${!isExpanded ? 'px-3 flex justify-center' : ''}`}>
          <div className={`flex items-center group w-full ${isExpanded ? 'justify-between' : 'justify-center flex-col gap-4'}`}>
            <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center w-full' : ''}`}>
              <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={`https://ui-avatars.com/api/?name=${user?.user_metadata?.full_name || 'U'}&background=10b981&color=fff`} alt="Avatar" />
              </div>
              {isExpanded && (
                <div className="min-w-0 overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 truncate leading-none">{user?.user_metadata?.full_name || 'Consultor'}</p>
                  <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider block truncate">{user?.user_metadata?.role || 'Master'}</span>
                </div>
              )}
            </div>
            <button
              onClick={logout}
              className={`p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all ${!isExpanded ? 'w-full flex justify-center' : ''}`}
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
