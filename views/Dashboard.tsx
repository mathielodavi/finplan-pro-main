
import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, ComposedChart, Bar, Line, Legend } from 'recharts';
import { dashboardService } from '../services/dashboardService';
import { formatarMoeda, formatarData } from '../utils/formatadores';
import Card from '../components/UI/Card';
import Badge from '../components/UI/Badge';
import { Users, ShieldCheck, TrendingDown, DollarSign, BarChart3, Calendar, Wallet, ChevronLeft, ChevronRight, AlertCircle, Clock, CalendarX, CheckCircle2 } from 'lucide-react';

const COLORS_TERMOMETRO = ['#10b981', '#f59e0b', '#ef4444', '#94a3b8'];

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<any>(null);
  const [termometroData, setTermometroData] = useState<any[]>([]);
  const [projecaoData, setProjecaoData] = useState<any[]>([]);
  const [vencimentos, setVencimentos] = useState<any[]>([]);

  const [filterAgenda, setFilterAgenda] = useState<'all' | 'late' | 'upcoming' | 'pending'>('all');
  const [filterRenovacao, setFilterRenovacao] = useState<'all' | 'critical' | 'attention' | 'safe'>('all');
  const [pageAgenda, setPageAgenda] = useState(1);
  const [pageVencimentos, setPageVencimentos] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const loadData = async () => {
    setLoading(true);
    try {
      const [summary, term, proj, exp] = await Promise.all([
        dashboardService.getSummaryKPIs(),
        dashboardService.getTermometroStats(),
        dashboardService.getIncomeProjection(),
        dashboardService.getUpcomingExpirations()
      ]);
      setKpis(summary);
      setTermometroData(term);
      setProjecaoData(proj);
      setVencimentos(exp);
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

    // Apenas clientes com status ativo
    const clientesAtivos: any[] = kpis.clientes?.filter((c: any) => c.status === 'Ativo') || [];
    const todasReunioes: any[] = kpis.reunioes || [];

    const porCliente = clientesAtivos.map((cli: any) => {
      const reunioesDoCli = todasReunioes.filter((r: any) => r.cliente_id === cli.id);
      const agendadas = reunioesDoCli.filter((r: any) => r.status === 'agendada');

      // Reuniões atrasadas = agendadas com data no passado
      const atrasadas = agendadas
        .filter((r: any) => new Date(r.data_reuniao) < agora)
        .sort((a: any, b: any) => new Date(a.data_reuniao).getTime() - new Date(b.data_reuniao).getTime());

      // Reuniões futuras = agendadas com data no futuro ou hoje
      const futuras = agendadas
        .filter((r: any) => new Date(r.data_reuniao) >= agora)
        .sort((a: any, b: any) => new Date(a.data_reuniao).getTime() - new Date(b.data_reuniao).getTime());

      const temAtraso = atrasadas.length > 0;
      const temFutura = futuras.length > 0;

      // Categoria mutuamente exclusiva:
      // 1. Tem atraso → categoria 'late' (mais prioritária)
      // 2. Tem futuras mas sem atraso → categoria 'upcoming'
      // 3. Sem nenhuma agendada → categoria 'pending' (check-in)
      let categoria: 'late' | 'upcoming' | 'pending';
      let reuniaoExibida: any | null = null;

      if (temAtraso) {
        categoria = 'late';
        reuniaoExibida = atrasadas[0]; // Mais antiga em atraso
      } else if (temFutura) {
        categoria = 'upcoming';
        reuniaoExibida = futuras[0]; // Próxima reunião
      } else {
        categoria = 'pending';
        reuniaoExibida = null;
      }

      return {
        id: `cli-${cli.id}`,
        cliente_id: cli.id,
        cliente_nome: cli.nome,
        categoria,
        data_reuniao: reuniaoExibida?.data_reuniao || null,
        data_sort: reuniaoExibida ? new Date(reuniaoExibida.data_reuniao) : new Date(0),
        qtd_atrasadas: atrasadas.length,
        isAtrasada: temAtraso,
        status: temAtraso ? 'atrasada' : temFutura ? 'agendada' : 'pendente',
      };
    });

    if (filterAgenda === 'late') return porCliente.filter(c => c.categoria === 'late').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime());
    if (filterAgenda === 'upcoming') return porCliente.filter(c => c.categoria === 'upcoming').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime());
    if (filterAgenda === 'pending') return porCliente.filter(c => c.categoria === 'pending');

    // 'all': late primeiro, depois upcoming, depois pending
    return [
      ...porCliente.filter(c => c.categoria === 'late').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime()),
      ...porCliente.filter(c => c.categoria === 'upcoming').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime()),
      ...porCliente.filter(c => c.categoria === 'pending'),
    ];
  }, [kpis, filterAgenda]);

  const paginatedAgenda = agendaHibrida.slice((pageAgenda - 1) * ITEMS_PER_PAGE, pageAgenda * ITEMS_PER_PAGE);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-6">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      <p className="text-slate-300 font-bold uppercase tracking-[0.2em] text-[10px]">Consolidando Inteligência...</p>
    </div>
  );

  const kpiList = [
    { label: 'Base Total', value: kpis.totalClientes, icon: <Users />, color: 'blue' },
    { label: 'Ativos', value: kpis.ativosPlanejamento, icon: <ShieldCheck />, color: 'emerald' },
    { label: 'Churn Rate', value: `${kpis.churn.toFixed(1)}%`, icon: <TrendingDown />, color: 'rose' },
    { label: 'Geral', value: formatarMoeda(kpis.ticketMedio), icon: <DollarSign />, color: 'emerald' },
    { label: '6 meses', value: formatarMoeda(kpis.ticketMedio6m), icon: <BarChart3 />, color: 'indigo' },
  ];

  const getTagColorClasses = (diffDays: number) => {
    if (diffDays <= 15) return { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100', label: 'text-rose-700', status: 'Crítico' };
    if (diffDays <= 45) return { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', label: 'text-amber-700', status: 'Atenção' };
    return { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', label: 'text-emerald-700', status: 'Seguro' };
  };

  const vencimentosFiltrados = vencimentos.filter(c => {
    if (filterRenovacao === 'all') return true;
    if (filterRenovacao === 'critical') return c.diffDays <= 15;
    if (filterRenovacao === 'attention') return c.diffDays > 15 && c.diffDays <= 45;
    if (filterRenovacao === 'safe') return c.diffDays > 45;
    return true;
  });
  const paginatedVencimentos = vencimentosFiltrados.slice((pageVencimentos - 1) * ITEMS_PER_PAGE, pageVencimentos * ITEMS_PER_PAGE);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Grupo 1: Gestão de clientes de planejamento */}
        <Card noPadding className="flex-[1.5] flex flex-col">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Gestão de clientes de planejamento</h3>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100 flex-1">
            {kpiList.slice(0, 3).map((kpi, i) => (
              <div key={i} className="p-5 flex flex-col hover:bg-slate-50 transition-colors">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-4">
                  {kpi.label}
                </span>
                <div className="flex justify-between items-end mt-auto">
                  <p className="text-xl 2xl:text-2xl font-black text-slate-900 tracking-tighter break-words xl:truncate">
                    {kpi.value}
                  </p>
                  <div className={`p-2 rounded-xl transition-colors ${kpi.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                    kpi.color === 'rose' ? 'bg-rose-50 text-rose-600' :
                      kpi.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                        'bg-slate-50 text-slate-500'
                    }`}>
                    {React.cloneElement(kpi.icon as any, { size: 18, strokeWidth: 2.5 })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Grupo 2: Ticket Médio */}
        <Card noPadding className="flex-1 flex flex-col">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ticket Médio</h3>
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100 flex-1">
            {kpiList.slice(3, 5).map((kpi, i) => (
              <div key={i} className="p-5 flex flex-col hover:bg-slate-50 transition-colors">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-4">
                  {kpi.label}
                </span>
                <div className="flex justify-between items-end mt-auto">
                  <p className="text-xl 2xl:text-2xl font-black text-slate-900 tracking-tighter break-words xl:truncate">
                    {kpi.value}
                  </p>
                  <div className={`p-2 rounded-xl bg-${kpi.color}-50 text-${kpi.color}-600`}>
                    {React.cloneElement(kpi.icon as any, { size: 18, strokeWidth: 2.5 })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card title="Engajamento" subtitle="Métrica de Termômetro" className="lg:col-span-4">
          <div className="h-[300px] -mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={termometroData} innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                  {termometroData.map((_, index) => <Cell key={index} fill={COLORS_TERMOMETRO[index % COLORS_TERMOMETRO.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', fontSize: '10px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-4 flex-wrap px-6">
              {termometroData.map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COLORS_TERMOMETRO[i] }} />
                  <span className="text-[8px] font-black text-slate-400 uppercase">{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Receita Prevista" subtitle="Fluxo de Caixa Líquido (6 Meses)" className="lg:col-span-8">
          <div className="h-[300px] pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={projecaoData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="mes"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(value) => `R$ ${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  formatter={(value: any) => formatarMoeda(value)}
                />
                <Legend content={(props) => {
                  const { payload } = props;
                  return (
                    <div className="flex justify-center gap-4 flex-wrap mt-2">
                      {payload?.map((entry, index) => (
                        <div key={`item-${index}`} className="flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                          <span className="text-[8px] font-black text-slate-400 uppercase">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                }} />
                <Bar dataKey="planejamento" name="Planejamento" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} />
                <Bar dataKey="extra" name="Extras" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={24} />
                <Line type="monotone" dataKey="valor" name="Total Líquido" stroke="#334155" strokeWidth={3} dot={{ r: 4, fill: '#334155', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card
          title="Próximos Passos & Pautas"
          subtitle="Agenda de reuniões e check-ins"
          noPadding
        >
          <div className="px-5 py-3 border-b border-slate-50 flex bg-slate-50/50 justify-start gap-2">
            {['all', 'late', 'upcoming', 'pending'].map((f) => (
              <button
                key={f}
                onClick={() => { setFilterAgenda(f as any); setPageAgenda(1); }}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filterAgenda === f ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600 hover:bg-white border border-transparent'}`}
              >
                {f === 'all' ? 'Tudo' : f === 'late' ? 'Atraso' : f === 'upcoming' ? 'Próximas' : 'Fila Check-in'}
              </button>
            ))}
          </div>
          <div className="divide-y divide-slate-50 min-h-[400px]">
            {paginatedAgenda.length === 0 ? (
              <div className="py-20 text-center text-slate-300 font-bold uppercase text-[10px]">Sem registros para este filtro</div>
            ) : paginatedAgenda.map((r: any, i: number) => (
              <div key={i} className="px-8 py-4 hover:bg-slate-50/50 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${r.categoria === 'late' ? 'bg-rose-50 text-rose-500' : r.categoria === 'pending' ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-600'}`}>
                    {r.categoria === 'late' ? <AlertCircle size={18} /> : r.categoria === 'pending' ? <CalendarX size={18} /> : <Clock size={18} />}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{r.cliente_nome}</p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {r.categoria === 'pending'
                        ? 'Sem reunião agendada'
                        : r.data_reuniao
                          ? formatarData(r.data_reuniao, true)
                          : '—'}
                      {r.categoria === 'late' && r.qtd_atrasadas > 1
                        ? ` · ${r.qtd_atrasadas} reuniões em atraso`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={r.categoria === 'late' ? 'danger' : r.categoria === 'pending' ? 'warning' : 'neutral'}>
                    {r.categoria === 'late'
                      ? r.qtd_atrasadas > 1 ? `ATRASO ×${r.qtd_atrasadas}` : 'EM ATRASO'
                      : r.categoria === 'pending'
                        ? 'CHECK-IN'
                        : 'AGENDADA'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-50 flex justify-between items-center bg-slate-50/30">
            <span className="text-[9px] font-black text-slate-400 uppercase">Página {pageAgenda}</span>
            <div className="flex gap-2">
              <button onClick={() => setPageAgenda(p => Math.max(1, p - 1))} className="p-1.5 hover:bg-white rounded-lg border border-slate-100"><ChevronLeft size={14} /></button>
              <button onClick={() => setPageAgenda(p => p + 1)} className="p-1.5 hover:bg-white rounded-lg border border-slate-100"><ChevronRight size={14} /></button>
            </div>
          </div>
        </Card>

        <Card title="Janela de Renovação" subtitle="Fim da Vigência Consultiva" noPadding>
          <div className="px-5 py-3 border-b border-slate-50 flex bg-slate-50/50 justify-start gap-2">
            {[
              { id: 'all', label: 'Tudo' },
              { id: 'critical', label: 'Crítico (≤15d)' },
              { id: 'attention', label: 'Atenção (≤45d)' },
              { id: 'safe', label: 'Seguro (>45d)' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => { setFilterRenovacao(f.id as any); setPageVencimentos(1); }}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filterRenovacao === f.id ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600 hover:bg-white border border-transparent'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="divide-y divide-slate-50 min-h-[400px]">
            {paginatedVencimentos.length === 0 ? (
              <div className="py-20 text-center text-slate-300 font-bold uppercase text-[10px]">Sem contratos vencendo neste filtro</div>
            ) : paginatedVencimentos.map((c: any, i: number) => {
              const colors = getTagColorClasses(c.diffDays);
              return (
                <div key={i} className="px-8 py-4 hover:bg-slate-50/50 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center font-black text-[10px]`}>
                      {c.diffDays}d
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{c.clientes?.nome}</p>
                      <p className="text-[10px] text-slate-400 font-bold italic line-clamp-1">{c.descricao}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex flex-col items-end">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${colors.bg} ${colors.label} border ${colors.border}`}>
                        {colors.status}
                      </span>
                      <span className="text-[8px] text-slate-300 font-bold uppercase mt-1">Fim em {formatarData(c.dataFimCalculada)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-4 border-t border-slate-50 flex justify-between items-center bg-slate-50/30">
            <span className="text-[9px] font-black text-slate-400 uppercase">Página {pageVencimentos}</span>
            <div className="flex gap-2">
              <button onClick={() => setPageVencimentos(p => Math.max(1, p - 1))} className="p-1.5 hover:bg-white rounded-lg border border-slate-100"><ChevronLeft size={14} /></button>
              <button onClick={() => setPageVencimentos(p => p + 1)} className="p-1.5 hover:bg-white rounded-lg border border-slate-100"><ChevronRight size={14} /></button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
