
import React from 'react';
import { TermometroData } from '../../utils/termometroUtils';

interface TermometroProps {
  data: TermometroData;
}

const Termometro: React.FC<TermometroProps> = ({ data }) => {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
      <div className="flex justify-between items-end">
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Termômetro</span>
          <h4 className="text-xl font-black tracking-tight" style={{ color: data.cor }}>{data.status}</h4>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-slate-900">{data.percentual}%</span>
        </div>
      </div>
      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50">
        <div 
          className="h-full transition-all duration-1000 ease-out"
          style={{ width: `${data.percentual}%`, backgroundColor: data.cor }}
        />
      </div>
      <p className="text-xs font-bold text-slate-500 italic">
        {data.descricao}
      </p>
    </div>
  );
};

export default Termometro;
