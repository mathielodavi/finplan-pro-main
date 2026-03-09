import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Accordion: React.FC<AccordionProps> = ({ title, subtitle, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden mb-4 transition-all">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-6 text-left hover:bg-slate-50/50 transition-colors focus:outline-none group"
      >
        <div>
          <h3 className="font-black text-slate-800 uppercase text-[11px] tracking-widest">{title}</h3>
          {subtitle && <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tight">{subtitle}</p>}
        </div>
        <div className={`p-2 rounded-xl bg-slate-50 text-slate-400 transition-all duration-300 ${isOpen ? 'rotate-180 bg-indigo-50 text-indigo-600' : 'group-hover:bg-slate-100'}`}>
          <ChevronDown size={16} strokeWidth={3} />
        </div>
      </button>
      
      <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
        <div className="px-6 pb-6 pt-2 border-t border-slate-50">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Accordion;