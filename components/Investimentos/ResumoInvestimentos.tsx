
import React, { useState, useEffect, useMemo } from 'react';
import {
   BarChart, Bar, Cell, ComposedChart, Area, Line, XAxis, YAxis,
   CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { formatarMoeda } from '../../utils/formatadores';
import { atualizarCliente } from '../../services/clienteService';
import { investimentoService, PremissasIndependencia, HistoricoPatrimonio } from '../../services/investimentoService';
import { configService } from '../../services/configuracoesService';
import { projetarIndependencia, calcularPrazoERentabilidade } from '../../utils/independenciaUtils';
import { CHART_GRID, axisTick, tooltipStyle } from '../../utils/chartTheme';
import SidePanel from '../UI/SidePanel';
import Button from '../UI/Button';
import { ShieldCheck, Target, Settings, SlidersHorizontal, Plus, TrendingUp, Clock } from 'lucide-react';

const ResumoInvestimentos = ({ clienteId, ativos, cliente, onRefresh }: any) => {
   const [drawerContas, setDrawerContas] = useState(false);
   const [drawerPremissas, setDrawerPremissas] = useState(false);
   const [projetos, setProjetos] = useState<any[]>([]);
   const [modelosDisponiveis, setModelosDisponiveis] = useState<any[]>([]);
   const [tesesDisponiveis, setTesesDisponiveis] = useState<any[]>([]);
   const [bancosDisponiveis, setBancosDisponiveis] = useState<any[]>([]);
   const [historico, setHistorico] = useState<HistoricoPatrimonio[]>([]);
   const [savingPrem, setSavingPrem] = useState(false);
   const [novoHist, setNovoHist] = useState({ data: new Date().toISOString().split('T')[0], valor: '0', aporte: '0' });

   const [premissas, setPremissas] = useState<PremissasIndependencia>({
      cliente_id: clienteId,
      renda_alvo: 10000,
      taxa_real_anual: 6,
      patrimonio_inicial: cliente?.patrimonio_total || 0,
      aporte_mensal: cliente?.aporte_mensal || 0,
      prazo_anos: 20,
      data_inicio: new Date().toISOString().split('T')[0],
   });

   useEffect(() => {
      if (!clienteId) return;

      // Núcleo (Modelo/Tese/Contas/Objetivos): isolado para não cair junto com Premissas/Histórico
      (async () => {
         try {
            const [projData, alocData, estrategiasData, bancosData] = await Promise.all([
               investimentoService.getProjetos(clienteId),
               configService.getAssetAllocations(),
               configService.getEstrategias(),
               configService.getBancos(),
            ]);
            setProjetos(projData || []);
            setModelosDisponiveis(alocData || []);
            setTesesDisponiveis(estrategiasData || []);
            setBancosDisponiveis(bancosData || []);
         } catch (err) { console.error('Erro ao carregar dados base de investimentos:', err); }
      })();

      // Premissas/Histórico de independência: isolado do núcleo acima
      (async () => {
         try {
            const [premData, histData] = await Promise.all([
               investimentoService.getPremissasIndependencia(clienteId),
               investimentoService.getHistoricoMensal(clienteId),
            ]);
            setHistorico(histData || []);
            if (premData) {
               setPremissas({
                  ...premData,
                  renda_alvo: Number(premData.renda_alvo),
                  taxa_real_anual: Number(premData.taxa_real_anual),
                  patrimonio_inicial: Number(premData.patrimonio_inicial),
                  aporte_mensal: Number(premData.aporte_mensal),
                  prazo_anos: Number(premData.prazo_anos),
               });
            }
         } catch (err) { console.error('Erro ao carregar premissas/histórico de independência:', err); }
      })();
   }, [clienteId]);

   // ─── Reserva de Emergência ───────────────────────────────────────────────
   const reservaAtual = useMemo(() => (ativos || []).reduce((acc: number, a: any) => {
      const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'reserva');
      return acc + (link ? a.valor_atual * (link.percentual / 100) : 0);
   }, 0), [ativos]);
   const percReserva = (cliente?.reserva_recomendada || 0) > 0
      ? Math.min((reservaAtual / (cliente?.reserva_recomendada || 1)) * 100, 100) : 0;

   // ─── Independência: por classe (atual) e patrimônio total ────────────────
   const indepInfo = useMemo(() => {
      const porClasse: Record<string, number> = {};
      let total = 0;
      (ativos || []).forEach((a: any) => {
         const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'independencia');
         if (link && link.percentual > 0) {
            const valor = a.valor_atual * (link.percentual / 100);
            const classe = a.tipo_ativo || 'Outros';
            porClasse[classe] = (porClasse[classe] || 0) + valor;
            total += valor;
         }
      });
      return { porClasse, total };
   }, [ativos]);

   // Comparativo alvo (modelo) × atual (carteira) por classe
   const modeloSelecionado = modelosDisponiveis.find(m => m.id === cliente?.estrategia_padrao_id);
   const barData = useMemo(() => {
      const classes = modeloSelecionado?.classes || [];
      return classes.map((c: any) => ({
         classe: c.nome,
         alvo: Number(c.percentual) || 0,
         atual: indepInfo.total > 0 ? ((indepInfo.porClasse[c.nome] || 0) / indepInfo.total) * 100 : 0,
         cor: c.cor_rgb || '#10b981',
      }));
   }, [modeloSelecionado, indepInfo]);

   // Patrimônio inicial e aporte mensal sempre vinculados ao cadastro do cliente (não editáveis aqui)
   const premissasEfetivas = useMemo(() => ({
      ...premissas,
      patrimonio_inicial: cliente?.patrimonio_total || 0,
      aporte_mensal: cliente?.aporte_mensal || 0,
   }), [premissas, cliente?.patrimonio_total, cliente?.aporte_mensal]);

   const projecao = useMemo(
      () => projetarIndependencia(premissasEfetivas, indepInfo.total, historico),
      [premissasEfetivas, indepInfo.total, historico]
   );

   const prazoInfo = useMemo(
      () => calcularPrazoERentabilidade(premissasEfetivas, indepInfo.total, historico),
      [premissasEfetivas, indepInfo.total, historico]
   );

   const calcularAcumuladoProjeto = (projetoId: string) => (ativos || []).reduce((acc: number, a: any) => {
      const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'projeto' && o.projeto_id === projetoId);
      return acc + (link ? a.valor_atual * (link.percentual / 100) : 0);
   }, 0);

   const handleUpdatePerfil = async (key: string, value: any) => {
      const finalValue = key === 'bancos_ativos' ? (value as string[]).join(',') : value;
      await atualizarCliente(cliente.id, { [key]: finalValue });
      onRefresh();
   };

   const bancosSelecionados = useMemo(
      () => cliente?.bancos_ativos ? cliente.bancos_ativos.split(',').filter(Boolean) : [],
      [cliente?.bancos_ativos]
   );

   const handleSalvarPremissas = async () => {
      setSavingPrem(true);
      try { await investimentoService.salvarPremissasIndependencia(premissasEfetivas); }
      catch { alert('Erro ao salvar premissas.'); }
      finally { setSavingPrem(false); }
   };

   const handleAddHistorico = async () => {
      const valor = parseInt((novoHist.valor || '0').replace(/\D/g, '')) / 100;
      const aporte = parseInt((novoHist.aporte || '0').replace(/\D/g, '')) / 100;
      try {
         await investimentoService.registrarSaldoMensal({
            cliente_id: clienteId,
            data_historico: novoHist.data,
            valor_patrimonio: valor,
            valor_aporte: aporte,
         });
         const hist = await investimentoService.getHistoricoMensal(clienteId);
         setHistorico(hist || []);
         setNovoHist({ data: new Date().toISOString().split('T')[0], valor: '0', aporte: '0' });
      } catch { alert('Erro ao registrar histórico.'); }
   };

   const selectCls = 'w-full px-3 h-9 bg-surface-2 border border-subtle rounded-lg font-semibold text-[13px] text-main outline-none focus:border-primary transition-colors';
   const inputCls = 'w-full px-3 h-9 bg-surface-2 border border-subtle rounded-lg font-semibold text-[13px] text-main outline-none focus:border-primary transition-colors';
   const labelCls = 'block text-[11px] font-semibold text-muted mb-1.5';
   const kpiLabel = 'text-[11px] font-semibold text-faint uppercase tracking-wider';
   const cardCls = 'bg-surface rounded-xl border border-subtle p-4';

   const handleHistMoeda = (campo: 'valor' | 'aporte', v: string) => {
      const n = parseInt(v.replace(/\D/g, '') || '0') / 100;
      setNovoHist(p => ({ ...p, [campo]: n.toString() }));
   };

   const formatarMesAno = (meses: number) => {
      if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
      const anos = Math.floor(meses / 12);
      const restoMeses = meses % 12;
      return restoMeses > 0 ? `${anos}a ${restoMeses}m` : `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
   };

   return (
      <div className="space-y-5 animate-fade-in">
         {/* ── Config no topo ── */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className={cardCls}>
               <span className={kpiLabel}>Aporte Mensal Projetado</span>
               <p className="text-[22px] font-bold text-main tracking-tight leading-none mt-2">{formatarMoeda(cliente?.aporte_mensal || 0)}</p>
            </div>
            <div className={cardCls}>
               <label className={kpiLabel}>Modelo de Alocação</label>
               <select value={cliente?.estrategia_padrao_id || ''} onChange={e => handleUpdatePerfil('estrategia_padrao_id', e.target.value)} className={`${selectCls} mt-2`}>
                  <option value="">Selecione...</option>
                  {modelosDisponiveis.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
               </select>
            </div>
            <div className={cardCls}>
               <label className={kpiLabel}>Tese de Investimentos</label>
               <select value={cliente?.tese_investimento_id || ''} onChange={e => handleUpdatePerfil('tese_investimento_id', e.target.value)} className={`${selectCls} mt-2`}>
                  <option value="">Selecione...</option>
                  {tesesDisponiveis.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
               </select>
            </div>
            <button onClick={() => setDrawerContas(true)} className={`${cardCls} flex items-center justify-between text-left hover:border-strong transition-colors`}>
               <div>
                  <span className={kpiLabel}>Contas e Instituições</span>
                  <p className="text-[14px] font-semibold text-main mt-2">{bancosSelecionados.length} habilitada(s)</p>
               </div>
               <Settings size={18} className="text-faint" />
            </button>
         </div>

         {/* ── 1. Reserva de Emergência ── */}
         <div className={cardCls}>
            <div className="flex items-center gap-2 mb-4">
               <ShieldCheck size={16} className="text-[color:var(--primary)]" />
               <h3 className="text-[13px] font-semibold text-main">Reserva de Emergência</h3>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
               <div>
                  <span className={kpiLabel}>Montante atual</span>
                  <p className="text-[22px] font-bold text-main tracking-tight leading-none mt-1">{formatarMoeda(reservaAtual)}</p>
               </div>
               <div className="text-right">
                  <span className={kpiLabel}>Alvo recomendado</span>
                  <p className="text-[16px] font-semibold text-muted leading-none mt-1">{formatarMoeda(cliente?.reserva_recomendada || 0)}</p>
                  <p className="text-[10px] text-faint mt-1">Definido em Proteção</p>
               </div>
            </div>
            <div className="mt-4 space-y-1.5">
               <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percReserva}%`, backgroundColor: percReserva < 100 ? 'var(--warning)' : 'var(--primary)' }} />
               </div>
               <div className="flex justify-between text-[11px] font-medium">
                  <span className="text-faint">Segurança do planejamento</span>
                  <span style={{ color: percReserva < 100 ? 'var(--warning)' : 'var(--primary)' }}>{percReserva.toFixed(0)}%</span>
               </div>
            </div>
         </div>

         {/* ── 2. Objetivos ── */}
         <div className={cardCls}>
            <div className="flex items-center gap-2 mb-4">
               <Target size={16} className="text-[color:var(--info)]" />
               <h3 className="text-[13px] font-semibold text-main">Objetivos</h3>
            </div>
            {projetos.length === 0 ? (
               <p className="text-[12px] text-faint py-4 text-center">Nenhum objetivo mapeado.</p>
            ) : (
               <div className="space-y-4">
                  {projetos.slice(0, 4).map(p => {
                     const acumulado = calcularAcumuladoProjeto(p.id);
                     const perc = p.valor_alvo > 0 ? Math.min((acumulado / p.valor_alvo) * 100, 100) : 0;
                     return (
                        <div key={p.id}>
                           <div className="flex justify-between items-end mb-1.5">
                              <div>
                                 <p className="text-[13px] font-semibold text-main">{p.nome}</p>
                                 <span className="text-[11px] text-faint">Meta: {formatarMoeda(p.valor_alvo)} · {new Date(p.data_alvo).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <span className="text-[12px] font-semibold text-main">{perc.toFixed(0)}%</span>
                           </div>
                           <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${perc}%`, backgroundColor: 'var(--info)' }} />
                           </div>
                        </div>
                     );
                  })}
               </div>
            )}
         </div>

         {/* ── 3. Independência Financeira ── */}
         <div className={cardCls}>
            <div className="flex items-center justify-between mb-4">
               <div>
                  <h3 className="text-[13px] font-semibold text-main">Independência Financeira</h3>
                  <p className="text-[11px] text-faint mt-0.5">
                     Patrimônio alocado: <span className="text-muted font-semibold">{formatarMoeda(indepInfo.total)}</span> ·
                     Capital de liberdade: <span className="text-muted font-semibold">{formatarMoeda(projecao.patrimonioNecessario)}</span> ·
                     Alvo: <span className="text-muted font-semibold">{projecao.dataAlvo.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase()}</span>
                  </p>
               </div>
               <button onClick={() => setDrawerPremissas(true)} className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors">
                  <SlidersHorizontal size={14} /> Premissas
               </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* Barras: alvo (desbotado) vs atual (cor padrão) */}
               <div>
                  <p className={`${kpiLabel} mb-2`}>Alocação · alvo vs carteira</p>
                  <div className="h-[240px]">
                     {barData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center text-faint text-[12px] px-4">
                           Selecione um Modelo de Alocação para comparar a carteira.
                        </div>
                     ) : (
                        <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                              <XAxis dataKey="classe" axisLine={false} tickLine={false} tick={axisTick} dy={8} />
                              <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(v) => `${v}%`} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                              <Legend content={() => (
                                 <div className="flex justify-center gap-4 mt-2">
                                    <span className="flex items-center gap-1.5 text-[11px] text-muted"><span className="h-2 w-2 rounded-full bg-[color:var(--text-faint)] opacity-50" /> Alvo (modelo)</span>
                                    <span className="flex items-center gap-1.5 text-[11px] text-muted"><span className="h-2 w-2 rounded-full bg-[color:var(--primary)]" /> Carteira</span>
                                 </div>
                              )} />
                              <Bar dataKey="alvo" name="Alvo" radius={[3, 3, 0, 0]} barSize={14} fillOpacity={0.32}>
                                 {barData.map((d: any, i: number) => <Cell key={i} fill={d.cor} />)}
                              </Bar>
                              <Bar dataKey="atual" name="Carteira" radius={[3, 3, 0, 0]} barSize={14}>
                                 {barData.map((d: any, i: number) => <Cell key={i} fill={d.cor} />)}
                              </Bar>
                           </BarChart>
                        </ResponsiveContainer>
                     )}
                  </div>
               </div>

               {/* Projeção: área (real) + linha (plano) */}
               <div>
                  <p className={`${kpiLabel} mb-2`}>Curva de liberdade · real vs plano</p>
                  <div className="h-[240px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={projecao.chartData} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                           <defs>
                              <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                                 <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                              </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                           <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} dy={8} />
                           <YAxis hide domain={[0, 'dataMax + 100000']} />
                           <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [formatarMoeda(v), 'Patrimônio']} />
                           <ReferenceLine y={projecao.patrimonioNecessario} stroke="#3a4254" strokeDasharray="5 5" />
                           <Line type="monotone" dataKey="plano" name="Plano" stroke="#6b7280" strokeWidth={2} dot={false} />
                           <Area type="monotone" dataKey="real" name="Real + Projeção" stroke="var(--primary)" strokeWidth={2.5} fill="url(#gradReal)" connectNulls />
                        </ComposedChart>
                     </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-faint text-center mt-1">{historico.length} ponto(s) de patrimônio mensal registrados</p>
               </div>
            </div>

            {/* Prazo planejado vs. atualizado + rentabilidade realizada */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-subtle">
               <div className="flex items-center gap-2.5">
                  <Clock size={15} className="text-faint shrink-0" />
                  <div>
                     <p className={kpiLabel}>Prazo planejado inicial</p>
                     <p className="text-[14px] font-semibold text-main">{formatarMesAno(prazoInfo.prazoInicialMeses)}</p>
                  </div>
               </div>
               <div className="flex items-center gap-2.5">
                  <Clock size={15} className="shrink-0" style={{ color: 'var(--primary)' }} />
                  <div>
                     <p className={kpiLabel}>Prazo atualizado</p>
                     <p className="text-[14px] font-semibold" style={{ color: 'var(--primary)' }}>
                        {prazoInfo.prazoAtualizadoMeses === null ? 'Não atingível com os parâmetros atuais' : formatarMesAno(prazoInfo.prazoAtualizadoMeses)}
                     </p>
                  </div>
               </div>
               <div className="flex items-center gap-2.5">
                  <TrendingUp size={15} className="text-[color:var(--info)] shrink-0" />
                  <div>
                     <p className={kpiLabel}>Rentabilidade real da carteira</p>
                     <p className="text-[14px] font-semibold text-main">
                        {prazoInfo.rentabilidadeRealAnual === null ? '— (histórico insuficiente)' : `${prazoInfo.rentabilidadeRealAnual.toFixed(1)}% a.a.`}
                     </p>
                  </div>
               </div>
            </div>
         </div>

         {/* ── Drawer: Contas e Instituições ── */}
         <SidePanel open={drawerContas} onClose={() => setDrawerContas(false)} title="Contas e Instituições" subtitle="Habilite as instituições sugeridas no protocolo de aporte">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
               {bancosDisponiveis.map(b => {
                  const isSelected = bancosSelecionados.includes(b.nome);
                  return (
                     <label key={b.id} className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-surface-2 border-strong' : 'border-subtle hover:bg-surface-2'}`}>
                        <input type="checkbox" checked={isSelected} onChange={e => {
                           const newList = e.target.checked ? [...bancosSelecionados, b.nome] : bancosSelecionados.filter((x: string) => x !== b.nome);
                           handleUpdatePerfil('bancos_ativos', newList);
                        }} className="h-4 w-4 accent-[color:var(--primary)]" />
                        <span className={`text-[13px] font-medium ${isSelected ? 'text-main' : 'text-muted'}`}>{b.nome}</span>
                     </label>
                  );
               })}
               {bancosDisponiveis.length === 0 && <p className="text-[12px] text-faint">Nenhuma instituição cadastrada em Configurações.</p>}
            </div>
         </SidePanel>

         {/* ── Drawer: Premissas de Independência ── */}
         <SidePanel
            open={drawerPremissas}
            onClose={() => setDrawerPremissas(false)}
            title="Premissas de Independência"
            subtitle="Parâmetros da projeção e histórico de patrimônio"
            footer={<Button variant="primary" className="w-full" isLoading={savingPrem} onClick={handleSalvarPremissas}>Salvar premissas</Button>}
         >
            <div className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className={labelCls}>Renda alvo/mês</label>
                     <input className={inputCls} value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(premissas.renda_alvo)} onChange={e => setPremissas(p => ({ ...p, renda_alvo: parseInt(e.target.value.replace(/\D/g, '') || '0') / 100 }))} />
                  </div>
                  <div>
                     <label className={labelCls}>Taxa real (% a.a.)</label>
                     <input type="number" step="0.1" className={inputCls} value={premissas.taxa_real_anual} onChange={e => setPremissas(p => ({ ...p, taxa_real_anual: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                     <label className={labelCls}>Patrimônio inicial</label>
                     <input className={`${inputCls} opacity-70 cursor-not-allowed`} disabled value={formatarMoeda(premissasEfetivas.patrimonio_inicial)} />
                     <p className="text-[10px] text-faint mt-1">Vinculado ao cadastro do cliente</p>
                  </div>
                  <div>
                     <label className={labelCls}>Aporte mensal</label>
                     <input className={`${inputCls} opacity-70 cursor-not-allowed`} disabled value={formatarMoeda(premissasEfetivas.aporte_mensal)} />
                     <p className="text-[10px] text-faint mt-1">Vinculado ao cadastro do cliente</p>
                  </div>
                  <div>
                     <label className={labelCls}>Prazo (anos)</label>
                     <input type="number" className={inputCls} value={premissas.prazo_anos} onChange={e => setPremissas(p => ({ ...p, prazo_anos: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div>
                     <label className={labelCls}>Início</label>
                     <input type="date" className={inputCls} value={premissas.data_inicio} onChange={e => setPremissas(p => ({ ...p, data_inicio: e.target.value }))} />
                  </div>
               </div>

               <div className="pt-4 border-t border-subtle">
                  <h4 className="text-[12px] font-semibold text-main mb-1">Inserir histórico mensal (manual)</h4>
                  <p className="text-[10px] text-faint mb-3">Registre o patrimônio do mês e, se houver, o aporte realizado no período.</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                     <div>
                        <label className={labelCls}>Data</label>
                        <input type="date" className={inputCls} value={novoHist.data} onChange={e => setNovoHist(p => ({ ...p, data: e.target.value }))} />
                     </div>
                     <div>
                        <label className={labelCls}>Patrimônio (independência)</label>
                        <input className={inputCls} value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(parseFloat(novoHist.valor || '0'))} onChange={e => handleHistMoeda('valor', e.target.value)} />
                     </div>
                  </div>
                  <div className="flex items-end gap-2">
                     <div className="flex-1">
                        <label className={labelCls}>Aporte do período</label>
                        <input className={inputCls} value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(parseFloat(novoHist.aporte || '0'))} onChange={e => handleHistMoeda('aporte', e.target.value)} />
                     </div>
                     <button onClick={handleAddHistorico} className="h-9 w-9 flex items-center justify-center rounded-lg bg-[color:var(--primary)] text-[#0b0e14] shrink-0" title="Registrar"><Plus size={16} /></button>
                  </div>
                  {historico.length > 0 && (
                     <div className="mt-3 max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                        {[...historico].reverse().map(h => (
                           <div key={h.id} className="flex justify-between items-center text-[12px] px-2 py-1.5 rounded-lg bg-surface-2">
                              <span className="text-muted">{new Date(h.data_historico).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</span>
                              <span className="text-right">
                                 <span className="text-main font-semibold">{formatarMoeda(Number(h.valor_patrimonio))}</span>
                                 {Number(h.valor_aporte) > 0 && (
                                    <span className="text-faint ml-1.5">· aporte {formatarMoeda(Number(h.valor_aporte))}</span>
                                 )}
                              </span>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
         </SidePanel>
      </div>
   );
};

export default ResumoInvestimentos;
