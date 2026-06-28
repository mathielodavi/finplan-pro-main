import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  /** Tamanho do texto das tabs */
  size?: 'sm' | 'md';
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, size = 'md' }) => {
  // DESIGN.MD §8: design underline limpo. Sem fundo de cápsula/pill.
  // Inativo: cinza (text-muted). Ativo: cor primária, semi-bold, sublinhado sólido 2px.
  return (
    <div
      className="flex overflow-x-auto"
      style={{
        borderBottom: '1px solid var(--border)',
        gap: '0',
        marginBottom: '20px',
      }}
    >
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex items-center gap-1.5 whitespace-nowrap transition-all duration-150 flex-shrink-0"
            style={{
              padding: size === 'sm' ? '8px 12px' : '10px 16px',
              fontSize: size === 'sm' ? '12px' : '13px',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: isActive
                ? '2px solid var(--primary)'
                : '2px solid transparent',
              marginBottom: '-1px', // sobrepõe a borda do container
              background: 'transparent',
              border: 'none',
              borderRadius: 0,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {tab.icon && (
              <span style={{ opacity: isActive ? 1 : 0.6, display: 'flex', alignItems: 'center' }}>
                {React.cloneElement(tab.icon as any, { size: 14 })}
              </span>
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;