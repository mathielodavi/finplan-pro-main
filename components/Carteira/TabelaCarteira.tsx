
import React, { useState, useMemo } from 'react';
import { formatarMoeda } from '../../utils/formatadores';
import { Landmark, TrendingUp, Info, Search, Briefcase, Calculator } from 'lucide-react';
import Badge from '../UI/Badge';

interface TabelaCarteiraProps {
   ativos: any[];
}

const TabelaCarteira: React.FC<TabelaCarteiraProps> = ({ ativos }) => {
   const [busca, setBusca] = useState('');
   const [filtroEstrategia, setFiltroEstrategia] = useState('Todas');

   const estrategias = useMemo(() => ['Todas', ...Array.from(new Set(ativos.map(a => a.estrategias_base?.nome)))], [ativos]);

   const filtrados = ativos.filter(a => {
      const matchBusca = a.nome_ativo.toLowerCase().includes(busca.toLowerCase()) ||
         (a.ticker && a.ticker.toLowerCase().includes(busca.toLowerCase()));
      const matchEst = filtroEstrategia === 'Todas' || a.estrategias_base?.nome === filtroEstrategia;
      return matchBusca && matchEst;
   });

   return (
      <div className="space-y-6 animate-fade-in">
         <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 px-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 w-full md:w-80 relative group">
               <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
               <input
                  type="text"
                  placeholder="Buscar por nome ou ticker..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/5 transition-all font-bold text-sm"
               />
            </div>

            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 overflow-x-auto max-w-full">
               {estrategias.map(est => (
                  <button
                     key={est}
                     onClick={() => setFiltroEstrategia(est)}
                     className={`px-6 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all whitespace-nowrap ${filtroEstrategia === est ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        }`}
                  >
                     {est}
                  </button>
               ))}
            </div>
         </div>

         <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest">Ativo Recomendado</th>
                        <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest">Estratégia / Faixa</th>
                        <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Origem</th>
                        <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Alocação Alvo</th>
                        <th className="px-8 py-5 text-[9px] font-black uppercase text-slate-400 tracking-widest">Instituição</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                     {filtrados.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50/30 transition-all group">
                           <td className="px-8 py-5">
                              <p className="font-black text-slate-800 uppercase text-[13px] tracking-tight">{a.nome_ativo}</p>
                              <div className="flex items-center gap-2 mt-1">
                                 <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                                    {a.asset_classe_nome}
                                 </span>
                                 {a.variacoes_fundo && (
                                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase italic">
                                       <Calculator size={10} /> Tem Variações
                                    </div>
                                 )}
                              </div>
                           </td>
                           <td className="px-8 py-5">
                              <p className="font-bold text-slate-700 text-[13px]">{a.estrategias_base?.nome}</p>
                              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-tighter italic">{a.estrategias_faixas?.nome}</p>
                           </td>
                           <td className="px-8 py-5 text-center">
                              <div className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-slate-50 text-slate-400">
                                 {a.origem_ativo === 'bolsa' ? <TrendingUp size={14} /> : a.origem_ativo === 'fundo' ? <Briefcase size={14} /> : <Landmark size={14} />}
                              </div>
                           </td>
                           <td className="px-8 py-5 text-center">
                              <span className="text-sm font-black text-slate-900">{a.alocacao}%</span>
                           </td>
                           <td className="px-8 py-5">
                              {a.instituicoes ? (
                                 <div className="flex flex-wrap gap-1">
                                    {a.instituicoes.split(',').map((inst: string) => (
                                       <Badge key={inst} variant="neutral" size="sm">{inst.trim()}</Badge>
                                    ))}
                                 </div>
                              ) : (
                                 <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest italic">Qualquer Instituição</span>
                              )}
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
   );
};

export default TabelaCarteira;
