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
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 w-fit overflow-x-auto mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            px-5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2
            ${activeTab === tab.id 
              ? 'bg-white text-emerald-700 shadow-sm border border-slate-200' 
              : 'text-slate-400 hover:text-slate-600'
            }
          `}
        >
          {tab.icon && <span className="opacity-70">{React.cloneElement(tab.icon as any, { size: 14 })}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default Tabs;