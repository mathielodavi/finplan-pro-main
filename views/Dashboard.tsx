
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ComposedChart, Bar, Line, Legend } from 'recharts';
import { dashboardService } from '../services/dashboardService';
import { reuniaoService } from '../services/reuniaoService';
import { formatarMoeda, formatarData } from '../utils/formatadores';
import { CHART_COLORS, CHART_TERMOMETRO, CHART_GRID, axisTick, tooltipStyle, tooltipCursor } from '../utils/chartTheme';
import { categorizarAgendaCliente } from '../utils/agendaUtils';

import Badge from '../components/UI/Badge';
import MapaBrasil from '../components/Dashboard/MapaBrasil';
import { Users, ShieldCheck, TrendingDown, DollarSign, BarChart3, ChevronLeft, ChevronRight, AlertCircle, Clock, CalendarX, Crown, X, Wallet, CreditCard, HeartPulse } from 'lucide-react';

// ── Helpers visuais ────────────────────────────────────────────────────────
const SectionTitle: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <div className="flex items-baseline gap-3 px-1 mb-3 mt-2">
    <h2 className="text-[14px] font-semibold text-main">{children}</h2>
    {hint && <span className="text-[12px] text-faint">{hint}</span>}
  </div>
);

const panelCls = 'bg-surface rounded-xl border border-subtle flex flex-col';
const panelHeadCls = 'px-4 py-3 border-b border-subtle flex justify-between items-center';
const PanelLabel: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className={panelHeadCls}>
    <h3 className="text-[13px] font-semibold text-main">{title}</h3>
    {hint && <span className="text-[11px] text-faint">{hint}</span>}
  </div>
);

