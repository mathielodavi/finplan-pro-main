
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ComposedChart, Bar, Line, Legend } from 'recharts';
import { dashboardService } from '../services/dashboardService';
import { reuniaoService } from '../services/reuniaoService';
import { formatarMoeda, formatarData, paraDatetimeLocal, deDatetimeLocalParaISO } from '../utils/formatadores';
import { CHART_COLORS, CHART_TERMOMETRO, CHART_GRID, axisTick, tooltipStyle, tooltipCursor } from '../utils/chartTheme';
import { categorizarAgendaCliente } from '../utils/agendaUtils';
import { montarLinkWhatsApp, montarMensagemAgenda } from '../utils/whatsappUtils';
import { encerrarContratoPlanejamento } from '../services/contratoService';
import { calendarioService } from '../services/calendarioService';
import { inadimplenciaService, ResumoInadimplencia } from '../services/inadimplenciaService';
import { useProntuarioNav } from '../context/ProntuarioNavContext';
import { toast } from '../utils/toast';

import Badge from '../components/UI/Badge';
import SidePanel from '../components/UI/SidePanel';
import Confirmacao from '../components/Confirmacao';
import InputMoeda from '../components/UI/InputMoeda';
import ContratoFormDrawer from '../components/Contratos/ContratoFormDrawer';
import MapaBrasil from '../components/Dashboard/MapaBrasil';
import { financeiroService } from '../services/financeiroService';
import { Users, ShieldCheck, TrendingDown, DollarSign, BarChart3, ChevronLeft, ChevronRight, AlertCircle, Clock, CalendarX, CalendarCheck, Crown, X, Wallet, CreditCard, HeartPulse, MessageCircle, RefreshCw, CheckCircle2, Phone, Mail, Video, Check, Ban } from 'lucide-react';

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

// Sistema de cores da Agenda — sem tags de texto (redundante com cor + filtro): atraso
// (vermelho) > hoje (amarelo, reunião de hoje ainda dentro da janela de tolerância de 1h)
// > agendamento futuro (verde) > check-in pendente (aviso).
const estadoPauta = (r: any): { variant: 'danger' | 'warning' | 'success'; Icon: React.ComponentType<any> } => {
  if (r.categoria === 'late') return { variant: 'danger', Icon: AlertCircle };
  if (r.categoria === 'pending') return { variant: 'warning', Icon: CalendarX };
  if (r.atencaoHoje) return { variant: 'warning', Icon: Clock };
  return { variant: 'success', Icon: Clock };
};

const CORES_ESTADO_PAUTA: Record<string, { bg: string; fg: string }> = {
  danger: { bg: 'rgba(248,113,113,0.14)', fg: 'var(--danger)' },
  warning: { bg: 'rgba(251,191,36,0.14)', fg: 'var(--warning)' },
  success: { bg: 'rgba(52,211,153,0.14)', fg: 'var(--success)' },
};

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

