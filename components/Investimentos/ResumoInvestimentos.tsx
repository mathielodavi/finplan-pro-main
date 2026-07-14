
import React, { useState, useEffect, useMemo } from 'react';
import {
   BarChart, Bar, Cell, ComposedChart, Area, Line, XAxis, YAxis,
   CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, Legend
} from 'recharts';
import { formatarMoeda } from '../../utils/formatadores';
import { atualizarCliente } from '../../services/clienteService';
import { investimentoService, PremissasIndependencia, HistoricoPatrimonio } from '../../services/investimentoService';
import { configService } from '../../services/configuracoesService';
import { protecaoService } from '../../services/protecaoService';
import { calcularIdade } from '../../utils/calculosFinanceiros';
import { projetarIndependencia, calcularPrazoERentabilidade, calcularAporteNecessario, construirTabelaRentabilidade } from '../../utils/independenciaUtils';
import { CHART_GRID, CHART_COLORS, axisTick, tooltipStyle, tooltipCursor } from '../../utils/chartTheme';
import SidePanel from '../UI/SidePanel';
import Button from '../UI/Button';
import ObjetivoFormDrawer from './ObjetivoFormDrawer';
import { ShieldCheck, Target, Settings, SlidersHorizontal, Plus, TrendingUp, Clock, Bird } from 'lucide-react';
import { toast } from '../../utils/toast';

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const formatarPercentual = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

