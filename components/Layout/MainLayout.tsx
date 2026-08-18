import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { ProntuarioNavProvider } from '../../context/ProntuarioNavContext';

const MainLayout: React.FC = () => {
  // Abaixo de `lg` a Sidebar vira drawer off-canvas: o estado mora aqui porque o botão que abre
  // está no Navbar e o painel que fecha é a Sidebar — irmãos na árvore.
  const [menuAberto, setMenuAberto] = useState(false);
  const location = useLocation();

  // Navegar fecha o drawer (no mobile o menu cobre a tela; ficar aberto sobre a nova rota confunde).
  React.useEffect(() => { setMenuAberto(false); }, [location.pathname]);

  return (
    <ProntuarioNavProvider>
      {/* 100dvh em vez de 100vh: no Safari do iOS a barra de endereço encolhe/expande e o 100vh
          fixo deixa parte do conteúdo sob a interface do navegador. */}
      <div className="flex h-[100dvh] overflow-hidden" style={{ backgroundColor: 'var(--bg-main)' }}>
        <Sidebar menuAberto={menuAberto} onFechar={() => setMenuAberto(false)} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar onAbrirMenu={() => setMenuAberto(true)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] scroll-smooth">
            <div className="max-w-[1400px] mx-auto animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ProntuarioNavProvider>
  );
};

export default MainLayout;
