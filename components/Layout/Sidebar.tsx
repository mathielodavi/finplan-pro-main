
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LayoutDashboard, Users, Settings, Briefcase, Scale, LogOut, ChevronLeft, ChevronRight, X } from 'lucide-react';

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
      // Hover/active via classes Tailwind (auto-seguras em touch — ver nota abaixo) em vez de
      // onMouseEnter/onMouseLeave: no iOS Safari, um mouseenter disparado por toque nem sempre
      // recebe o mouseleave correspondente, travando o item "em hover" após navegar. Como o
      // Tailwind v4 já embrulha `hover:` em `@media (hover: hover)`, essas classes simplesmente
      // não se aplicam em touch — só o `active:` (tap real) dá o feedback visual lá.
      // Sem inline style quando !isActive, para o hover/active de classe poderem vencer a cascata.
      className={`flex items-center justify-between transition-all duration-150 group rounded-lg ${isExpanded ? 'px-3 py-2' : 'py-2 justify-center'} ${!isActive ? 'hover:bg-surface-2 active:bg-surface-3' : ''}`}
      style={isActive ? { backgroundColor: 'var(--primary-soft)' } : undefined}
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

interface SidebarProps {
  /** Estado do drawer abaixo de `lg`. Acima disso a sidebar é sempre visível no fluxo. */
  menuAberto: boolean;
  onFechar: () => void;
}

const LG_BREAKPOINT = '(min-width: 1024px)';

const Sidebar: React.FC<SidebarProps> = ({ menuAberto, onFechar }) => {
  const { user, logout } = useAuth();

  const [isExpanded, setIsExpanded] = React.useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // O modo "recolhido" (só ícones) existe para ganhar espaço no desktop. Como drawer ele não faz
  // sentido — a sobreposição já é temporária —, então abaixo de `lg` a sidebar abre sempre inteira.
  const [isDesktop, setIsDesktop] = React.useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(LG_BREAKPOINT).matches
  );
  React.useEffect(() => {
    const mq = window.matchMedia(LG_BREAKPOINT);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Esc fecha o drawer, como nos demais painéis do sistema (ver components/UI/SidePanel.tsx).
  React.useEffect(() => {
    if (!menuAberto) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuAberto, onFechar]);

  const expandido = isDesktop ? isExpanded : true;

  const toggleSidebar = () => {
    setIsExpanded(prev => {
      const newState = !prev;
      localStorage.setItem('sidebar_expanded', JSON.stringify(newState));
      return newState;
    });
  };

  return (
    <>
      {/* Overlay do drawer — só existe abaixo de `lg` */}
      {menuAberto && (
        <div className="fixed inset-0 z-40 bg-surface-3/50 backdrop-blur-sm lg:hidden animate-fade-in" onClick={onFechar} aria-hidden="true" />
      )}

      <aside
        className={`
          ${expandido ? 'w-64' : 'w-20'}
          bg-surface border-r border-subtle flex flex-col h-full z-50 group/sidebar
          fixed inset-y-0 left-0 transition-transform duration-300
          ${menuAberto ? 'translate-x-0' : '-translate-x-full'}
          lg:static lg:z-40 lg:translate-x-0 lg:shrink-0 lg:transition-all
        `}
        style={{ paddingLeft: 'env(safe-area-inset-left)' }}
      >
        {/* Recolher/expandir é exclusivo do desktop */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3.5 top-8 bg-surface-2 border border-strong text-faint hover:text-primary w-7 h-7 rounded-full items-center justify-center transition-all shadow-md z-50 transform hover:scale-110 hidden lg:flex"
          title={isExpanded ? 'Recolher menu' : 'Expandir menu'}
        >
          {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Fechar o drawer é exclusivo do mobile */}
        <button
          onClick={onFechar}
          className="absolute right-3 top-5 p-2 text-faint hover:text-main hover:bg-surface-2 rounded-lg transition-colors lg:hidden"
          title="Fechar menu"
        >
          <X size={18} />
        </button>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className={`p-6 ${!expandido ? 'px-4' : ''}`}>
          <div className={`flex items-center gap-3 mb-8 ${expandido ? 'px-2' : 'justify-center'}`}>
            <div className="h-8 w-8 rounded-xl flex items-center justify-center text-[#0b0e14] shadow-sm flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }}>
              <Briefcase size={18} />
            </div>
            {expandido && (
              <div className="overflow-hidden whitespace-nowrap">
                <span className="text-base font-bold tracking-tight text-main block leading-none uppercase">Tulipa</span>
                <span className="text-[8px] font-bold text-faint uppercase tracking-widest">Vibe Financeiro</span>
              </div>
            )}
          </div>

          <nav className="space-y-0.5">
            <NavItem to="/dashboard" label="Visão Geral" icon={<LayoutDashboard />} isExpanded={expandido} />
            <NavItem to="/clientes" label="Clientes" icon={<Users />} isExpanded={expandido} />
            <NavItem to="/configuracoes" label="Ajustes" icon={<Settings />} isExpanded={expandido} />

            <div className="pt-5 pb-1 h-9 flex items-center">
              {expandido ? (
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
            <NavItem to="/carteira" label="Carteira" icon={<Briefcase />} badge="Beta" isExpanded={expandido} />
            <NavItem to="/conciliacao" label="Recebíveis" icon={<Scale />} isExpanded={expandido} />
          </nav>
        </div>

        <div className={`mt-auto p-6 border-t border-subtle ${!expandido ? 'px-3 flex justify-center' : ''}`}>
          <div className={`flex items-center group w-full ${expandido ? 'justify-between' : 'justify-center flex-col gap-4'}`}>
            <div className={`flex items-center gap-3 min-w-0 ${!expandido ? 'justify-center w-full' : ''}`}>
              <div className="h-9 w-9 rounded-xl bg-surface-2 border border-subtle flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src={`https://ui-avatars.com/api/?name=${user?.user_metadata?.full_name || 'U'}&background=10b981&color=0b0e14`} alt="Avatar" />
              </div>
              {expandido && (
                <div className="min-w-0 overflow-hidden">
                  <p className="text-xs font-bold text-main truncate leading-none">{user?.user_metadata?.full_name || 'Consultor'}</p>
                  <span className="text-[9px] font-medium text-faint uppercase tracking-wider block truncate">{user?.user_metadata?.role || 'Master'}</span>
                </div>
              )}
            </div>
            <button
              onClick={logout}
              className={`h-10 min-w-10 flex items-center justify-center px-2 text-faint hover:text-[color:var(--danger)] hover:bg-[rgba(248,113,113,0.12)] active:text-[color:var(--danger)] active:bg-[rgba(248,113,113,0.18)] rounded-lg transition-all ${!expandido ? 'w-full' : ''}`}
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
      </aside>
    </>
  );
};

export default Sidebar;
