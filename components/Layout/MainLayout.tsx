import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { ProntuarioNavProvider } from '../../context/ProntuarioNavContext';

const MainLayout: React.FC = () => {
  return (
    <ProntuarioNavProvider>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-main)' }}>
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
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