
import React, { useState, useMemo } from 'react';
import { Landmark, TrendingUp, Search, Briefcase } from 'lucide-react';
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
         <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-surface p-3 px-4 rounded-xl border border-subtle">
            <div className="flex items-center gap-2 w-full md:w-80 relative group">
               <Search className="absolute left-3 top-2.5 h-4 w-4 text-faint group-focus-within:text-primary transition-colors" />
               <input
                  type="text"
                  placeholder="Buscar por nome ou ticker..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="w-full pl-9 pr-3 h-9 bg-surface-2 border border-subtle rounded-[8px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold text-[12px] text-main placeholder:text-faint"
               />
            </div>

            <div className="flex bg-surface-2 rounded-[8px] border border-subtle overflow-x-auto max-w-full h-9 items-center p-1 gap-1">
               {estrategias.map(est => (
                  <button
                     key={est}
                     onClick={() => setFiltroEstrategia(est)}
                     className={`px-3 h-7 rounded-md font-bold text-[10px] uppercase tracking-wider transition-all whitespace-nowrap ${filtroEstrategia === est ? 'bg-surface-3 text-primary border border-subtle' : 'text-faint hover:text-muted'
                        }`}
                  >
                     {est}
                  </button>
               ))}
            </div>
         </div>

         <div className="bg-surface rounded-xl border border-subtle overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-surface border-b border-subtle">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-faint tracking-wider">Ativo Recomendado</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-faint tracking-wider">Estratégia / Faixa</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-faint tracking-wider text-center">Origem</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-faint tracking-wider text-center">Alocação Alvo</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase text-faint tracking-wider">Instituição</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle text-[13px]">
                     {filtrados.map(a => (
                        <tr key={a.id} className="border-b border-subtle last:border-0 hover:bg-surface-2 transition-all group">
                           <td className="px-5 py-3.5">
                              <p className="font-bold text-main uppercase text-[13px] tracking-tight leading-none mb-1">{a.nome_ativo}</p>
                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                 {a.asset_classe_nome}
                              </span>
                           </td>
                           <td className="px-5 py-3.5">
                              <p className="font-bold text-main text-[12px] tracking-tight leading-none mb-1">{a.estrategias_base?.nome}</p>
                              <p className="text-[10px] text-faint font-bold uppercase tracking-wider">{a.estrategias_faixas?.nome}</p>
                           </td>
                           <td className="px-5 py-3.5 text-center">
                              <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-surface-2 border border-subtle text-faint">
                                 {a.origem_ativo === 'bolsa' ? <TrendingUp size={14} /> : a.origem_ativo === 'fundo' ? <Briefcase size={14} /> : <Landmark size={14} />}
                              </div>
                           </td>
                           <td className="px-5 py-3.5 text-center">
                              <span className="text-[14px] font-bold tracking-tighter text-main">{a.alocacao}%</span>
                           </td>
                           <td className="px-5 py-3.5">
                              {a.instituicoes ? (
                                 <div className="flex flex-wrap gap-1">
                                    {a.instituicoes.split(',').map((inst: string) => (
                                       <Badge key={inst} variant="neutral" size="sm">{inst.trim()}</Badge>
                                    ))}
                                 </div>
                              ) : (
                                 <span className="text-[10px] font-bold text-faint uppercase tracking-wider">Livre</span>
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
