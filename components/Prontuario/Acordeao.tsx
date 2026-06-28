import React, { useState } from 'react';

interface AcordeaoProps {
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  abertoPadrao?: boolean;
}

const Acordeao: React.FC<AcordeaoProps> = ({ titulo, subtitulo, children, abertoPadrao = false }) => {
  const [isOpen, setIsOpen] = useState(abertoPadrao);

  return (
    <div className="bg-surface rounded-3xl border border-subtle shadow-sm overflow-hidden mb-4 transition-all">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-6 text-left hover:bg-surface-2/50 transition-colors focus:outline-none"
      >
        <div>
          <h3 className="font-black text-main uppercase text-xs tracking-widest">{titulo}</h3>
          {subtitulo && <p className="text-[10px] text-faint font-bold uppercase mt-1 tracking-tight">{subtitulo}</p>}
        </div>
        <div className={`p-2 rounded-full bg-surface-2 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="h-4 w-4 text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {isOpen && (
        <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
          <div className="pt-2 border-t border-subtle">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default Acordeao;