const legendContent = (props: any) => (
  <div className="flex justify-center gap-4 flex-wrap mt-2">
    {props.payload?.map((entry: any, index: number) => (
      <div key={index} className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
        <span className="text-[11px] font-medium text-muted">{entry.value}</span>
      </div>
    ))}
  </div>
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any>(null);
  const [termometroData, setTermometroData] = useState<any[]>([]);
  const [projecaoData, setProjecaoData] = useState<any[]>([]);
  const [vencimentos, setVencimentos] = useState<any[]>([]);
  const [churnData, setChurnData] = useState<any[]>([]);
  const [ltvData, setLtvData] = useState<any>(null);
  const [endividamentoTotal, setEndividamentoTotal] = useState(0);
  const [coberturaProtecao, setCoberturaProtecao] = useState(0);
  const [geoData, setGeoData] = useState<any[]>([]);

  const [filterAgenda, setFilterAgenda] = useState<'all' | 'late' | 'upcoming' | 'pending'>('all');
  const [filterRenovacao, setFilterRenovacao] = useState<'all' | 'critical' | 'attention' | 'safe'>('all');
  const [pageAgenda, setPageAgenda] = useState(1);
  const [pageVencimentos, setPageVencimentos] = useState(1);
  const [editingAgendaModal, setEditingAgendaModal] = useState<any | null>(null);

  const [modalClientes, setModalClientes] = useState<{
    isOpen: boolean;
    type: string;
    mes: string;
    list: { id: string; nome: string }[];
  }>({ isOpen: false, type: '', mes: '', list: [] });

  const ITEMS_PER_PAGE = 5;

  const handleSaveAgendaModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const novaData = formData.get('data') as string;

    if (!novaData || !editingAgendaModal) return;

    try {
      if (editingAgendaModal.reuniao_id) {
        await reuniaoService.salvar({ id: editingAgendaModal.reuniao_id, data_reuniao: novaData });
      } else {
        await reuniaoService.salvar({
          cliente_id: editingAgendaModal.cliente_id,
          data_reuniao: novaData,
          status: 'agendada',
          notas: ''
        });
      }
      setEditingAgendaModal(null);
      loadData();
    } catch (err) {
      console.error('Erro ao salvar reunião da agenda:', err);
      alert('Erro ao salvar agendamento.');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [summary, term, proj, exp, churn, ltv, endividamento, protecao, geo] = await Promise.all([
        dashboardService.getSummaryKPIs(),
        dashboardService.getTermometroStats(),
        dashboardService.getIncomeProjection(),
        dashboardService.getUpcomingExpirations(),
        dashboardService.getChurnHistory(),
        dashboardService.getLTVMetrics(),
        dashboardService.getEndividamentoTotal(),
        dashboardService.getCoberturaProtecao(),
        dashboardService.getDistribuicaoGeografica()
      ]);
      setKpis(summary);
      setTermometroData(term);
      setProjecaoData(proj);
      setVencimentos(exp);
      setChurnData(churn);
      setLtvData(ltv);
      setEndividamentoTotal(endividamento);
      setCoberturaProtecao(protecao);
      setGeoData(geo);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ─── Lógica de Agenda por CLIENTE (sem duplicatas) ──────────────────────
  const agendaHibrida = useMemo(() => {
    if (!kpis) return [];
    const agora = new Date();

    const clientesAtivos: any[] = kpis.clientes?.filter((c: any) => c.status === 'Ativo') || [];
    const todasReunioes: any[] = kpis.reunioes || [];

    const porCliente = clientesAtivos.map((cli: any) => {
      const reunioesDoCli = todasReunioes.filter((r: any) => r.cliente_id === cli.id);
      const { categoria, reuniao: reuniaoExibida, qtdAtrasadas } = categorizarAgendaCliente(reunioesDoCli, agora);

      return {
        id: `cli-${cli.id}`,
        cliente_id: cli.id,
        cliente_nome: cli.nome,
        categoria,
        reuniao_id: reuniaoExibida?.id || null,
        data_reuniao: reuniaoExibida?.data_reuniao || null,
        data_sort: reuniaoExibida ? new Date(reuniaoExibida.data_reuniao) : new Date(0),
        qtd_atrasadas: qtdAtrasadas,
        isAtrasada: categoria === 'late',
        status: categoria === 'late' ? 'atrasada' : categoria === 'upcoming' ? 'agendada' : 'pendente',
      };
    });

    if (filterAgenda === 'late') return porCliente.filter(c => c.categoria === 'late').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime());
    if (filterAgenda === 'upcoming') return porCliente.filter(c => c.categoria === 'upcoming').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime());
    if (filterAgenda === 'pending') return porCliente.filter(c => c.categoria === 'pending');

    return [
      ...porCliente.filter(c => c.categoria === 'late').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime()),
      ...porCliente.filter(c => c.categoria === 'upcoming').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime()),
      ...porCliente.filter(c => c.categoria === 'pending'),
    ];
  }, [kpis, filterAgenda]);

  const paginatedAgenda = agendaHibrida.slice((pageAgenda - 1) * ITEMS_PER_PAGE, pageAgenda * ITEMS_PER_PAGE);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-6">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[color:var(--primary)]"></div>
      <p className="text-faint font-semibold uppercase tracking-[0.2em] text-[10px]">Consolidando inteligência...</p>
    </div>
  );

  const kpisAtendimento = [
    { label: 'Patrimônio sob Gestão', value: formatarMoeda(kpis.aum), icon: <Wallet />, color: CHART_COLORS.info },
    { label: 'Endividamento Total', value: formatarMoeda(endividamentoTotal), icon: <CreditCard />, color: CHART_COLORS.danger },
    { label: 'Base com Proteção', value: `${coberturaProtecao.toFixed(0)}%`, icon: <HeartPulse />, color: CHART_COLORS.primary },
  ];

  const kpisContratos = [
    { label: 'Base Total', value: kpis.totalClientes, icon: <Users />, color: CHART_COLORS.info },
    { label: 'Ativos', value: kpis.ativosPlanejamento, icon: <ShieldCheck />, color: CHART_COLORS.primary },
    { label: 'Churn Rate', value: `${kpis.churn.toFixed(1)}%`, icon: <TrendingDown />, color: CHART_COLORS.danger },
  ];

  const kpisFinanceiro = [
    { label: 'Ticket Geral', value: formatarMoeda(kpis.ticketMedio), icon: <DollarSign />, color: CHART_COLORS.primary },
    { label: 'Ticket 6m', value: formatarMoeda(kpis.ticketMedio6m), icon: <BarChart3 />, color: CHART_COLORS.purple },
  ];

  const getTagColorClasses = (diffDays: number) => {
    if (diffDays <= 15) return { variant: 'danger' as const, status: 'Crítico' };
    if (diffDays <= 45) return { variant: 'warning' as const, status: 'Atenção' };
    return { variant: 'success' as const, status: 'Seguro' };
  };

  const vencimentosFiltrados = vencimentos.filter(c => {
    if (filterRenovacao === 'all') return true;
    if (filterRenovacao === 'critical') return c.diffDays <= 15;
    if (filterRenovacao === 'attention') return c.diffDays > 15 && c.diffDays <= 45;
    if (filterRenovacao === 'safe') return c.diffDays > 45;
    return true;
  });
  const paginatedVencimentos = vencimentosFiltrados.slice((pageVencimentos - 1) * ITEMS_PER_PAGE, pageVencimentos * ITEMS_PER_PAGE);

  const segBtn = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${active ? 'bg-surface-3 text-primary' : 'text-faint hover:text-muted'}`;

  return (
    <div className="space-y-5 animate-fade-in pb-20">

      {/* ════════ SEÇÃO 1 — ATENDIMENTO ════════ */}
      <section>
        <SectionTitle hint="Engajamento, pautas, check-ins e saúde financeira da carteira">Atendimento</SectionTitle>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Coluna 1 — KPIs empilhados + Engajamento */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            {kpisAtendimento.map((kpi, i) => (
              <div key={i} className="bg-surface rounded-xl border border-subtle p-4 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[12px] font-medium text-muted block mb-1">{kpi.label}</span>
                  <p className="text-[20px] font-bold text-main tracking-tight leading-none">{kpi.value}</p>
                </div>
                <span style={{ color: kpi.color }}>{React.cloneElement(kpi.icon as any, { size: 18, strokeWidth: 2.5 })}</span>
              </div>
            ))}

            <div className={panelCls}>
              <PanelLabel title="Engajamento" hint="Termômetro" />
              <div className="p-4 h-[180px] flex items-center gap-4">
                <div className="h-full w-[110px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={termometroData} innerRadius={36} outerRadius={54} paddingAngle={4} dataKey="value" stroke="none">
                        {termometroData.map((t, index) => (
                          <Cell
                            key={index}
                            fill={CHART_TERMOMETRO[index % CHART_TERMOMETRO.length]}
                            style={{ cursor: (t as any).clientes?.length > 0 ? 'pointer' : 'default' }}
                            onClick={() => {
                              if ((t as any).clientes?.length > 0) setModalClientes({ isOpen: true, type: 'Engajamento', mes: t.name, list: (t as any).clientes });
                            }}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 min-w-0 space-y-2.5">
                  {termometroData.map((t, i) => {
                    const total = termometroData.reduce((acc, c) => acc + (c.value || 0), 0) || 1;
                    const pct = Math.round(((t.value || 0) / total) * 100);
                    const clicavel = (t as any).clientes?.length > 0;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={!clicavel}
                        onClick={() => clicavel && setModalClientes({ isOpen: true, type: 'Engajamento', mes: t.name, list: (t as any).clientes })}
                        className={`w-full flex items-center justify-between gap-2 text-left ${clicavel ? 'hover:opacity-75 cursor-pointer' : 'cursor-default'} transition-opacity`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_TERMOMETRO[i] }} />
                          <span className="text-[11px] font-medium text-muted truncate">{t.name}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-main flex-shrink-0">
                          {t.value} <span className="text-faint font-normal">({pct}%)</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Agenda */}
          <div className={`${panelCls} lg:col-span-4 overflow-hidden`}>
            <div className={panelHeadCls}>
              <div className="flex gap-2 items-baseline">
                <h3 className="text-[13px] font-semibold text-main">Pautas</h3>
                <span className="text-[11px] text-faint hidden sm:inline">Agenda e check-ins</span>
              </div>
              <div className="flex bg-surface-2 p-0.5 rounded-lg border border-subtle">
                {['all', 'late', 'upcoming', 'pending'].map((f) => (
                  <button key={f} onClick={() => { setFilterAgenda(f as any); setPageAgenda(1); }} className={segBtn(filterAgenda === f)}>
                    {f === 'all' ? 'Tudo' : f === 'late' ? 'Atraso' : f === 'upcoming' ? 'Próximas' : 'Check-in'}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-[260px] flex-1">
              {paginatedAgenda.length === 0 ? (
                <div className="py-16 text-center text-faint font-medium text-[12px]">Nenhum registro encontrado</div>
              ) : paginatedAgenda.map((r: any, i: number) => (
                <div key={i} className="px-4 py-3 hover:bg-surface-2 flex items-center justify-between border-b border-subtle transition-colors last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                      backgroundColor: r.categoria === 'late' ? 'rgba(248,113,113,0.14)' : r.categoria === 'pending' ? 'rgba(251,191,36,0.14)' : 'rgba(16,185,129,0.14)',
                      color: r.categoria === 'late' ? 'var(--danger)' : r.categoria === 'pending' ? 'var(--warning)' : 'var(--primary)',
                    }}>
                      {r.categoria === 'late' ? <AlertCircle size={14} /> : r.categoria === 'pending' ? <CalendarX size={14} /> : <Clock size={14} />}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-main leading-none cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setEditingAgendaModal(r)} title={r.categoria === 'pending' ? 'Agendar Check-in' : 'Editar data'}>
                        {r.cliente_nome}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {r.categoria === 'pending' ? (
                          <span className="text-[11px] text-faint">Sem reunião</span>
                        ) : (
                          <span className="text-[11px] text-muted">{r.data_reuniao ? formatarData(r.data_reuniao, true) : '—'}</span>
                        )}
                        {r.categoria === 'late' && r.qtd_atrasadas > 1 && (
                          <span className="text-[11px] text-faint">· {r.qtd_atrasadas} em atraso</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={r.categoria === 'late' ? 'danger' : r.categoria === 'pending' ? 'warning' : 'neutral'} size="sm">
                    {r.categoria === 'late' ? (r.qtd_atrasadas > 1 ? `ATRASO ×${r.qtd_atrasadas}` : 'ATRASO') : r.categoria === 'pending' ? 'CHECK-IN' : 'AGENDADA'}
                  </Badge>
                </div>
              ))}
            </div>

            <div className="px-4 py-2 flex justify-between items-center bg-surface-2 border-t border-subtle">
              <span className="text-[11px] font-medium text-faint">Página {pageAgenda}</span>
              <div className="flex gap-1">
                <button onClick={() => setPageAgenda(p => Math.max(1, p - 1))} className="h-6 w-6 flex items-center justify-center bg-surface hover:bg-surface-3 rounded border border-subtle transition-colors"><ChevronLeft size={12} className="text-muted" /></button>
                <button onClick={() => setPageAgenda(p => p + 1)} className="h-6 w-6 flex items-center justify-center bg-surface hover:bg-surface-3 rounded border border-subtle transition-colors"><ChevronRight size={12} className="text-muted" /></button>
              </div>
            </div>
          </div>

          {/* Mapa */}
          <div className={`${panelCls} lg:col-span-4 overflow-hidden`}>
            <PanelLabel title="Distribuição Geográfica" hint="Clientes por estado" />
            <div className="p-4 flex-1 min-h-[300px] flex flex-col">
              <MapaBrasil
                dados={geoData}
                onSelectEstado={(estado, clientes) => setModalClientes({ isOpen: true, type: 'Clientes', mes: estado, list: clientes })}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ════════ SEÇÃO 2 — CONTRATOS ════════ */}
      <section>
        <SectionTitle hint="Saúde da base, retenção e renovação de contratos">Contratos</SectionTitle>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {kpisContratos.map((kpi, i) => (
            <div key={i} className="bg-surface rounded-xl border border-subtle p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-medium text-muted">{kpi.label}</span>
                <span style={{ color: kpi.color }}>{React.cloneElement(kpi.icon as any, { size: 15, strokeWidth: 2.5 })}</span>
              </div>
              <p className="text-[26px] font-bold text-main tracking-tight leading-none">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
          {/* Movimentação da Base — apenas barras */}
          <div className={`${panelCls} lg:col-span-7`}>
            <PanelLabel title="Movimentação da Base" hint="Últimos 7 meses" />
            <div className="p-4 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={churnData} margin={{ top: 5, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={axisTick} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
                  <Legend content={legendContent} />
                  <Bar dataKey="ativos" name="Ativos" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} barSize={12} />
                  <Bar dataKey="novos" name="Novos" fill={CHART_COLORS.info} radius={[3, 3, 0, 0]} barSize={12} style={{ cursor: 'pointer' }} onClick={(data: any) => {
                    if (data?.payload?.clientesNovos?.length > 0) setModalClientes({ isOpen: true, type: 'Novos', mes: data.payload.mes, list: data.payload.clientesNovos });
                  }} />
                  <Bar dataKey="renovacoes" name="Renovações" fill={CHART_COLORS.warning} radius={[3, 3, 0, 0]} barSize={12} style={{ cursor: 'pointer' }} onClick={(data: any) => {
                    if (data?.payload?.clientesRenovacoes?.length > 0) setModalClientes({ isOpen: true, type: 'Renovações', mes: data.payload.mes, list: data.payload.clientesRenovacoes });
                  }} />
                  <Bar dataKey="distratos" name="Distratos" fill={CHART_COLORS.danger} radius={[3, 3, 0, 0]} barSize={12} style={{ cursor: 'pointer' }} onClick={(data: any) => {
                    if (data?.payload?.clientesDistratos?.length > 0) setModalClientes({ isOpen: true, type: 'Distratos', mes: data.payload.mes, list: data.payload.clientesDistratos });
                  }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Evolução do Churn — apenas linhas */}
          <div className={`${panelCls} lg:col-span-5`}>
            <PanelLabel title="Evolução do Churn" hint="% mensal" />
            <div className="p-4 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={churnData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={axisTick} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(v) => `${v}%`} domain={[0, 'auto']} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => `${value}%`} />
                  <Legend content={legendContent} />
                  <Line type="monotone" dataKey="churnMensal" name="Mensal" stroke={CHART_COLORS.danger} strokeWidth={2.5} dot={{ r: 3, fill: CHART_COLORS.danger, strokeWidth: 1.5, stroke: '#151823' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="churnPrecoce" name="Precoce" stroke={CHART_COLORS.warning} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.warning, strokeWidth: 1.5, stroke: '#151823' }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="churnPrecoce12m" name="Precoce 12m" stroke={CHART_COLORS.purple} strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: CHART_COLORS.purple, strokeWidth: 1.5, stroke: '#151823' }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Vencimentos */}
        <div className={`${panelCls} overflow-hidden`}>
          <div className={panelHeadCls}>
            <div className="flex gap-2 items-baseline">
              <h3 className="text-[13px] font-semibold text-main">Renovação</h3>
              <span className="text-[11px] text-faint hidden sm:inline">Vigência consultiva</span>
            </div>
            <div className="flex bg-surface-2 p-0.5 rounded-lg border border-subtle">
              {[{ id: 'all', label: 'Tudo' }, { id: 'critical', label: '≤15d' }, { id: 'attention', label: '≤45d' }, { id: 'safe', label: '>45d' }].map((f) => (
                <button key={f.id} onClick={() => { setFilterRenovacao(f.id as any); setPageVencimentos(1); }} className={segBtn(filterRenovacao === f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-[260px] flex-1">
            {paginatedVencimentos.length === 0 ? (
              <div className="py-16 text-center text-faint font-medium text-[12px]">Nenhum contrato vencendo</div>
            ) : paginatedVencimentos.map((c: any, i: number) => {
              const colors = getTagColorClasses(c.diffDays);
              return (
                <div key={i} className="px-4 py-3 hover:bg-surface-2 flex items-center justify-between border-b border-subtle transition-colors last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-[11px] flex-shrink-0" style={{
                      backgroundColor: c.diffDays <= 15 ? 'rgba(248,113,113,0.14)' : c.diffDays <= 45 ? 'rgba(251,191,36,0.14)' : 'rgba(16,185,129,0.14)',
                      color: c.diffDays <= 15 ? 'var(--danger)' : c.diffDays <= 45 ? 'var(--warning)' : 'var(--primary)',
                    }}>
                      {c.diffDays}d
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-main leading-none">{c.clientes?.nome}</p>
                      <p className="text-[11px] text-muted mt-1 truncate max-w-[180px]">{c.descricao}</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <Badge variant={colors.variant} size="sm">{colors.status}</Badge>
                    <span className="text-[10px] text-faint">Fim: {formatarData(c.dataFimCalculada)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-2 flex justify-between items-center bg-surface-2 border-t border-subtle">
            <span className="text-[11px] font-medium text-faint">Página {pageVencimentos}</span>
            <div className="flex gap-1">
              <button onClick={() => setPageVencimentos(p => Math.max(1, p - 1))} className="h-6 w-6 flex items-center justify-center bg-surface hover:bg-surface-3 rounded border border-subtle transition-colors"><ChevronLeft size={12} className="text-muted" /></button>
              <button onClick={() => setPageVencimentos(p => p + 1)} className="h-6 w-6 flex items-center justify-center bg-surface hover:bg-surface-3 rounded border border-subtle transition-colors"><ChevronRight size={12} className="text-muted" /></button>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ SEÇÃO 3 — FINANCEIRO ════════ */}
      <section>
        <SectionTitle hint="Receita e valor do cliente">Financeiro</SectionTitle>

        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-4">
          {kpisFinanceiro.map((kpi, i) => (
            <div key={i} className="bg-surface rounded-xl border border-subtle p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-medium text-muted">{kpi.label}</span>
                <span style={{ color: kpi.color }}>{React.cloneElement(kpi.icon as any, { size: 15, strokeWidth: 2.5 })}</span>
              </div>
              <p className="text-[26px] font-bold text-main tracking-tight leading-none">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Receita Prevista */}
          <div className={`${panelCls} lg:col-span-8`}>
            <PanelLabel title="Receita Prevista" hint="Fluxo líquido — 6 meses" />
            <div className="p-4 h-[240px] flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={projecaoData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={axisTick} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={axisTick}
                    tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`} />
                  <Tooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={(value: any) => formatarMoeda(value)} />
                  <Legend content={legendContent} />
                  <Bar dataKey="planejamento" name="Planejamento" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} barSize={18} />
                  <Bar dataKey="extra" name="Extras" fill={CHART_COLORS.warning} radius={[3, 3, 0, 0]} barSize={18} />
                  <Line type="monotone" dataKey="valor" name="Total Líquido" stroke={CHART_COLORS.line} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.line, strokeWidth: 1.5, stroke: '#151823' }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* LTV Indicator */}
          <div className={`${panelCls} lg:col-span-4`}>
            <PanelLabel title="Lifetime Value" hint="Líquido" />
            <div className="p-4 flex flex-col justify-between flex-1">
              <div className="text-center py-2">
                <p className="text-[11px] font-medium text-faint mb-1">LTV médio / cliente</p>
                <p className="text-[26px] font-bold text-main tracking-tight leading-none">{formatarMoeda(ltvData?.ltvMedio || 0)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-surface-2 rounded-lg px-3 py-2.5 border border-subtle">
                  <p className="text-[10px] font-medium text-faint">Tempo médio</p>
                  <p className="text-[16px] font-bold text-main leading-none mt-1">{Math.round(ltvData?.tempoMedio || 0)}<span className="text-[11px] text-faint ml-0.5">m</span></p>
                </div>
                <div className="bg-surface-2 rounded-lg px-3 py-2.5 border border-subtle">
                  <p className="text-[10px] font-medium text-faint">Ticket/mês</p>
                  <p className="text-[16px] font-bold text-main leading-none mt-1">{formatarMoeda(ltvData?.ticketMedioGlobal || 0)}</p>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Crown size={12} className="text-[color:var(--warning)]" />
                  <p className="text-[11px] font-medium text-faint">Top 5 LTV</p>
                </div>
                <div className="space-y-1.5">
                  {ltvData?.top5?.map((cli: any, i: number) => {
                    const maxLtv = ltvData.top5[0]?.ltv || 1;
                    const pct = (cli.ltv / maxLtv) * 100;
                    return (
                      <div key={cli.id} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-faint w-4 text-right">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-[11px] font-medium text-main truncate">{cli.nome}</span>
                            <span className="text-[10px] font-semibold text-muted ml-2 shrink-0">{formatarMoeda(cli.ltv)}</span>
                          </div>
                          <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: CHART_COLORS.purple }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modais */}
      {modalClientes.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-surface rounded-xl shadow-[var(--shadow-float)] border border-subtle w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
              <div>
                <h3 className="font-semibold text-main">
                  {modalClientes.type === 'Engajamento' ? `Status: ${modalClientes.mes}`
                    : modalClientes.type === 'Clientes' ? `Clientes em ${modalClientes.mes}`
                    : `${modalClientes.type} em ${modalClientes.mes}`}
                </h3>
                <p className="text-[13px] text-muted mt-0.5">{modalClientes.list.length} cliente(s)</p>
              </div>
              <button onClick={() => setModalClientes({ ...modalClientes, isOpen: false })} className="p-2 text-faint hover:text-main hover:bg-surface-2 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-3 flex-1">
              {modalClientes.list.length > 0 ? (
                <div className="space-y-1">
                  {modalClientes.list.map((c, i) => (
                    <button key={i} onClick={() => { setModalClientes({ ...modalClientes, isOpen: false }); navigate(`/clientes/${c.id}`); }}
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-2 transition-colors border border-transparent hover:border-subtle text-left group">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-surface-3 text-muted font-bold flex items-center justify-center text-xs">{c.nome.charAt(0).toUpperCase()}</div>
                        <span className="font-medium text-main">{c.nome}</span>
                      </div>
                      <ChevronRight size={16} className="text-faint group-hover:text-muted" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted text-sm">Nenhum cliente listado.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {editingAgendaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="bg-surface rounded-xl shadow-[var(--shadow-float)] border border-subtle w-full max-w-sm overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
              <h3 className="font-semibold text-main">{editingAgendaModal.categoria === 'pending' ? 'Agendar Check-in' : 'Editar Agendamento'}</h3>
              <button onClick={() => setEditingAgendaModal(null)} className="p-2 text-faint hover:text-main hover:bg-surface-2 rounded-lg transition-colors"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveAgendaModal} className="p-5 flex flex-col gap-4">
              <div>
                <p className="text-[13px] text-muted mb-4">Cliente: <span className="font-semibold text-main">{editingAgendaModal.cliente_nome}</span></p>
                <label className="block text-[13px] font-medium text-main mb-1.5">Nova Data</label>
                <input type="date" name="data" defaultValue={editingAgendaModal.data_reuniao?.split('T')[0] || ''} required autoFocus
                  className="w-full text-[13px] text-main bg-surface-2 border border-subtle rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setEditingAgendaModal(null)} className="px-4 py-2 text-[13px] font-medium text-muted hover:bg-surface-2 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-[13px] font-semibold text-[#0b0e14] rounded-lg transition-colors" style={{ backgroundColor: 'var(--primary)' }}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