const ResumoInvestimentos = ({ clienteId, ativos, cliente, onRefresh, onNavigateAportes }: any) => {
   const [drawerContas, setDrawerContas] = useState(false);
   const [drawerPremissas, setDrawerPremissas] = useState(false);
   const [drawerObjetivo, setDrawerObjetivo] = useState(false);
   const [drawerRentabilidade, setDrawerRentabilidade] = useState(false);
   const [editObjetivo, setEditObjetivo] = useState<any>(null);
   const [projetos, setProjetos] = useState<any[]>([]);
   const [modelosDisponiveis, setModelosDisponiveis] = useState<any[]>([]);
   const [tesesDisponiveis, setTesesDisponiveis] = useState<any[]>([]);
   const [bancosDisponiveis, setBancosDisponiveis] = useState<any[]>([]);
   const [historico, setHistorico] = useState<HistoricoPatrimonio[]>([]);
   const [savingPrem, setSavingPrem] = useState(false);
   const [idadeCliente, setIdadeCliente] = useState<number | null>(null);
   const [taxaRentabilizacao, setTaxaRentabilizacao] = useState(6.25);

   // Controles do gráfico de independência (paridade com o simulador de referência)
   const [zoom, setZoom] = useState<'2' | '5' | '10' | 'max'>('max');
   const [negativos, setNegativos] = useState(false);
   // Cópia de trabalho das premissas enquanto o drawer simula ao vivo (null = sem simulação ativa)
   const [simulacao, setSimulacao] = useState<PremissasIndependencia | null>(null);
   const [premSalvas, setPremSalvas] = useState(false);

   const [premissas, setPremissas] = useState<PremissasIndependencia>({
      cliente_id: clienteId,
      renda_alvo: 10000,
      taxa_real_anual: 6,
      patrimonio_inicial: cliente?.patrimonio_total || 0,
      aporte_mensal: cliente?.aporte_mensal || 0,
      prazo_anos: 20,
      data_inicio: new Date().toISOString().split('T')[0],
      outras_fontes_renda: 0,
      taxa_pos_aposentadoria: null,
   });

   const loadProjetos = async () => {
      try {
         const projData = await investimentoService.getProjetos(clienteId);
         setProjetos(projData || []);
      } catch (err) { console.error('Erro ao recarregar objetivos:', err); }
   };

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
            const [premData, histData, dataNascimento, parametros] = await Promise.all([
               investimentoService.getPremissasIndependencia(clienteId),
               investimentoService.getHistoricoMensal(clienteId),
               protecaoService.getDataNascimentoCliente(clienteId),
               protecaoService.getParametros(),
            ]);
            setHistorico(histData || []);
            setIdadeCliente(calcularIdade(dataNascimento || undefined));
            setTaxaRentabilizacao(Number(parametros.taxa_juros_aa) || 6.25);
            if (premData) {
               setPremissas({
                  ...premData,
                  renda_alvo: Number(premData.renda_alvo),
                  taxa_real_anual: Number(premData.taxa_real_anual),
                  patrimonio_inicial: Number(premData.patrimonio_inicial),
                  aporte_mensal: Number(premData.aporte_mensal),
                  prazo_anos: Number(premData.prazo_anos),
                  outras_fontes_renda: Number(premData.outras_fontes_renda) || 0,
                  taxa_pos_aposentadoria: premData.taxa_pos_aposentadoria !== null && premData.taxa_pos_aposentadoria !== undefined ? Number(premData.taxa_pos_aposentadoria) : null,
               });
               setPremSalvas(true);
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

   // Patrimônio financeiro total do cliente — soma de TODOS os ativos, em todos os objetivos
   // (reserva + projetos + independência). Base do gráfico/KPIs de independência (não apenas a
   // fatia tagueada 'independencia', que segue usada só no comparativo de alocação por classe).
   const patrimonioFinanceiroTotal = useMemo(
      () => (ativos || []).reduce((acc: number, a: any) => acc + (a.valor_atual || 0), 0),
      [ativos]
   );

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

   // Patrimônio inicial sempre vinculado ao cadastro do cliente. O aporte mensal é editável
   // via premissas (sincronizado com o cadastro ao salvar); antes da primeira gravação, é
   // semeado do cadastro. Durante a simulação (drawer aberto), `simulacao` tem precedência.
   const premissasEfetivas = useMemo(() => {
      const base = simulacao ?? premissas;
      return {
         ...base,
         patrimonio_inicial: cliente?.patrimonio_total || 0,
         aporte_mensal: simulacao
            ? simulacao.aporte_mensal
            : (premSalvas ? premissas.aporte_mensal : (cliente?.aporte_mensal || 0)),
      };
   }, [simulacao, premissas, premSalvas, cliente?.patrimonio_total, cliente?.aporte_mensal]);

   // Taxa pós-aposentadoria: específica do cliente (premissas) quando definida, senão o padrão
   // do escritório (Configurações > Investimentos > Parâmetros).
   const taxaPosAposentadoriaEfetiva = premissasEfetivas.taxa_pos_aposentadoria ?? taxaRentabilizacao;

   // Saques programados: Objetivos (Projetos) com data-alvo futura subtraem o valor_alvo planejado
   // da curva na data prevista — a curva representa o patrimônio TOTAL, então a realização de um
   // objetivo (ex.: "Viagem Anual") deve aparecer como uma queda visível, não some silenciosamente.
   const eventosSaque = useMemo(() => {
      const dataInicio = new Date(premissasEfetivas.data_inicio);
      return (projetos || [])
         .filter((p: any) => p.data_alvo && p.valor_alvo > 0)
         .map((p: any) => {
            const dataAlvo = new Date(p.data_alvo);
            const mes = Math.round((dataAlvo.getFullYear() - dataInicio.getFullYear()) * 12 + (dataAlvo.getMonth() - dataInicio.getMonth()));
            return { mes, valor: p.valor_alvo };
         });
   }, [projetos, premissasEfetivas.data_inicio]);

   const prazoInfo = useMemo(
      () => calcularPrazoERentabilidade(premissasEfetivas, historico),
      [premissasEfetivas, historico]
   );

   const projecao = useMemo(
      () => projetarIndependencia(premissasEfetivas, patrimonioFinanceiroTotal, historico, {
         consumo: { idadeAtual: idadeCliente, taxaRentabilizacaoAnual: taxaPosAposentadoriaEfetiva },
         realizado: prazoInfo,
         permitirNegativos: negativos,
         eventosSaque,
      }),
      [premissasEfetivas, patrimonioFinanceiroTotal, historico, idadeCliente, taxaPosAposentadoriaEfetiva, prazoInfo, negativos, eventosSaque]
   );

   // ─── Derivados do simulador (idade, callout de reenquadramento, janela de zoom) ──────────
   const idadeNaDataInicio = idadeCliente !== null ? idadeCliente - projecao.mesesAteHoje / 12 : null;
   const idadeAlvo = idadeNaDataInicio !== null ? Math.round(idadeNaDataInicio + premissasEfetivas.prazo_anos) : null;
   const mesesRestantes = premissasEfetivas.prazo_anos * 12 - projecao.mesesAteHoje;
   // Saques programados que acontecem antes da data-alvo entram no aporte necessário (o valor
   // sacado para o objetivo precisa ser reposto com juros até a aposentadoria).
   const saquesAntesDaMeta = eventosSaque
      .map(e => ({ mesesAteSaque: e.mes - projecao.mesesAteHoje, valor: e.valor }))
      .filter(s => s.mesesAteSaque > 0 && s.mesesAteSaque <= mesesRestantes);
   const aporteNecessario = calcularAporteNecessario(patrimonioFinanceiroTotal, projecao.patrimonioNecessario, mesesRestantes, premissasEfetivas.taxa_real_anual, saquesAntesDaMeta);
   const gapAporte = aporteNecessario !== null ? aporteNecessario - premissasEfetivas.aporte_mensal : null;

   const tabelaRentabilidade = useMemo(() => construirTabelaRentabilidade(historico), [historico]);

   const dadosVisiveis = useMemo(() => {
      if (zoom === 'max') return projecao.chartData;
      const inicioJanela = Math.max(0, projecao.mesesAteHoje - 12);
      const limiteMes = projecao.mesesAteHoje + Number(zoom) * 12;
      return projecao.chartData.filter(p => p.mes >= inicioJanela && p.mes <= limiteMes);
   }, [projecao, zoom]);

   // Teto do slider de aporte fixado no valor oficial (não no simulado), para não "fugir" durante o arraste
   const aporteSliderMax = Math.max((premSalvas ? premissas.aporte_mensal : (cliente?.aporte_mensal || 0)) * 3, 10000);

   const mesVisivel = (mes: number | null): boolean => {
      if (mes === null || dadosVisiveis.length === 0) return false;
      return mes >= dadosVisiveis[0].mes && mes <= dadosVisiveis[dadosVisiveis.length - 1].mes;
   };

   const calcularAcumuladoProjeto = (projetoId: string) => (ativos || []).reduce((acc: number, a: any) => {
      const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'projeto' && o.projeto_id === projetoId);
      return acc + (link ? a.valor_atual * (link.percentual / 100) : 0);
   }, 0);

   const totalAcumuladoObjetivos = useMemo(
      () => projetos.reduce((acc, p) => acc + calcularAcumuladoProjeto(p.id), 0),
      [projetos, ativos]
   );
   const totalAlvoObjetivos = useMemo(() => projetos.reduce((acc, p) => acc + (p.valor_alvo || 0), 0), [projetos]);

   const handleUpdatePerfil = async (key: string, value: any) => {
      const finalValue = key === 'bancos_ativos' ? (value as string[]).join(',') : value;
      await atualizarCliente(cliente.id, { [key]: finalValue });
      onRefresh();
   };

   const bancosSelecionados = useMemo(
      () => cliente?.bancos_ativos ? cliente.bancos_ativos.split(',').filter(Boolean) : [],
      [cliente?.bancos_ativos]
   );

   const abrirPremissas = () => {
      setSimulacao({ ...premissasEfetivas });
      setDrawerPremissas(true);
   };

   const fecharPremissas = () => {
      setDrawerPremissas(false);
      setSimulacao(null); // descarta a simulação não salva — o gráfico reverte
   };

   const handleSalvarPremissas = async () => {
      if (!simulacao) return;
      setSavingPrem(true);
      try {
         await investimentoService.salvarPremissasIndependencia({ ...simulacao, patrimonio_inicial: cliente?.patrimonio_total || 0 });
         await atualizarCliente(cliente.id, { aporte_mensal: simulacao.aporte_mensal });
         setPremissas(simulacao);
         setPremSalvas(true);
         setSimulacao(null);
         setDrawerPremissas(false);
         onRefresh();
      } catch { toast.error('Erro ao salvar premissas.'); }
      finally { setSavingPrem(false); }
   };

   const selectCls = 'w-full px-3 h-9 bg-surface-2 border border-subtle rounded-lg font-semibold text-[13px] text-main outline-none focus:border-primary transition-colors';
   const inputCls = 'w-full px-3 h-9 bg-surface-2 border border-subtle rounded-lg font-semibold text-[13px] text-main outline-none focus:border-primary transition-colors';
   const labelCls = 'block text-[11px] font-semibold text-muted mb-1.5';
   const kpiLabel = 'text-[11px] font-semibold text-faint uppercase tracking-wider';
   const cardCls = 'bg-surface rounded-xl border border-subtle p-4';

   // Eixo X numérico (meses desde data_inicio) → idade do cliente quando conhecida, senão MMM/YY
   const mesParaData = (mes: number): Date => {
      const d = new Date(premissasEfetivas.data_inicio);
      d.setMonth(d.getMonth() + mes);
      return d;
   };
   const fmtMesAnoCurto = (d: Date) => `${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()}/${String(d.getFullYear()).slice(-2)}`;
   // Em janelas curtas (< 6 anos) a idade repetiria nos ticks — usa MMM/YY nesses casos
   const spanVisivelMeses = dadosVisiveis.length > 1 ? dadosVisiveis[dadosVisiveis.length - 1].mes - dadosVisiveis[0].mes : 0;
   const formatarTickEixo = (mes: number) => {
      if (idadeNaDataInicio !== null && spanVisivelMeses >= 72) return `${Math.floor(idadeNaDataInicio + mes / 12)}`;
      return fmtMesAnoCurto(mesParaData(mes));
   };
   const formatarLabelTooltip = (mes: number) => {
      const d = mesParaData(mes);
      const texto = `${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${d.getFullYear()}`;
      const capitalizado = texto.charAt(0).toUpperCase() + texto.slice(1);
      return idadeNaDataInicio !== null ? `${capitalizado} · ${Math.floor(idadeNaDataInicio + mes / 12)} anos` : capitalizado;
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
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className={cardCls}>
               <span className={kpiLabel}>Patrimônio Financeiro Total</span>
               <p className="text-[22px] font-bold text-main tracking-tight leading-none mt-2">{formatarMoeda(patrimonioFinanceiroTotal)}</p>
            </div>
            <div className={cardCls}>
               <span className={kpiLabel}>Aporte Mensal Projetado</span>
               <p className="text-[22px] font-bold text-main tracking-tight leading-none mt-2">{formatarMoeda(cliente?.aporte_mensal || 0)}</p>
               {gapAporte !== null && (
                  <span
                     className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                     style={gapAporte <= 0
                        ? { color: 'var(--primary)', backgroundColor: 'rgba(16,185,129,0.12)' }
                        : { color: 'var(--warning)', backgroundColor: 'rgba(251,191,36,0.12)' }}
                  >
                     {gapAporte <= 0 ? `Acima da meta (+${formatarMoeda(Math.abs(gapAporte))})` : `Faltam ${formatarMoeda(gapAporte)}/mês`}
                  </span>
               )}
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
               <h3 className="text-[14px] font-semibold text-main">Reserva de Emergência</h3>
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
            <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-2">
                  <Target size={16} className="text-[color:var(--info)]" />
                  <h3 className="text-[14px] font-semibold text-main">Objetivos</h3>
               </div>
               <button
                  onClick={() => { setEditObjetivo({ nome: '', data_alvo: '', valor_alvo: 0, etapas: [] }); setDrawerObjetivo(true); }}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors"
               >
                  <Plus size={14} /> Adicionar objetivo
               </button>
            </div>
            {projetos.length === 0 ? (
               <p className="text-[12px] text-faint py-4 text-center">Nenhum objetivo mapeado.</p>
            ) : (
               <>
                  <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
                     <div>
                        <span className={kpiLabel}>Total acumulado</span>
                        <p className="text-[22px] font-bold text-main tracking-tight leading-none mt-1">{formatarMoeda(totalAcumuladoObjetivos)}</p>
                     </div>
                     <div className="text-right">
                        <span className={kpiLabel}>Total de metas</span>
                        <p className="text-[16px] font-semibold text-muted leading-none mt-1">{formatarMoeda(totalAlvoObjetivos)}</p>
                     </div>
                  </div>
                  <div className="space-y-4">
                  {projetos.slice(0, 4).map(p => {
                     const acumulado = calcularAcumuladoProjeto(p.id);
                     const perc = p.valor_alvo > 0 ? Math.min((acumulado / p.valor_alvo) * 100, 100) : 0;
                     return (
                        <button
                           key={p.id}
                           type="button"
                           onClick={() => { setEditObjetivo(p); setDrawerObjetivo(true); }}
                           className="w-full text-left group"
                        >
                           <div className="flex justify-between items-end mb-1.5">
                              <div>
                                 <p className="text-[13px] font-semibold text-main group-hover:underline">{p.nome}</p>
                                 <span className="text-[11px] text-faint">Meta: {formatarMoeda(p.valor_alvo)} · {new Date(p.data_alvo).toLocaleDateString('pt-BR')}</span>
                              </div>
                              <span className="text-[12px] font-semibold text-main">{perc.toFixed(0)}%</span>
                           </div>
                           <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${perc}%`, backgroundColor: 'var(--info)' }} />
                           </div>
                        </button>
                     );
                  })}
                  </div>
                  <p className="text-[10px] text-faint mt-4 pt-3 border-t border-subtle">
                     Um objetivo com data-alvo futura já é descontado automaticamente do gráfico de Independência na data prevista.
                     Se um objetivo for realizado (saque efetivo), registre um lançamento em Histórico de Aportes próximo à data — sem isso, a queda pode ficar diluída no cálculo de rentabilidade do mês.
                  </p>
               </>
            )}
         </div>

         <ObjetivoFormDrawer
            open={drawerObjetivo}
            onClose={() => setDrawerObjetivo(false)}
            editProjeto={editObjetivo}
            setEditProjeto={setEditObjetivo}
            ativos={ativos}
            clienteId={clienteId}
            onSaved={loadProjetos}
         />

         {/* ── 3. Independência Financeira ── */}
         <div className={cardCls}>
            <div className="flex items-center justify-between mb-4">
               <div>
                  <div className="flex items-center gap-2">
                     <Bird size={16} className="text-[color:var(--primary)]" />
                     <h3 className="text-[14px] font-semibold text-main">Independência Financeira</h3>
                  </div>
                  <p className="text-[11px] text-faint mt-0.5">
                     Patrimônio total: <span className="text-muted font-semibold">{formatarMoeda(patrimonioFinanceiroTotal)}</span> ·
                     Capital de liberdade: <span className="text-muted font-semibold">{formatarMoeda(projecao.patrimonioNecessario)}</span> ·
                     Alvo: <span className="text-muted font-semibold">{idadeAlvo !== null ? `${idadeAlvo} anos` : projecao.dataAlvo.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase()}</span>
                     {premissasEfetivas.outras_fontes_renda > 0 && (
                        <> · Renda líquida alvo: <span className="text-muted font-semibold">{formatarMoeda(projecao.rendaLiquidaMensal)}/mês</span></>
                     )}
                  </p>
               </div>
               <button onClick={abrirPremissas} className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors">
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
                              <Tooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
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

               {/* Projeção: área (realizado + forward com dados apurados) vs linha (plano ideal) */}
               <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                     <p className={kpiLabel}>Curva de Independência · plano vs realizado</p>
                     <div className="flex items-center gap-1">
                        {(['2', '5', '10', 'max'] as const).map(z => (
                           <button
                              key={z}
                              onClick={() => setZoom(z)}
                              className={`px-2 h-6 rounded-md text-[11px] font-semibold transition-colors ${zoom === z ? 'bg-surface-2 text-main' : 'text-faint hover:text-muted'}`}
                           >
                              {z === 'max' ? 'Máximo' : `${z} anos`}
                           </button>
                        ))}
                        <button
                           onClick={() => setNegativos(n => !n)}
                           className={`px-2 h-6 rounded-md text-[11px] font-semibold transition-colors ml-1 ${negativos ? 'bg-surface-2 text-[color:var(--warning)]' : 'text-faint hover:text-muted'}`}
                           title="Exibir déficit (valores negativos) após o esgotamento do patrimônio"
                        >
                           Negativos
                        </button>
                     </div>
                  </div>
                  <div className="h-[240px]">
                     <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={dadosVisiveis} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
                           <defs>
                              <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                                 <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                              </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                           <XAxis
                              dataKey="mes"
                              type="number"
                              domain={['dataMin', 'dataMax']}
                              tickCount={8}
                              axisLine={false}
                              tickLine={false}
                              tick={axisTick}
                              dy={8}
                              tickFormatter={formatarTickEixo}
                           />
                           <YAxis hide domain={[negativos ? 'auto' : 0, 'dataMax + 100000']} />
                           <Tooltip
                              contentStyle={tooltipStyle}
                              cursor={{ stroke: '#454c63', strokeWidth: 1 }}
                              labelFormatter={(mes: any) => formatarLabelTooltip(Number(mes))}
                              formatter={(v: any, name: any) => [formatarMoeda(v), name]}
                           />
                           <Legend content={() => (
                              <div className="flex justify-center flex-wrap gap-4 mt-2">
                                 <span className="flex items-center gap-1.5 text-[11px] text-muted"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS.warning }} /> Aposentadoria ideal</span>
                                 <span className="flex items-center gap-1.5 text-[11px] text-muted"><span className="h-2 w-2 rounded-full bg-[color:var(--primary)]" /> Patrimônio real</span>
                              </div>
                           )} />
                           {negativos && <ReferenceLine y={0} stroke="#454c63" />}
                           <ReferenceLine y={projecao.patrimonioNecessario} stroke="#3a4254" strokeDasharray="5 5" />
                           <Line type="monotone" dataKey="plano" name="Aposentadoria ideal" stroke={CHART_COLORS.warning} strokeWidth={2} dot={false} />
                           <Area type="monotone" dataKey="real" name="Patrimônio real" stroke="var(--primary)" strokeWidth={2.5} fill="url(#gradReal)" connectNulls />
                           {/* Marcadores sem rótulo fixo — as informações aparecem no Tooltip ao passar o mouse */}
                           {mesVisivel(projecao.mesesAteHoje) && (
                              <ReferenceDot x={projecao.mesesAteHoje} y={patrimonioFinanceiroTotal} r={4} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} isFront />
                           )}
                           {mesVisivel(projecao.mesIndependenciaPlano) && (
                              <ReferenceDot x={projecao.mesIndependenciaPlano!} y={projecao.valorIndependenciaPlano ?? projecao.patrimonioNecessario} r={4} fill={CHART_COLORS.warning} stroke="var(--surface)" strokeWidth={2} isFront />
                           )}
                           {mesVisivel(projecao.mesIndependenciaReal) && (
                              <ReferenceDot x={projecao.mesIndependenciaReal!} y={projecao.valorIndependenciaReal ?? projecao.patrimonioNecessario} r={5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} isFront />
                           )}
                        </ComposedChart>
                     </ResponsiveContainer>
                  </div>
                  <p className="text-[11px] text-faint text-center mt-1">{historico.length} ponto(s) de patrimônio mensal registrados</p>
                  {idadeCliente === null && (
                     <p className="text-[11px] text-center mt-1" style={{ color: 'var(--warning)' }}>
                        Cadastre a data de nascimento em Proteção para ver o eixo por idade e simular o consumo de patrimônio até os 90 anos.
                     </p>
                  )}
               </div>
            </div>

            {/* Rodapé: reenquadramento (aporte necessário) + prazo/rentabilidade — um único bloco coeso */}
            <div className="mt-4 p-4 rounded-lg bg-surface-2 border border-subtle">
               {aporteNecessario === null ? (
                  <p className="text-[12px] text-muted text-center">
                     O prazo alvo já decorreu — ajuste as premissas (prazo ou idade de aposentadoria) para recalcular o plano.
                  </p>
               ) : (
                  <p className="text-[12px] text-muted text-center">
                     Você precisa investir <span className="font-semibold text-main">{formatarMoeda(aporteNecessario)}/mês</span> para
                     se aposentar {idadeAlvo !== null ? `aos ${idadeAlvo} anos` : `em ${projecao.dataAlvo.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`} com
                     <span className="font-semibold text-main"> {formatarMoeda(projecao.patrimonioNecessario)}</span> acumulados.
                  </p>
               )}

               {/* Prazo planejado vs. atualizado + rentabilidade realizada */}
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-subtle">
                  <div className="flex items-center gap-2.5">
                     <Clock size={15} className="text-faint shrink-0" />
                     <div>
                        <p className={kpiLabel}>Prazo planejado inicial</p>
                        <p className="text-[14px] font-semibold text-main">{formatarMesAno(prazoInfo.prazoInicialMeses)}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2.5" title="Primeiro mês em que o patrimônio projetado sustenta a renda desejada até os 90 anos, já considerando os saques de objetivos programados — mesmo ponto marcado no gráfico">
                     <Clock size={15} className="shrink-0" style={{ color: 'var(--primary)' }} />
                     <div>
                        <p className={kpiLabel}>Prazo atualizado</p>
                        <p className="text-[14px] font-semibold" style={{ color: 'var(--primary)' }}>
                           {projecao.mesIndependenciaReal === null ? 'Não atingível' : formatarMesAno(projecao.mesIndependenciaReal)}
                        </p>
                     </div>
                  </div>
                  <button type="button" onClick={() => setDrawerRentabilidade(true)} className="flex items-center gap-2.5 text-left group">
                     <TrendingUp size={15} className="text-[color:var(--info)] shrink-0" />
                     <div>
                        <p className={kpiLabel}>Rentabilidade real da carteira</p>
                        <p className="text-[14px] font-semibold text-main group-hover:underline">
                           {prazoInfo.rentabilidadeRealAnual === null ? '— (histórico insuficiente)' : `${prazoInfo.rentabilidadeRealAnual.toFixed(1)}% a.a.`}
                           <span className="text-[11px] font-medium text-faint ml-1">· ver detalhamento</span>
                        </p>
                     </div>
                  </button>
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

         {/* ── Drawer: Premissas de Independência (simulação ao vivo — o gráfico reage a cada ajuste) ── */}
         <SidePanel
            open={drawerPremissas}
            onClose={fecharPremissas}
            title="Premissas de Independência"
            subtitle="Ajuste e veja o gráfico reagir em tempo real — salvar oficializa a meta"
            widthClass="max-w-sm"
            overlay="transparent"
            footer={<Button variant="primary" className="w-full" isLoading={savingPrem} onClick={handleSalvarPremissas}>Salvar meta</Button>}
         >
            {simulacao && (
               <div className="space-y-5">
                  {idadeCliente !== null && idadeNaDataInicio !== null ? (
                     <div>
                        <div className="flex items-center justify-between mb-1.5">
                           <label className={labelCls.replace(' mb-1.5', '')}>Idade de aposentadoria</label>
                           <span className="text-[13px] font-semibold text-main">{Math.round(idadeNaDataInicio + simulacao.prazo_anos)} anos</span>
                        </div>
                        <input
                           type="range"
                           min={idadeCliente + 1}
                           max={90}
                           value={Math.round(idadeNaDataInicio + simulacao.prazo_anos)}
                           onChange={e => setSimulacao(p => ({ ...p!, prazo_anos: Math.max(1, Math.round(Number(e.target.value) - idadeNaDataInicio)) }))}
                           className="w-full accent-[color:var(--primary)]"
                        />
                     </div>
                  ) : (
                     <div>
                        <label className={labelCls}>Prazo (anos)</label>
                        <input type="number" className={inputCls} value={simulacao.prazo_anos} onChange={e => setSimulacao(p => ({ ...p!, prazo_anos: parseInt(e.target.value) || 0 }))} />
                        <p className="text-[10px] mt-1" style={{ color: 'var(--warning)' }}>Cadastre a data de nascimento em Proteção para planejar por idade.</p>
                     </div>
                  )}

                  <div>
                     <label className={labelCls}>Renda desejada/mês</label>
                     <input className={inputCls} value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(simulacao.renda_alvo)} onChange={e => setSimulacao(p => ({ ...p!, renda_alvo: parseInt(e.target.value.replace(/\D/g, '') || '0') / 100 }))} />
                  </div>

                  <div>
                     <label className={labelCls}>Outras fontes de renda/mês</label>
                     <input className={inputCls} value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(simulacao.outras_fontes_renda)} onChange={e => setSimulacao(p => ({ ...p!, outras_fontes_renda: parseInt(e.target.value.replace(/\D/g, '') || '0') / 100 }))} />
                     <p className="text-[10px] text-faint mt-1">INSS, aluguéis, pensões... Abatida da renda desejada.</p>
                  </div>

                  <div>
                     <div className="flex items-center justify-between mb-1.5">
                        <label className={labelCls.replace(' mb-1.5', '')}>Investimento mensal</label>
                        <span className="text-[13px] font-semibold text-main">{formatarMoeda(simulacao.aporte_mensal)}</span>
                     </div>
                     <input
                        type="range"
                        min={0}
                        max={aporteSliderMax}
                        step={100}
                        value={Math.min(simulacao.aporte_mensal, aporteSliderMax)}
                        onChange={e => setSimulacao(p => ({ ...p!, aporte_mensal: Number(e.target.value) }))}
                        className="w-full accent-[color:var(--primary)]"
                     />
                     <input className={`${inputCls} mt-2`} value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(simulacao.aporte_mensal)} onChange={e => setSimulacao(p => ({ ...p!, aporte_mensal: parseInt(e.target.value.replace(/\D/g, '') || '0') / 100 }))} />
                     <p className="text-[10px] text-faint mt-1">Salvar atualiza também o cadastro do cliente.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className={labelCls}>Taxa real acumulação (% a.a.)</label>
                        <input type="number" step="0.1" className={inputCls} value={simulacao.taxa_real_anual} onChange={e => setSimulacao(p => ({ ...p!, taxa_real_anual: parseFloat(e.target.value) || 0 }))} />
                     </div>
                     <div>
                        <label className={labelCls}>Taxa pós-aposentadoria (% a.a.)</label>
                        <input
                           type="number"
                           step="0.1"
                           className={inputCls}
                           value={simulacao.taxa_pos_aposentadoria ?? taxaRentabilizacao}
                           onChange={e => setSimulacao(p => ({ ...p!, taxa_pos_aposentadoria: parseFloat(e.target.value) || 0 }))}
                        />
                        {simulacao.taxa_pos_aposentadoria !== null ? (
                           <button type="button" onClick={() => setSimulacao(p => ({ ...p!, taxa_pos_aposentadoria: null }))} className="text-[10px] text-faint hover:text-muted underline mt-1">
                              Usar padrão do escritório ({taxaRentabilizacao}%)
                           </button>
                        ) : (
                           <p className="text-[10px] text-faint mt-1">Padrão do escritório ({taxaRentabilizacao}%)</p>
                        )}
                     </div>
                     <div>
                        <label className={labelCls}>Patrimônio inicial</label>
                        <input className={`${inputCls} opacity-70 cursor-not-allowed`} disabled value={formatarMoeda(premissasEfetivas.patrimonio_inicial)} />
                        <p className="text-[10px] text-faint mt-1">Vinculado ao cadastro do cliente</p>
                     </div>
                     <div>
                        <label className={labelCls}>Início</label>
                        <input type="date" className={inputCls} value={simulacao.data_inicio} onChange={e => setSimulacao(p => ({ ...p!, data_inicio: e.target.value }))} />
                     </div>
                  </div>

                  <div className="pt-4 border-t border-subtle">
                     <p className="text-[10px] text-faint mb-3">{historico.length} ponto(s) de histórico mensal registrados.</p>
                     <button
                        type="button"
                        onClick={() => { fecharPremissas(); onNavigateAportes?.(); }}
                        className="w-full h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors"
                     >
                        Ver histórico completo (Aporte Mensal)
                     </button>
                  </div>
               </div>
            )}
         </SidePanel>

         {/* ── Drawer: Rentabilidade Mensal (ano × mês, estilo corretora) ── */}
         <SidePanel
            open={drawerRentabilidade}
            onClose={() => setDrawerRentabilidade(false)}
            title="Rentabilidade Mensal"
            subtitle="Retorno apurado mês a mês a partir do Histórico de Aportes"
            widthClass="max-w-2xl"
         >
            {tabelaRentabilidade.length === 0 ? (
               <p className="text-[12px] text-faint py-8 text-center">
                  Registre ao menos 2 pontos mensais em Histórico de Aportes para calcular a rentabilidade.
               </p>
            ) : (
               <div className="space-y-4">
                  <div className="overflow-x-auto">
                     <table className="w-full text-center border-collapse">
                        <thead>
                           <tr>
                              <th className="text-left py-2 pr-2 text-[10px] font-semibold text-faint uppercase tracking-wider sticky left-0 bg-surface">Ano</th>
                              {MESES_ABREV.map(m => (
                                 <th key={m} className="py-2 px-1.5 text-[10px] font-semibold text-faint uppercase tracking-wider">{m}</th>
                              ))}
                              <th className="py-2 pl-2 text-[10px] font-semibold text-faint uppercase tracking-wider">Ano</th>
                           </tr>
                        </thead>
                        <tbody>
                           {[...tabelaRentabilidade].reverse().map(linha => (
                              <tr key={linha.ano} className="border-t border-subtle">
                                 <td className="py-2 pr-2 text-left text-[12px] font-semibold text-main sticky left-0 bg-surface">{linha.ano}</td>
                                 {linha.meses.map((cel, idx) => (
                                    <td key={idx} className="py-2 px-1.5 text-[11px] font-medium" title={cel && cel.gapMeses > 1 ? `Inclui ${cel.gapMeses} meses sem registro no período` : undefined}>
                                       {cel ? (
                                          <span style={{ color: cel.taxa > 0 ? 'var(--primary)' : cel.taxa < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                                             {formatarPercentual(cel.taxa)}{cel.gapMeses > 1 ? '*' : ''}
                                          </span>
                                       ) : <span className="text-faint">—</span>}
                                    </td>
                                 ))}
                                 <td className="py-2 pl-2 text-[12px] font-bold">
                                    {linha.totalAno !== null ? (
                                       <span style={{ color: linha.totalAno > 0 ? 'var(--primary)' : linha.totalAno < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                                          {formatarPercentual(linha.totalAno)}
                                       </span>
                                    ) : <span className="text-faint">—</span>}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
                  <p className="text-[10px] text-faint leading-relaxed">
                     * Mês sem snapshot registrado — o retorno mostrado acumula o período desde o último lançamento.
                     Cálculo por variação não explicada pelo aporte do mês (aproximação, não considera a data exata de cada aporte dentro do mês).
                  </p>
               </div>
            )}
         </SidePanel>
      </div>
   );
};

export default ResumoInvestimentos;