const VISAO_TABS = [
  { id: 'atendimento', label: 'Atendimento', icon: <Users size={16} /> },
  { id: 'contratos', label: 'Contratos', icon: <ShieldCheck size={16} /> },
  { id: 'financeiro', label: 'Financeiro', icon: <DollarSign size={16} /> },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { setNav } = useProntuarioNav();
  const [activeTab, setActiveTab] = useState('atendimento');
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
  const [clientesPorOrigem, setClientesPorOrigem] = useState<any[]>([]);
  const [vencidos, setVencidos] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<{ total: number; itens: any[] }>({ total: 0, itens: [] });
  const [receivablesOpen, setReceivablesOpen] = useState(false);
  // Conciliação/cancelamento de recebíveis dentro do drawer
  const [recConciliando, setRecConciliando] = useState<string | null>(null);
  const [recValor, setRecValor] = useState(0);
  const [recData, setRecData] = useState('');
  const [recCancelando, setRecCancelando] = useState<any | null>(null);
  const [recProcessando, setRecProcessando] = useState(false);
  const [temCalendarioAtivo, setTemCalendarioAtivo] = useState(false);

  const [filterAgenda, setFilterAgenda] = useState<'all' | 'late' | 'upcoming' | 'pending' | 'inadimplente'>('all');
  const [inadimplenciaMap, setInadimplenciaMap] = useState<Map<string, ResumoInadimplencia>>(new Map());
  const [filterRenovacao, setFilterRenovacao] = useState<'all' | 'critical' | 'attention' | 'safe' | 'expired'>('all');
  const [filterGeo, setFilterGeo] = useState<'all' | 'ativos' | 'inativos'>('all');
  const [pageAgenda, setPageAgenda] = useState(1);
  const [pageVencimentos, setPageVencimentos] = useState(1);
  const [editingAgendaModal, setEditingAgendaModal] = useState<any | null>(null);
  const [savingAgenda, setSavingAgenda] = useState(false);

  // Renovação: ações sobre contratos vencidos
  const [renovarContrato, setRenovarContrato] = useState<any | null>(null);
  const [confirmNaoRenovar, setConfirmNaoRenovar] = useState<any | null>(null);
  const [processandoRenovacao, setProcessandoRenovacao] = useState(false);
  const [avisoRenovacao, setAvisoRenovacao] = useState<string | null>(null);

  const [modalClientes, setModalClientes] = useState<{
    isOpen: boolean;
    type: string;
    mes: string;
    list: { id: string; nome: string; status?: string; tipo_encerramento?: string; etiquetas_tags?: string[] }[];
  }>({ isOpen: false, type: '', mes: '', list: [] });

  const ITEMS_PER_PAGE = 5;

  const handleSaveAgendaModal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const valorDatetimeLocal = formData.get('data') as string;
    const novaData = deDatetimeLocalParaISO(valorDatetimeLocal);

    if (!novaData || !editingAgendaModal) return;

    setSavingAgenda(true);
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
      toast.error('Erro ao salvar agendamento.');
    } finally {
      setSavingAgenda(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [summary, term, proj, exp, churn, ltv, endividamento, protecao, geo, origemContratos, vencidosData, recebiveis] = await Promise.all([
        dashboardService.getSummaryKPIs(),
        dashboardService.getTermometroStats(),
        dashboardService.getIncomeProjection(),
        dashboardService.getUpcomingExpirations(),
        dashboardService.getChurnHistory(),
        dashboardService.getLTVMetrics(),
        dashboardService.getEndividamentoTotal(),
        dashboardService.getCoberturaProtecao(),
        dashboardService.getDistribuicaoGeografica(),
        dashboardService.getClientesPorOrigem(),
        dashboardService.getContratosVencidos(),
        dashboardService.getReceivablesEmAberto()
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
      setClientesPorOrigem(origemContratos);
      setVencidos(vencidosData);
      setReceivables(recebiveis);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Tag "Em agenda"/"Fora da agenda" nas Pautas só aparece se o consultor tiver
  // uma conexão de calendário externo ativa (ver docs/integracao-calendarios.md).
  useEffect(() => {
    calendarioService.getConexao()
      .then(c => setTemCalendarioAtivo(!!c?.ativo))
      .catch(() => setTemCalendarioAtivo(false));
    inadimplenciaService.getResumoPorCliente()
      .then(setInadimplenciaMap)
      .catch(() => {});
  }, []);

  // Publica as abas da Visão Geral no header (Navbar), como no prontuário
  useEffect(() => {
    setNav({ tabs: VISAO_TABS, activeTab, setActiveTab });
    return () => setNav(null);
  }, [activeTab, setNav]);

  // ─── Lógica de Agenda por CLIENTE (sem duplicatas) ──────────────────────
  const agendaHibrida = useMemo(() => {
    if (!kpis) return [];
    const agora = new Date();

    const clientesAtivos: any[] = kpis.clientes?.filter((c: any) => c.status === 'Ativo') || [];
    const todasReunioes: any[] = kpis.reunioes || [];

    const porCliente = clientesAtivos.map((cli: any) => {
      const reunioesDoCli = todasReunioes.filter((r: any) => r.cliente_id === cli.id);
      const { categoria, reuniao: reuniaoExibida, qtdAtrasadas, atencaoHoje } = categorizarAgendaCliente(reunioesDoCli, agora);
      const inad = inadimplenciaMap.get(cli.id);

      return {
        id: `cli-${cli.id}`,
        cliente_id: cli.id,
        cliente_nome: cli.nome,
        cliente_tel: cli.telefone || null,
        cliente_email: cli.email || null,
        em_agenda_externa: !!cli.em_agenda_externa,
        link_reuniao: reuniaoExibida?.link_reuniao || null,
        calendario_evento_uid: reuniaoExibida?.calendario_evento_uid || null,
        categoria,
        atencaoHoje,
        reuniao_id: reuniaoExibida?.id || null,
        data_reuniao: reuniaoExibida?.data_reuniao || null,
        data_sort: reuniaoExibida ? new Date(reuniaoExibida.data_reuniao) : new Date(0),
        qtd_atrasadas: qtdAtrasadas,
        isAtrasada: categoria === 'late',
        inadimplente: !!inad?.inadimplenteAgora,
        diasInadimplente: inad?.diasAtuais || 0,
        status: categoria === 'late' ? 'atrasada' : categoria === 'upcoming' ? 'agendada' : 'pendente',
      };
    });

    // Filtro de inadimplentes: clientes pausados por pendência de pagamento (sem cancelamento).
    if (filterAgenda === 'inadimplente') return porCliente.filter(c => c.inadimplente).sort((a, b) => b.diasInadimplente - a.diasInadimplente);
    if (filterAgenda === 'late') return porCliente.filter(c => c.categoria === 'late').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime());
    if (filterAgenda === 'upcoming') return porCliente.filter(c => c.categoria === 'upcoming').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime());
    if (filterAgenda === 'pending') return porCliente.filter(c => c.categoria === 'pending');

    return [
      ...porCliente.filter(c => c.categoria === 'late').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime()),
      ...porCliente.filter(c => c.categoria === 'upcoming').sort((a, b) => a.data_sort.getTime() - b.data_sort.getTime()),
      ...porCliente.filter(c => c.categoria === 'pending'),
    ];
  }, [kpis, filterAgenda, inadimplenciaMap]);

  const paginatedAgenda = agendaHibrida.slice((pageAgenda - 1) * ITEMS_PER_PAGE, pageAgenda * ITEMS_PER_PAGE);

  // Contagens para o aviso de revisão de agenda (independente do filtro das Pautas).
  const avisosAgenda = useMemo(() => {
    if (!kpis) return { atraso: 0, proximos7: 0 };
    const agora = new Date();
    const limite = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);
    const clientesAtivos: any[] = kpis.clientes?.filter((c: any) => c.status === 'Ativo') || [];
    const reunioesAll: any[] = kpis.reunioes || [];
    let atraso = 0;
    let proximos7 = 0;
    clientesAtivos.forEach((cli: any) => {
      const rs = reunioesAll.filter((r: any) => r.cliente_id === cli.id);
      const { categoria, reuniao } = categorizarAgendaCliente(rs, agora);
      if (categoria === 'late') atraso++;
      else if (categoria === 'upcoming' && reuniao && new Date(reuniao.data_reuniao) <= limite) proximos7++;
    });
    return { atraso, proximos7 };
  }, [kpis]);

  const handleConfirmarNaoRenovacao = async () => {
    if (!confirmNaoRenovar) return;
    setProcessandoRenovacao(true);
    try {
      // Não toca em financeiro_parcelas: eventuais parcelas pendentes/atrasadas
      // permanecem intactas para conciliação posterior.
      await encerrarContratoPlanejamento(confirmNaoRenovar.id, 'nao_renovacao');
      const nome = confirmNaoRenovar.clientes?.nome || 'Cliente';
      setConfirmNaoRenovar(null);
      setAvisoRenovacao(`Não renovação confirmada para ${nome}. Cliente marcado como inativo.`);
      await loadData();
    } catch (e: any) {
      toast.error(`Erro ao confirmar não renovação: ${e.message}`);
    } finally {
      setProcessandoRenovacao(false);
    }
  };

  const handleRenovacaoSalva = async () => {
    const alvo = renovarContrato;
    setRenovarContrato(null);
    try {
      if (alvo?.id) {
        // O novo contrato (ativo) já foi criado neste ponto pelo ContratoFormDrawer.
        // Aqui só marcamos o contrato vencido como encerrado (concluído, sem distrato)
        // para que ele saia da listagem de Vencidos — sem tocar em financeiro_parcelas,
        // preservando parcelas pagas/pendentes/atrasadas para conciliação.
        await encerrarContratoPlanejamento(alvo.id, null);
      }
    } catch (e) {
      console.error('Erro ao encerrar contrato anterior na renovação:', e);
    }
    setAvisoRenovacao(alvo?.clientes?.nome ? `Renovação registrada para ${alvo.clientes.nome}.` : 'Renovação registrada.');
    loadData();
  };

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
    { label: 'Saldo a Receber', value: formatarMoeda(receivables.total), icon: <Clock />, color: CHART_COLORS.warning, onClick: () => setReceivablesOpen(true) },
  ];

  const getTagColorClasses = (diffDays: number) => {
    if (diffDays <= 15) return { variant: 'danger' as const, status: 'Crítico' };
    if (diffDays <= 45) return { variant: 'warning' as const, status: 'Atenção' };
    return { variant: 'success' as const, status: 'Seguro' };
  };

  const isVencidosView = filterRenovacao === 'expired';
  const vencimentosFiltrados = isVencidosView ? vencidos : vencimentos.filter(c => {
    if (filterRenovacao === 'all') return true;
    if (filterRenovacao === 'critical') return c.diffDays <= 15;
    if (filterRenovacao === 'attention') return c.diffDays > 15 && c.diffDays <= 45;
    if (filterRenovacao === 'safe') return c.diffDays > 45;
    return true;
  });
  const paginatedVencimentos = vencimentosFiltrados.slice((pageVencimentos - 1) * ITEMS_PER_PAGE, pageVencimentos * ITEMS_PER_PAGE);

  const segBtn = (active: boolean) =>
    `px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${active ? 'bg-surface-3 text-primary' : 'text-faint hover:text-muted'}`;

  // ── Drawer de clientes (drill-down): linha e segmentos ──
  const renderCliente = (c: any, i: number) => {
    // Marcador de status no avatar: verde = Ativo, vermelho = demais status (Inativo/Sem Contrato).
    const ativo = c.status === 'Ativo';
    const avatarCls = ativo ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger';
    return (
      <button
        key={c.id || i}
        onClick={() => { setModalClientes(m => ({ ...m, isOpen: false })); navigate(`/clientes/${c.id}`); }}
        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-surface-2 transition-colors border border-transparent hover:border-subtle text-left group"
      >
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-full font-bold flex items-center justify-center text-xs ${avatarCls}`} title={c.status || undefined}>
            {c.nome.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-main">{c.nome}</span>
        </div>
        <ChevronRight size={16} className="text-faint group-hover:text-muted" />
      </button>
    );
  };

  const renderSegmento = (titulo: string, desc: string | null, itens: any[]) => (
    <div className="mb-5 last:mb-0">
      <div className="flex items-baseline justify-between mb-1 px-1">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-faint">{titulo}</h4>
        <span className="text-[11px] text-faint">{itens.length}</span>
      </div>
      {desc && <p className="text-[11px] text-muted px-1 mb-2 leading-relaxed">{desc}</p>}
      {itens.length > 0 ? <div className="space-y-1">{itens.map(renderCliente)}</div> : <p className="text-[12px] text-faint px-1 py-2">Nenhum cliente.</p>}
    </div>
  );

  // Recarrega apenas os recebíveis (mantém o drawer aberto, sem o spinner global).
  const refreshReceivables = async () => {
    try {
      const rec = await dashboardService.getReceivablesEmAberto();
      setReceivables(rec);
    } catch (e) { console.error('Erro ao atualizar recebíveis:', e); }
  };

  const abrirConciliar = (p: any) => {
    setRecConciliando(p.id);
    setRecValor(p.valorLiquido);
    setRecData(new Date().toISOString().split('T')[0]);
  };

  const confirmarConciliar = async (p: any) => {
    if (recProcessando) return;
    setRecProcessando(true);
    try {
      await financeiroService.registrarPagamento(p.id, recValor, recData);
      setRecConciliando(null);
      await refreshReceivables();
      toast.success(`Recebimento de ${p.nome} conciliado.`);
    } catch (e) {
      toast.error('Erro ao conciliar recebimento.');
    } finally {
      setRecProcessando(false);
    }
  };

  const confirmarCancelar = async () => {
    if (!recCancelando || recProcessando) return;
    setRecProcessando(true);
    try {
      await financeiroService.cancelarParcela(recCancelando.id);
      const nome = recCancelando.nome;
      setRecCancelando(null);
      await refreshReceivables();
      toast.success(`Recebimento de ${nome} cancelado.`);
    } catch (e) {
      toast.error('Erro ao cancelar recebimento.');
    } finally {
      setRecProcessando(false);
    }
  };

  // ── Drawer de recebíveis em aberto: segmento (Planejamento/Extras) agrupado por cliente ──
  const renderRecebiveisSegmento = (titulo: string, itens: any[]) => {
    const subtotal = itens.reduce((acc, it) => acc + it.valorLiquido, 0);
    // Agrupa por cliente preservando a ordem de vencimento já vinda do serviço.
    const grupos: { nome: string; parcelas: any[]; total: number }[] = [];
    const idx = new Map<string, number>();
    itens.forEach(it => {
      if (!idx.has(it.nome)) { idx.set(it.nome, grupos.length); grupos.push({ nome: it.nome, parcelas: [], total: 0 }); }
      const g = grupos[idx.get(it.nome)!];
      g.parcelas.push(it);
      g.total += it.valorLiquido;
    });

    return (
      <div className="mb-5 last:mb-0">
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-faint">{titulo}</h4>
          <span className="text-[11px] font-semibold text-muted">{formatarMoeda(subtotal)}</span>
        </div>
        {grupos.length === 0 ? (
          <p className="text-[12px] text-faint px-1 py-2">Nenhuma parcela em aberto.</p>
        ) : (
          <div className="space-y-2">
            {grupos.map(g => (
              <div key={g.nome} className="bg-surface-2 rounded-lg border border-subtle overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-subtle">
                  <span className="text-[12px] font-semibold text-main truncate">{g.nome}</span>
                  <span className="text-[11px] font-semibold text-muted ml-2 shrink-0">{formatarMoeda(g.total)}</span>
                </div>
                <div className="divide-y divide-subtle">
                  {g.parcelas.map(p => (
                    <div key={p.id} className="px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-main leading-none">{formatarMoeda(p.valorLiquido)}</p>
                          <p className="text-[11px] text-faint mt-1 truncate">
                            <span className="uppercase tracking-wider font-medium">{p.modelo}</span>
                            <span className="mx-1">·</span>
                            venc. {formatarData(p.data_vencimento)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => abrirConciliar(p)}
                            className="flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                            title="Conciliar recebimento"
                          >
                            <Check size={13} strokeWidth={2.5} /> Conciliar
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecCancelando(p)}
                            className="flex items-center justify-center h-7 w-7 rounded-md text-faint hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Cancelar recebimento"
                          >
                            <Ban size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>

                      {recConciliando === p.id && (
                        <div className="mt-2.5 p-2.5 rounded-lg bg-surface border border-subtle animate-slide-up">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Valor recebido</label>
                              <InputMoeda value={recValor} onChange={setRecValor} />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Data</label>
                              <input
                                type="date"
                                value={recData}
                                onChange={e => setRecData(e.target.value)}
                                className="w-full bg-surface-2 border border-subtle text-main text-[12px] font-bold rounded-[8px] px-3 h-9 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all uppercase"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2.5">
                            <button
                              type="button"
                              onClick={() => setRecConciliando(null)}
                              disabled={recProcessando}
                              className="flex-1 h-8 rounded-md border border-subtle text-muted font-semibold text-[11px] hover:bg-surface-2 transition-colors disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmarConciliar(p)}
                              disabled={recProcessando || !recData || recValor <= 0}
                              className="flex-1 h-8 rounded-md font-semibold text-[11px] text-[#0b0e14] bg-primary hover:opacity-90 transition-all disabled:opacity-50"
                            >
                              {recProcessando ? 'Processando...' : 'Confirmar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Clique numa barra do gráfico "Clientes por Origem": abre o drawer com todos os clientes
  // daquela origem (a barra clicada — Total/Ativos/Inativos — não filtra a lista, só entra).
  const abrirDrawerOrigem = (data: any) => {
    const origem = data?.origem;
    if (!origem) return;
    const grupo = clientesPorOrigem.find((o: any) => o.origem === origem);
    setModalClientes({ isOpen: true, type: 'Origem', mes: origem, list: grupo?.clientes || [] });
  };

  const drawerTitulo = modalClientes.type === 'Engajamento' ? `Status: ${modalClientes.mes}`
    : modalClientes.type === 'Clientes' ? `Clientes em ${modalClientes.mes}`
    : modalClientes.type === 'Origem' ? `Origem: ${modalClientes.mes}`
    : `${modalClientes.type} · ${modalClientes.mes}`;

  return (
    <div className="space-y-5 animate-fade-in pb-20">

      {/* ════════ SEÇÃO 1 — ATENDIMENTO ════════ */}
      {activeTab === 'atendimento' && (
      <section>
        <SectionTitle hint="Engajamento, pautas, check-ins e saúde financeira da carteira">Atendimento</SectionTitle>

        {(avisosAgenda.atraso > 0 || avisosAgenda.proximos7 > 0) && (
          <button
            onClick={() => { setFilterAgenda(avisosAgenda.atraso > 0 ? 'late' : 'upcoming'); setPageAgenda(1); }}
            className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors hover:bg-surface-2"
            style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(251,191,36,0.10)' }}
          >
            <AlertCircle size={16} style={{ color: 'var(--warning)' }} className="flex-shrink-0" />
            <span className="text-[12px] font-medium text-main flex-1">
              {avisosAgenda.atraso > 0 && <><b className="font-bold">{avisosAgenda.atraso}</b> cliente(s) com agendamento em atraso</>}
              {avisosAgenda.atraso > 0 && avisosAgenda.proximos7 > 0 && ' e '}
              {avisosAgenda.proximos7 > 0 && <><b className="font-bold">{avisosAgenda.proximos7}</b> com reunião nos próximos 7 dias</>}
              . Revise a agenda.
            </span>
            <ChevronRight size={14} className="text-faint flex-shrink-0" />
          </button>
        )}

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
                <h3 className="text-[13px] font-semibold text-main">Agenda</h3>
                <span className="text-[11px] text-faint hidden sm:inline">Compromissos e check-ins</span>
              </div>
              <div className="flex bg-surface-2 p-0.5 rounded-lg border border-subtle">
                {['all', 'late', 'upcoming', 'pending', 'inadimplente'].map((f) => (
                  <button key={f} onClick={() => { setFilterAgenda(f as any); setPageAgenda(1); }} className={segBtn(filterAgenda === f)}>
                    {f === 'all' ? 'Tudo' : f === 'late' ? 'Atraso' : f === 'upcoming' ? 'Próximas' : f === 'pending' ? 'Check-in' : 'Inadimplentes'}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-[260px] flex-1">
              {paginatedAgenda.length === 0 ? (
                <div className="py-16 text-center text-faint font-medium text-[12px]">Nenhum registro encontrado</div>
              ) : paginatedAgenda.map((r: any, i: number) => {
                const estado = estadoPauta(r);
                const cores = CORES_ESTADO_PAUTA[estado.variant];
                return (
                <div key={i} className="px-4 py-3 hover:bg-surface-2 flex items-center justify-between border-b border-subtle transition-colors last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cores.bg, color: cores.fg }}>
                      <estado.Icon size={14} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-main leading-none cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setEditingAgendaModal(r)} title={r.categoria === 'pending' ? 'Agendar Check-in' : 'Ver detalhes e editar'}>
                        {r.cliente_nome}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {r.categoria === 'pending' ? (
                          <span className="text-[11px] text-faint">
                            Sem reunião{temCalendarioAtivo && !r.em_agenda_externa ? ' · não encontrada no calendário' : ''}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted">{r.data_reuniao ? formatarData(r.data_reuniao, true) : '—'}</span>
                        )}
                        {r.categoria === 'late' && r.qtd_atrasadas > 1 && (
                          <span className="text-[11px] text-faint">· {r.qtd_atrasadas} em atraso</span>
                        )}
                        {r.inadimplente && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ color: 'var(--danger)', backgroundColor: 'rgba(248,113,113,0.14)' }}>
                            Inadimplente há {r.diasInadimplente}d
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(() => {
                      const link = montarLinkWhatsApp(r.cliente_tel, montarMensagemAgenda(r.categoria, r.cliente_nome, r.data_reuniao, r.link_reuniao));
                      return (
                        <a
                          href={link || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => { if (!link) e.preventDefault(); }}
                          title={link ? 'Enviar mensagem no WhatsApp' : 'Sem telefone cadastrado'}
                          className={`h-7 w-7 flex items-center justify-center rounded-lg border border-subtle transition-colors ${link ? 'hover:bg-surface-3' : 'opacity-40 cursor-not-allowed'}`}
                          style={{ color: link ? 'var(--success)' : 'var(--text-faint)' }}
                        >
                          <MessageCircle size={14} />
                        </a>
                      );
                    })()}
                    {(() => {
                      const temReuniao = r.categoria !== 'pending';
                      const vinculada = temReuniao && !!r.calendario_evento_uid;
                      const clicavel = temReuniao && !!r.link_reuniao;
                      const titulo = !temReuniao ? 'Sem reunião agendada' : vinculada ? 'Vinculada ao calendário externo' : 'Reunião manual (não vinculada ao calendário externo)';
                      return (
                        <a
                          href={clicavel ? r.link_reuniao : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => { if (!clicavel) e.preventDefault(); }}
                          title={titulo}
                          className={`h-7 w-7 flex items-center justify-center rounded-lg border border-subtle transition-colors ${clicavel ? 'hover:bg-surface-3' : 'opacity-40 cursor-not-allowed'}`}
                          style={{ color: !temReuniao ? 'var(--text-faint)' : vinculada ? 'var(--success)' : 'var(--text-faint)' }}
                        >
                          <CalendarCheck size={14} />
                        </a>
                      );
                    })()}
                  </div>
                </div>
                );
              })}
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
            <div className={panelHeadCls}>
              <h3 className="text-[13px] font-semibold text-main">Distribuição Geográfica</h3>
              <div className="flex bg-surface-2 p-0.5 rounded-lg border border-subtle">
                {[{ id: 'all', label: 'Todos' }, { id: 'ativos', label: 'Ativos' }, { id: 'inativos', label: 'Inativos' }].map((f) => (
                  <button key={f.id} onClick={() => setFilterGeo(f.id as any)} className={segBtn(filterGeo === f.id)}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 flex-1 min-h-[300px] flex flex-col">
              <MapaBrasil
                dados={geoData}
                filtroStatus={filterGeo}
                onSelectEstado={(estado, clientes) => {
                  const list = filterGeo === 'ativos' ? clientes.filter((c: any) => c.status === 'Ativo')
                    : filterGeo === 'inativos' ? clientes.filter((c: any) => c.status === 'Inativo')
                    : clientes;
                  setModalClientes({ isOpen: true, type: 'Clientes', mes: estado, list });
                }}
              />
            </div>
          </div>
        </div>
      </section>

      )}

      {/* ════════ SEÇÃO 2 — CONTRATOS ════════ */}
      {activeTab === 'contratos' && (
      <section>
        <SectionTitle hint="Saúde da base, retenção e renovação de contratos">Contratos</SectionTitle>

        {avisoRenovacao && (
          <div
            className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border"
            style={{ borderColor: 'var(--border)', backgroundColor: 'rgba(16,185,129,0.10)' }}
          >
            <CheckCircle2 size={16} style={{ color: 'var(--success)' }} className="flex-shrink-0" />
            <span className="text-[12px] font-medium text-main flex-1">{avisoRenovacao}</span>
            <button onClick={() => setAvisoRenovacao(null)} className="text-faint hover:text-main transition-colors flex-shrink-0"><X size={14} /></button>
          </div>
        )}

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
                  <Bar dataKey="resgates" name="Resgate" fill={CHART_COLORS.purple} radius={[3, 3, 0, 0]} barSize={12} style={{ cursor: 'pointer' }} onClick={(data: any) => {
                    if (data?.payload?.clientesResgates?.length > 0) setModalClientes({ isOpen: true, type: 'Resgate', mes: data.payload.mes, list: data.payload.clientesResgates });
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Clientes por Origem */}
        <div className={`${panelCls} lg:col-span-5`}>
          <PanelLabel title="Clientes por Origem" hint="Total · ativos · inativos · clique para detalhar" />
          <div className="p-4 flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={clientesPorOrigem} margin={{ top: 5, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                <XAxis dataKey="origem" axisLine={false} tickLine={false} tick={axisTick} dy={10} interval={0}
                  tickFormatter={(v: string) => (v && v.length > 12 ? v.slice(0, 11) + '…' : v)} />
                <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
                <Legend content={legendContent} />
                <Bar dataKey="total" name="Total" fill={CHART_COLORS.info} radius={[3, 3, 0, 0]} barSize={14} style={{ cursor: 'pointer' }} onClick={abrirDrawerOrigem} />
                <Bar dataKey="ativos" name="Ativos" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} barSize={14} style={{ cursor: 'pointer' }} onClick={abrirDrawerOrigem} />
                <Bar dataKey="inativos" name="Inativos" fill={CHART_COLORS.danger} radius={[3, 3, 0, 0]} barSize={14} style={{ cursor: 'pointer' }} onClick={abrirDrawerOrigem} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vencimentos */}
        <div className={`${panelCls} lg:col-span-7 overflow-hidden`}>
          <div className={panelHeadCls}>
            <div className="flex gap-2 items-baseline">
              <h3 className="text-[13px] font-semibold text-main">Renovação</h3>
              <span className="text-[11px] text-faint hidden sm:inline">Vigência consultiva</span>
            </div>
            <div className="flex bg-surface-2 p-0.5 rounded-lg border border-subtle">
              {[{ id: 'all', label: 'Tudo' }, { id: 'critical', label: '≤15d' }, { id: 'attention', label: '≤45d' }, { id: 'safe', label: '>45d' }, { id: 'expired', label: 'Vencidos' }].map((f) => (
                <button key={f.id} onClick={() => { setFilterRenovacao(f.id as any); setPageVencimentos(1); }} className={segBtn(filterRenovacao === f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-[260px] flex-1">
            {paginatedVencimentos.length === 0 ? (
              <div className="py-16 text-center text-faint font-medium text-[12px]">{isVencidosView ? 'Nenhum contrato vencido pendente' : 'Nenhum contrato vencendo'}</div>
            ) : paginatedVencimentos.map((c: any, i: number) => {
              const colors = getTagColorClasses(c.diffDays);
              return (
                <div key={i} className="px-4 py-3 hover:bg-surface-2 flex items-center justify-between gap-3 border-b border-subtle transition-colors last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-[11px] flex-shrink-0" style={{
                      backgroundColor: isVencidosView ? 'rgba(248,113,113,0.14)' : c.diffDays <= 15 ? 'rgba(248,113,113,0.14)' : c.diffDays <= 45 ? 'rgba(251,191,36,0.14)' : 'rgba(16,185,129,0.14)',
                      color: isVencidosView ? 'var(--danger)' : c.diffDays <= 15 ? 'var(--danger)' : c.diffDays <= 45 ? 'var(--warning)' : 'var(--primary)',
                    }}>
                      {isVencidosView ? `${Math.abs(c.diffDays)}d` : `${c.diffDays}d`}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-main leading-none truncate">{c.clientes?.nome}</p>
                      <p className="text-[11px] text-muted mt-1 truncate max-w-[180px]">
                        {isVencidosView ? `Venceu em ${formatarData(c.dataFimCalculada)}` : c.descricao}
                      </p>
                    </div>
                  </div>
                  {isVencidosView ? (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setRenovarContrato(c)}
                        title="Renovar — vincular novo contrato"
                        className="h-7 px-2.5 flex items-center gap-1 rounded-lg text-[11px] font-semibold text-[#0b0e14] transition-colors"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        <RefreshCw size={12} /> Renovar
                      </button>
                      <button
                        onClick={() => setConfirmNaoRenovar(c)}
                        title="Confirmar não renovação — manter inativo"
                        className="h-7 px-2.5 flex items-center gap-1 rounded-lg border border-subtle text-[11px] font-semibold text-muted hover:bg-surface-3 transition-colors"
                      >
                        <X size={12} /> Não renovar
                      </button>
                    </div>
                  ) : (
                    <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant={colors.variant} size="sm">{colors.status}</Badge>
                      <span className="text-[10px] text-faint">Fim: {formatarData(c.dataFimCalculada)}</span>
                    </div>
                  )}
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
        </div>
      </section>

      )}

      {/* ════════ SEÇÃO 3 — FINANCEIRO ════════ */}
      {activeTab === 'financeiro' && (
      <section>
        <SectionTitle hint="Receita e valor do cliente">Financeiro</SectionTitle>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {kpisFinanceiro.map((kpi, i) => {
            const clickable = !!(kpi as any).onClick;
            const Tag: any = clickable ? 'button' : 'div';
            return (
              <Tag
                key={i}
                {...(clickable ? { onClick: (kpi as any).onClick, type: 'button' } : {})}
                className={`bg-surface rounded-xl border border-subtle p-4 flex flex-col gap-3 text-left ${clickable ? 'hover:bg-surface-2 hover:border-strong transition-colors cursor-pointer' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-medium text-muted">{kpi.label}</span>
                  <span className="flex items-center gap-1">
                    <span style={{ color: kpi.color }}>{React.cloneElement(kpi.icon as any, { size: 15, strokeWidth: 2.5 })}</span>
                    {clickable && <ChevronRight size={14} className="text-faint" />}
                  </span>
                </div>
                <p className="text-[26px] font-bold text-main tracking-tight leading-none">{kpi.value}</p>
              </Tag>
            );
          })}
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

      )}

      {/* Drawer de drill-down de clientes */}
      <SidePanel
        open={modalClientes.isOpen}
        onClose={() => setModalClientes(m => ({ ...m, isOpen: false }))}
        title={drawerTitulo}
        subtitle={`${modalClientes.list.length} cliente(s)`}
      >
        {modalClientes.list.length === 0 ? (
          <div className="py-8 text-center text-muted text-sm">Nenhum cliente listado.</div>
        ) : modalClientes.type === 'Distratos' ? (
          <>
            {renderSegmento(
              'Não renovação',
              'Contrato cumprido na íntegra, mas não renovado.',
              modalClientes.list.filter(c => c.tipo_encerramento !== 'cancelamento_antecipado')
            )}
            {renderSegmento(
              'Cancelamento antecipado',
              'Contrato cancelado antes de sua finalização.',
              modalClientes.list.filter(c => c.tipo_encerramento === 'cancelamento_antecipado')
            )}
          </>
        ) : (modalClientes.type === 'Clientes' && filterGeo === 'all') ? (
          <>
            {renderSegmento('Ativos', null, modalClientes.list.filter(c => c.status === 'Ativo'))}
            {renderSegmento('Inativos', null, modalClientes.list.filter(c => c.status === 'Inativo'))}
          </>
        ) : modalClientes.type === 'Origem' ? (
          <>
            {Array.from(new Set(modalClientes.list.flatMap(c => c.etiquetas_tags || []))).sort().map(tag =>
              renderSegmento(tag, null, modalClientes.list.filter(c => (c.etiquetas_tags || []).includes(tag)))
            )}
            {renderSegmento('Sem tags', null, modalClientes.list.filter(c => !(c.etiquetas_tags || []).length))}
          </>
        ) : (
          <div className="space-y-1">{modalClientes.list.map(renderCliente)}</div>
        )}
      </SidePanel>

      {/* Drawer de valores a receber em aberto (KPI Saldo a Receber) */}
      <SidePanel
        open={receivablesOpen}
        onClose={() => setReceivablesOpen(false)}
        title="Valores a receber em aberto"
        subtitle={`${formatarMoeda(receivables.total)} · até o mês anterior`}
        widthClass="max-w-lg"
      >
        {receivables.itens.length === 0 ? (
          <div className="py-8 text-center text-muted text-sm">Nenhuma parcela em aberto.</div>
        ) : (
          <>
            {receivables.itens.some(i => i.tipo === 'planejamento') &&
              renderRecebiveisSegmento('Planejamento', receivables.itens.filter(i => i.tipo === 'planejamento'))}
            {receivables.itens.some(i => i.tipo === 'extra') &&
              renderRecebiveisSegmento('Extras', receivables.itens.filter(i => i.tipo === 'extra'))}
          </>
        )}
      </SidePanel>

      {/* Confirmação de cancelamento de recebível */}
      <Confirmacao
        isOpen={!!recCancelando}
        onClose={() => !recProcessando && setRecCancelando(null)}
        onConfirm={confirmarCancelar}
        loading={recProcessando}
        title="Cancelar recebimento"
        message={recCancelando ? `Cancelar o recebimento de ${formatarMoeda(recCancelando.valorLiquido)} de ${recCancelando.nome} (venc. ${formatarData(recCancelando.data_vencimento)})? A parcela sairá dos valores a receber.` : ''}
        confirmLabel="Cancelar recebimento"
      />

      {/* Renovação: drawer de vinculação de novo contrato */}
      {renovarContrato && (
        <ContratoFormDrawer
          open={!!renovarContrato}
          onClose={() => setRenovarContrato(null)}
          cliente={{ id: renovarContrato.cliente_id, nome: renovarContrato.clientes?.nome } as any}
          contratoParaEditar={null}
          onSaved={handleRenovacaoSalva}
        />
      )}

      {/* Renovação: confirmação de não renovação */}
      <Confirmacao
        isOpen={!!confirmNaoRenovar}
        onClose={() => setConfirmNaoRenovar(null)}
        onConfirm={handleConfirmarNaoRenovacao}
        loading={processandoRenovacao}
        danger={false}
        confirmLabel="Confirmar não renovação"
        title="Confirmar não renovação"
        message={confirmNaoRenovar ? `Confirmar que o contrato de ${confirmNaoRenovar.clientes?.nome} não foi renovado? O contrato será encerrado como "não renovação" e o cliente permanecerá inativo.` : ''}
      />

      <SidePanel
        open={!!editingAgendaModal}
        onClose={() => setEditingAgendaModal(null)}
        title={editingAgendaModal?.cliente_nome || ''}
        subtitle={editingAgendaModal?.categoria === 'pending' ? 'Agendar check-in' : 'Detalhes e edição de agendamento'}
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingAgendaModal(null)} className="px-4 py-2 text-[13px] font-medium text-muted hover:bg-surface-2 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" form="form-agenda-drawer" disabled={savingAgenda} className="px-4 py-2 text-[13px] font-semibold text-[#0b0e14] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--primary)' }}>{savingAgenda ? 'Salvando...' : 'Salvar'}</button>
          </div>
        }
      >
        {editingAgendaModal && (
          <div className="flex flex-col gap-6">
            <section className="space-y-2">
              <h4 className="text-[11px] font-bold text-faint uppercase tracking-wider">Contato</h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 text-[13px]">
                  <Phone size={14} className="text-faint flex-shrink-0" />
                  {editingAgendaModal.cliente_tel ? (
                    <a href={`https://wa.me/${editingAgendaModal.cliente_tel.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-main hover:text-primary transition-colors">
                      {editingAgendaModal.cliente_tel}
                    </a>
                  ) : (
                    <span className="text-faint">Sem telefone cadastrado</span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-[13px]">
                  <Mail size={14} className="text-faint flex-shrink-0" />
                  {editingAgendaModal.cliente_email ? (
                    <a href={`mailto:${editingAgendaModal.cliente_email}`} className="text-main hover:text-primary transition-colors truncate">
                      {editingAgendaModal.cliente_email}
                    </a>
                  ) : (
                    <span className="text-faint">Sem e-mail cadastrado</span>
                  )}
                </div>
              </div>
            </section>

            {editingAgendaModal.link_reuniao && (
              <a
                href={editingAgendaModal.link_reuniao}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-9 rounded-lg text-[13px] font-semibold transition-colors"
                style={{ backgroundColor: 'var(--primary)', color: '#0b0e14' }}
              >
                <Video size={14} /> Entrar na chamada
              </a>
            )}

            <form id="form-agenda-drawer" onSubmit={handleSaveAgendaModal} className="space-y-2">
              <h4 className="text-[11px] font-bold text-faint uppercase tracking-wider">Agendamento manual</h4>
              <label className="block text-[13px] font-medium text-main mb-1.5">Data e horário</label>
              <input
                type="datetime-local"
                name="data"
                defaultValue={paraDatetimeLocal(editingAgendaModal.data_reuniao)}
                required
                autoFocus
                className="w-full text-[13px] text-main bg-surface-2 border border-subtle rounded-lg px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
              />
            </form>
          </div>
        )}
      </SidePanel>

    </div>
  );
};

export default Dashboard;
