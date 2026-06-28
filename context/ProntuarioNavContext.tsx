import React, { createContext, useContext, useState } from 'react';

export interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface ProntuarioNav {
  tabs: NavItem[];
  activeTab: string;
  setActiveTab: (id: string) => void;
  /** Ações contextuais (ex.: Compartilhar / Gerar PDF). */
  actions?: React.ReactNode;
}

export interface ProntuarioSubnav {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

interface ProntuarioNavContextType {
  nav: ProntuarioNav | null;
  setNav: (nav: ProntuarioNav | null) => void;
  /** Submenu da aba ativa — estado separado, publicado pelas abas filhas. */
  subnav: ProntuarioSubnav | null;
  setSubnav: (subnav: ProntuarioSubnav | null) => void;
}

const ProntuarioNavContext = createContext<ProntuarioNavContextType | undefined>(undefined);

export const ProntuarioNavProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nav, setNav] = useState<ProntuarioNav | null>(null);
  const [subnav, setSubnav] = useState<ProntuarioSubnav | null>(null);

  return (
    <ProntuarioNavContext.Provider value={{ nav, setNav, subnav, setSubnav }}>
      {children}
    </ProntuarioNavContext.Provider>
  );
};

export const useProntuarioNav = () => {
  const ctx = useContext(ProntuarioNavContext);
  if (!ctx) throw new Error('useProntuarioNav deve ser usado dentro de ProntuarioNavProvider');
  return ctx;
};
