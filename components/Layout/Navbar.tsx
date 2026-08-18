import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Menu } from 'lucide-react';
import ClienteSwitcher from './ClienteSwitcher';
import { useProntuarioNav } from '../../context/ProntuarioNavContext';

const SECTION_LABEL: Record<string, string> = {
  dashboard: 'Visão Geral',
  clientes: 'Clientes',
  configuracoes: 'Ajustes',
  conciliacao: 'Recebíveis',
  carteira: 'Carteira',
};

interface NavbarProps {
  /** Abre a Sidebar como drawer — só existe abaixo de `lg`. */
  onAbrirMenu: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onAbrirMenu }) => {
  const location = useLocation();
  const { nav, subnav } = useProntuarioNav();

  const segments = location.pathname.split('/').filter(Boolean);
  const section = segments[0] || 'dashboard';
  const isClienteScope = section === 'clientes';
  const isProntuario = isClienteScope && segments.length > 1;

  // Abas de topo + submenu inline da aba ativa — extraído porque aparece em dois lugares:
  // dentro da linha única do desktop (lg+) e na segunda linha dedicada do mobile/tablet.
  const renderTabsRow = () => (
    <>
      <div className="flex items-center gap-0.5 shrink-0">
        {nav!.tabs.map(tab => {
          const isActive = nav!.activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => nav!.setActiveTab(tab.id)}
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
    </>
  );

  const breadcrumb = (
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
  );

  const menuBtn = (
    <button
      onClick={onAbrirMenu}
      className="lg:hidden -ml-1 h-10 w-10 flex items-center justify-center rounded-lg text-muted hover:text-main hover:bg-surface-2 transition-colors shrink-0"
      title="Abrir menu"
      aria-label="Abrir menu"
    >
      <Menu size={20} />
    </button>
  );

  return (
    <header className="flex-shrink-0 bg-surface border-b border-subtle">
      {/* lg+: linha única (breadcrumb + abas + ações) — como sempre foi. Abaixo de `lg`, as
          abas do prontuário (até 6, com submenu) não sobram espaço nenhum ao lado do
          breadcrumb + ações: viravam um container flex-1 espremido a 0px, invisível. Abaixo
          de `lg` o cabeçalho passa a ter DUAS linhas: topo (menu + breadcrumb + ações) e, só
          quando há abas, uma segunda linha dedicada e com a largura toda para elas. */}
      <div className="hidden lg:flex h-16 items-center px-6 gap-4">
        {menuBtn}
        {breadcrumb}
        {nav && (
          <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <div className="w-px h-6 bg-subtle shrink-0 mx-1" />
            {renderTabsRow()}
          </div>
        )}
        <div className="flex items-center gap-2 shrink-0 ml-auto">{nav?.actions}</div>
      </div>

      <div className="lg:hidden">
        <div className="h-14 flex items-center px-4 sm:px-6 gap-3">
          {menuBtn}
          {breadcrumb}
          <div className="flex items-center gap-2 shrink-0 ml-auto">{nav?.actions}</div>
        </div>
        {nav && (
          <div className="flex items-center gap-1 px-4 sm:px-6 h-11 border-t border-subtle overflow-x-auto no-scrollbar">
            {renderTabsRow()}
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
