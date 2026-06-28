
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
      className={`flex items-center justify-between transition-all duration-150 group rounded-lg ${isExpanded ? 'px-3 py-2' : 'py-2 justify-center'}`}
      style={{ backgroundColor: isActive ? 'var(--primary-soft)' : 'transparent' }}
      onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface-2)'; }}
      onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      <div className="flex items-center gap-2.5">
        <span style={{ color: isActive ? 'var(--primary)' : 'var(--text-muted)', transition: 'color 0.15s' }}>
          {React.cloneElement(icon as any, { size: 17 })}
        </span>
        {isExpanded && (
          <span
            className="whitespace-nowrap overflow-hidden"
            style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--primary)' : 'var(--text-main)' }}
          >
            {label}
          </span>
        )}
      </div>
      {badge && isExpanded && (
        <span
          style={{
            fontSize: '10px', fontWeight: 700,
            backgroundColor: isActive ? 'var(--primary-soft)' : 'var(--bg-surface-2)',
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            padding: '2px 6px', borderRadius: '9999px',
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
};

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

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
    <aside className={`${isExpanded ? 'w-64' : 'w-20'} bg-surface border-r border-subtle flex flex-col h-full z-40 transition-all duration-300 relative group/sidebar`}>
      <button
        onClick={toggleSidebar}
        className="absolute -right-3.5 top-8 bg-surface-2 border border-strong text-faint hover:text-primary w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-md z-50 transform hover:scale-110"
      >
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`p-6 ${!isExpanded ? 'px-4' : ''}`}>
          <div className={`flex items-center gap-3 mb-8 ${isExpanded ? 'px-2' : 'justify-center'}`}>
            <div className="h-8 w-8 rounded-xl flex items-center justify-center text-[#0b0e14] shadow-sm flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }}>
              <Briefcase size={18} />
            </div>
            {isExpanded && (
              <div className="overflow-hidden whitespace-nowrap">
                <span className="text-base font-bold tracking-tight text-main block leading-none uppercase">Tulipa</span>
                <span className="text-[8px] font-bold text-faint uppercase tracking-widest">Vibe Financeiro</span>
              </div>
            )}
          </div>

          <nav className="space-y-0.5">
            <NavItem to="/dashboard" label="Visão Geral" icon={<LayoutDashboard />} isExpanded={isExpanded} />
            <NavItem to="/clientes" label="Clientes" icon={<Users />} isExpanded={isExpanded} />
            <NavItem to="/configuracoes" label="Ajustes" icon={<Settings />} isExpanded={isExpanded} />

            <div className="pt-5 pb-1 h-9 flex items-center">
              {isExpanded ? (
                <span
                  className="whitespace-nowrap"
                  style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: '12px' }}
                >
                  Módulos
                </span>
              ) : (
                <div className="w-full h-px mx-2" style={{ backgroundColor: 'var(--border)' }} />
              )}
            </div>
            <NavItem to="/carteira" label="Carteira" icon={<Briefcase />} badge="Beta" isExpanded={isExpanded} />
            <NavItem to="/conciliacao" label="Recebíveis" icon={<Scale />} isExpanded={isExpanded} />
          </nav>
        </div>

        <div className={`mt-auto p-6 border-t border-subtle ${!isExpanded ? 'px-3 flex justify-center' : ''}`}>
          <div className={`flex items-center group w-full ${isExpanded ? 'justify-between' : 'justify-center flex-col gap-4'}`}>
            <div className={`flex items-center gap-3 min-w-0 ${!isExpanded ? 'justify-center w-full' : ''}`}>
              <div className="h-9 w-9 rounded-xl bg-surface-2 border border-subtle flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={`https://ui-avatars.com/api/?name=${user?.user_metadata?.full_name || 'U'}&background=10b981&color=0b0e14`} alt="Avatar" />
              </div>
              {isExpanded && (
                <div className="min-w-0 overflow-hidden">
                  <p className="text-xs font-bold text-main truncate leading-none">{user?.user_metadata?.full_name || 'Consultor'}</p>
                  <span className="text-[9px] font-medium text-faint uppercase tracking-wider block truncate">{user?.user_metadata?.role || 'Master'}</span>
                </div>
              )}
            </div>
            <button
              onClick={logout}
              className={`p-2 text-faint hover:text-[color:var(--danger)] rounded-lg transition-all ${!isExpanded ? 'w-full flex justify-center' : ''}`}
              style={{ transition: 'all .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(248,113,113,0.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
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
