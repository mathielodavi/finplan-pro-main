import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import ClienteSwitcher from './ClienteSwitcher';
import { useProntuarioNav } from '../../context/ProntuarioNavContext';

const SECTION_LABEL: Record<string, string> = {
  dashboard: 'Visão Geral',
  clientes: 'Clientes',
  configuracoes: 'Ajustes',
  conciliacao: 'Recebíveis',
  carteira: 'Carteira',
};

const Navbar: React.FC = () => {
  const location = useLocation();
  const { nav, subnav } = useProntuarioNav();

  const segments = location.pathname.split('/').filter(Boolean);
  const section = segments[0] || 'dashboard';
  const isClienteScope = section === 'clientes';
  const isProntuario = isClienteScope && segments.length > 1;

  return (
    <header className="h-16 flex-shrink-0 bg-surface border-b border-subtle flex items-center px-6 gap-4">
      {/* Breadcrumb (com seletor de cliente como último segmento no prontuário) */}
      <nav className="flex items-center gap-1.5 min-w-0 shrink-0">
        {isProntuario ? (
          <>
            <Link to="/clientes" className="text-[14px] font-medium text-muted hover:text-main transition-colors shrink-0">Clientes</Link>
            <ChevronRight size={15} className="text-faint shrink-0" />
            <ClienteSwitcher />
          </>
        ) : (
          <span className="text-[15px] font-semibold text-main truncate">
            {SECTION_LABEL[section] || section}
          </span>
        )}
      </nav>

      {/* Navegação do prontuário (abas + submenu inline) publicada via contexto */}
      {nav && (
        <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          <div className="w-px h-6 bg-subtle shrink-0 mx-1" />
          {/* Abas de topo */}
          <div className="flex items-center gap-0.5 shrink-0">
            {nav.tabs.map(tab => {
              const isActive = nav.activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => nav.setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 whitespace-nowrap px-3 h-9 rounded-lg text-[13px] transition-colors"
                  style={{
                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: isActive ? 600 : 500,
                    backgroundColor: isActive ? 'var(--primary-soft)' : 'transparent',
                  }}
                >
                  {tab.icon && <span style={{ opacity: isActive ? 1 : 0.7 }}>{React.cloneElement(tab.icon as any, { size: 15 })}</span>}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Submenu inline da aba ativa */}
          {subnav && subnav.items.length > 0 && (
            <>
              <div className="w-px h-5 bg-subtle shrink-0 mx-1.5" />
              <div className="flex items-center gap-0.5 shrink-0">
                {subnav.items.map(item => {
                  const isActive = subnav.activeId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => subnav.onSelect(item.id)}
                      className="flex items-center gap-1.5 whitespace-nowrap px-2.5 h-8 rounded-md text-[12px] transition-colors"
                      style={{
                        color: isActive ? 'var(--primary)' : 'var(--text-faint)',
                        fontWeight: isActive ? 600 : 500,
                        backgroundColor: isActive ? 'var(--primary-soft)' : 'transparent',
                      }}
                    >
                      {item.icon && <span style={{ opacity: isActive ? 1 : 0.7 }}>{React.cloneElement(item.icon as any, { size: 13 })}</span>}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Ações contextuais (extrema direita) */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {nav?.actions}
      </div>
    </header>
  );
};

export default Navbar;
