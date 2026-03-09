
import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatarMoeda } from '../../utils/formatadores';
import { atualizarCliente } from '../../services/clienteService';
import { investimentoService } from '../../services/investimentoService';
import { configService } from '../../services/configuracoesService';
import { supabase } from '../../services/supabaseClient';
import Modal from '../Modal';
import { Target, ShieldCheck, Wallet, TrendingUp, ChevronRight, Calculator, Landmark, ArrowUpRight, Info, Settings, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

const ResumoInvestimentos = ({ ativos, cliente, onRefresh }: any) => {
   const [modalConfig, setModalConfig] = useState(false);
   const [projetos, setProjetos] = useState<any[]>([]);
   const [modelosDisponiveis, setModelosDisponiveis] = useState<any[]>([]);
   const [tesesDisponiveis, setTesesDisponiveis] = useState<any[]>([]);
   const [bancosDisponiveis, setBancosDisponiveis] = useState<any[]>([]);
   const [classesCores, setClassesCores] = useState<Record<string, string>>({});
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      const loadMetadata = async () => {
         setLoading(true);
         try {
            const [projData, alocData, estrategiasData, bancosData] = await Promise.all([
               investimentoService.getProjetos(cliente?.id),
               configService.getAssetAllocations(),
               configService.getEstrategias(),
               configService.getBancos()
            ]);

            setProjetos(projData || []);
            setModelosDisponiveis(alocData || []);
            setTesesDisponiveis(estrategiasData || []);
            setBancosDisponiveis(bancosData || []);

            const mapCores: Record<string, string> = {};
            alocData.forEach(aloc => {
               aloc.classes?.forEach((c: any) => {
                  mapCores[c.nome] = c.cor_rgb;
               });
            });
            setClassesCores(mapCores);
         } catch (err) {
            console.error(err);
         } finally {
            setLoading(false);
         }
      };
      if (cliente?.id) loadMetadata();
   }, [cliente?.id]);



   // Função para calcular o acumulado real de um projeto cruzando com ativos
   const calcularAcumuladoProjeto = (projetoId: string) => {
      return (ativos || []).reduce((acc: number, a: any) => {
         const linkProjeto = (a.distribuicao_objetivos || []).find(
            (o: any) => o.tipo === 'projeto' && o.projeto_id === projetoId
         );
         const valor = linkProjeto ? a.valor_atual * (linkProjeto.percentual / 100) : 0;
         return acc + valor;
      }, 0);
   };

   const dadosIndependencia = useMemo(() => {
      const distribuicao: Record<string, { name: string, value: number, color: string }> = {};
      let totalIndep = 0;

      ativos.forEach((a: any) => {
         const linkIndep = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'independencia');
         if (linkIndep && linkIndep.percentual > 0) {
            const valorAlocado = a.valor_atual * (linkIndep.percentual / 100);
            const classe = a.tipo_ativo || 'Outros';

            if (!distribuicao[classe]) {
               distribuicao[classe] = {
                  name: classe,
                  value: 0,
                  color: classesCores[classe] || '#94a3b8'
               };
            }
            distribuicao[classe].value += valorAlocado;
            totalIndep += valorAlocado;
         }
      });

      return {
         chartData: Object.values(distribuicao).sort((a, b) => b.value - a.value),
         totalIndep
      };
   }, [ativos, classesCores]);

   const reservaAtual = useMemo(() => {
      return ativos
         .reduce((acc: number, a: any) => {
            const linkReserva = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'reserva');
            const valor = linkReserva ? a.valor_atual * (linkReserva.percentual / 100) : 0;
            return acc + valor;
         }, 0);
   }, [ativos]);

   const percReserva = (cliente?.reserva_recomendada || 0) > 0
      ? Math.min((reservaAtual / (cliente?.reserva_recomendada || 1)) * 100, 100)
      : 0;

   const handleUpdatePerfil = async (key: string, value: any) => {
      const finalValue = key === 'bancos_ativos' ? (value as string[]).join(',') : value;
      await atualizarCliente(cliente.id, { [key]: finalValue });
      onRefresh();
   };

   const bancosSelecionados = useMemo(() => {
      return cliente?.bancos_ativos ? cliente.bancos_ativos.split(',').filter(Boolean) : [];
   }, [cliente?.bancos_ativos]);

   return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">

         <div className="lg:col-span-7 space-y-8">

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all">
               <div className="flex items-center gap-5">
                  <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500">
                     <TrendingUp size={20} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Aporte Mensal Previsto</p>
                     <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatarMoeda(cliente?.aporte_mensal || 0)}</p>
                  </div>
               </div>
               <button
                  onClick={() => setModalConfig(true)}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all border border-slate-100"
               >
                  <Settings size={20} />
               </button>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[460px] flex flex-col">
               <div className="flex justify-between items-start mb-8">
                  <div>
                     <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">Carteira de Independência</h3>
                     <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Alocação por Classe de Ativo</p>
                  </div>
                  <div className="text-right">
                     <p className="text-lg font-black text-indigo-600 leading-none">{formatarMoeda(dadosIndependencia.totalIndep)}</p>
                     <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Patrimônio Alocado</span>
                  </div>
               </div>

               <div className="flex-1 flex flex-col md:flex-row items-center gap-12">
                  <div className="w-full md:w-1/2 h-[280px] relative">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                           <Pie
                              data={dadosIndependencia.chartData}
                              innerRadius="60%"
                              outerRadius="85%"
                              paddingAngle={8}
                              dataKey="value"
                              stroke="none"
                              animationBegin={0}
                              animationDuration={1500}
                           >
                              {dadosIndependencia.chartData.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                           </Pie>
                           <Tooltip
                              contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '11px', fontWeight: 'bold' }}
                              formatter={(v: any) => formatarMoeda(v)}
                           />
                        </PieChart>
                     </ResponsiveContainer>
                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Classes</p>
                        <p className="text-lg font-black text-slate-800">{dadosIndependencia.chartData.length}</p>
                     </div>
                  </div>

                  <div className="w-full md:w-1/2 space-y-4">
                     {dadosIndependencia.chartData.map((item, i) => (
                        <div key={i} className="flex items-center justify-between group">
                           <div className="flex items-center gap-3">
                              <div className="h-2 w-2 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight group-hover:text-slate-900 transition-colors">{item.name}</span>
                           </div>
                           <div className="text-right">
                              <span className="text-xs font-black text-slate-800">{((item.value / (dadosIndependencia.totalIndep || 1)) * 100).toFixed(1)}%</span>
                           </div>
                        </div>
                     ))}
                     {dadosIndependencia.chartData.length === 0 && (
                        <p className="text-center py-10 text-slate-300 font-bold uppercase text-[9px] italic">Vincule ativos ao objetivo "Independência" para visualizar.</p>
                     )}
                  </div>
               </div>
            </div>
         </div>

         <div className="lg:col-span-5 space-y-8">

            <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden flex flex-col justify-between h-[280px] group">
               <div className="relative z-10">
                  <div className="flex justify-between items-center mb-6">
                     <div className="flex items-center gap-3">
                        <ShieldCheck size={20} className="text-emerald-400" />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Reserva Estratégica</h3>
                     </div>
                  </div>

                  <div className="space-y-6">
                     <div className="flex justify-between items-end">
                        <div>
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Montante Atual</span>
                           <p className="text-2xl font-black text-white">{formatarMoeda(reservaAtual)}</p>
                        </div>
                        <div className="text-right">
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Alvo Recomendado</span>
                           <p className="text-base font-black text-slate-300">{formatarMoeda(cliente?.reserva_recomendada || 0)}</p>
                           <p className="text-[9px] text-slate-500 mt-0.5">Definido em Proteção</p>
                        </div>
                     </div>

                     <div className="space-y-2">
                        <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                           <div
                              className={`h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(16,185,129,0.3)] ${percReserva < 100 ? 'bg-amber-400' : 'bg-emerald-50'}`}
                              style={{ width: `${percReserva}%` }}
                           />
                        </div>
                        <div className="flex justify-between items-center">
                           <span className="text-[9px] font-bold text-slate-500 uppercase italic">Segurança do Planejamento</span>
                           <span className={`text-[10px] font-black ${percReserva < 100 ? 'text-amber-400' : 'text-emerald-400'}`}>{percReserva.toFixed(0)}%</span>
                        </div>
                     </div>
                  </div>
               </div>
               <Landmark size={120} className="absolute -bottom-10 -right-10 text-white/5 pointer-events-none group-hover:scale-110 transition-transform duration-700" />
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[350px] flex flex-col">
               <div className="flex justify-between items-center mb-10">
                  <div className="flex items-center gap-3">
                     <Target size={18} className="text-indigo-600" />
                     <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">Objetivos Ativos</h3>
                  </div>
                  <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-tighter">Sincronizado</span>
               </div>

               <div className="space-y-8 flex-1">
                  {projetos.length === 0 ? (
                     <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                        <Target size={40} className="text-slate-200 mb-4" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum projeto mapeado</p>
                     </div>
                  ) : projetos.slice(0, 3).map((p, i) => {
                     const acumuladoCalculado = calcularAcumuladoProjeto(p.id);
                     const perc = p.valor_alvo > 0 ? Math.min((acumuladoCalculado / p.valor_alvo) * 100, 100) : 0;

                     return (
                        <div key={p.id} className="group">
                           <div className="flex justify-between items-end mb-3">
                              <div>
                                 <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{p.nome}</p>
                                 <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter">Deadline: {new Date(p.data_alvo).toLocaleDateString('pt-BR')}</span>
                                 </div>
                              </div>
                              <p className="text-[10px] font-black text-slate-900">{perc.toFixed(0)}%</p>
                           </div>
                           <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden shadow-inner border border-slate-50">
                              <div className={`h-full transition-all duration-1000 ${i % 2 === 0 ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${perc}%` }} />
                           </div>
                        </div>
                     );
                  })}
               </div>

               <div className="mt-8 pt-8 border-t border-slate-50">
                  <button
                     onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                     className="w-full py-4 bg-slate-50 hover:bg-slate-100 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest transition-all group"
                  >
                     Gerenciar Todos os Projetos
                     <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </button>
               </div>
            </div>
         </div>


         <Modal isOpen={modalConfig} onClose={() => setModalConfig(false)} title="Configurações de Alocação Estratégica" size="wide">
            <div className="space-y-10">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Asset Mix (Modelo de Alocação)</label>
                     <select
                        value={cliente?.estrategia_padrao_id || ''}
                        onChange={e => handleUpdatePerfil('estrategia_padrao_id', e.target.value)}
                        className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm text-slate-700 outline-none focus:border-indigo-500 transition-all"
                     >
                        <option value="">Selecione um modelo...</option>
                        {modelosDisponiveis.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                     </select>
                     <p className="text-[9px] text-slate-400 font-bold uppercase ml-2 italic">Define os percentuais alvo por classe de ativo.</p>
                  </div>

                  <div className="space-y-3">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Tese de Investimentos</label>
                     <select
                        value={cliente?.tese_investimento_id || ''}
                        onChange={e => handleUpdatePerfil('tese_investimento_id', e.target.value)}
                        className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-sm text-slate-700 outline-none focus:border-indigo-500 transition-all"
                     >
                        <option value="">Selecione uma tese...</option>
                        {tesesDisponiveis.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                     </select>
                     <p className="text-[9px] text-slate-400 font-bold uppercase ml-2 italic">Define os ativos recomendados para cada faixa de patrimônio.</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Contas e Instituições Habilitadas</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                     {bancosDisponiveis.map(b => {
                        const isSelected = bancosSelecionados.includes(b.nome);
                        return (
                           <label
                              key={b.id}
                              className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${isSelected ? 'bg-white border-indigo-200 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/50'}`}
                           >
                              <input
                                 type="checkbox"
                                 checked={isSelected}
                                 onChange={e => {
                                    const newList = e.target.checked
                                       ? [...bancosSelecionados, b.nome]
                                       : bancosSelecionados.filter((x: string) => x !== b.nome);
                                    handleUpdatePerfil('bancos_ativos', newList);
                                 }}
                                 className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                              />
                              <span className={`text-[10px] font-black uppercase tracking-tight ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>{b.nome}</span>
                           </label>
                        );
                     })}
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase ml-2 italic text-center">Apenas ativos destas instituições serão sugeridos no protocolo de aporte.</p>
               </div>

               <div className="pt-6 border-t border-slate-50">
                  <button
                     onClick={() => setModalConfig(false)}
                     className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl uppercase text-xs tracking-widest hover:bg-slate-800 transition-all"
                  >
                     Salvar e Fechar Configurações
                  </button>
               </div>
            </div>
         </Modal>
      </div>
   );
};

export default ResumoInvestimentos;
