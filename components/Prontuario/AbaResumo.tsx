
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Cliente, atualizarCliente } from '../../services/clienteService';
import { obterContratosPorCliente, atualizarContrato, deletarContrato } from '../../services/contratoService';
import { reuniaoService, Reuniao } from '../../services/reuniaoService';
import { configService } from '../../services/configuracoesService';
import { financeiroService, Parcela } from '../../services/financeiroService';
import { investimentoService } from '../../services/investimentoService';
import { dividasService } from '../../services/dividasService';
import { protecaoService } from '../../services/protecaoService';
import { acompanhamentoService } from '../../services/acompanhamentoService';
import { formatarMoeda, formatarData } from '../../utils/formatadores';
import { calcularTermometro } from '../../utils/termometroUtils';
import { categorizarAgendaCliente } from '../../utils/agendaUtils';
import { useProntuarioNav } from '../../context/ProntuarioNavContext';
import SidePanel from '../UI/SidePanel';
import Badge from '../UI/Badge';
import Button from '../UI/Button';
import Confirmacao from '../Confirmacao';
import ContratoFormDrawer from '../Contratos/ContratoFormDrawer';
import { Activity, Plus, FileText, ChevronRight, Clock, CheckCircle2, AlertTriangle, Edit3, Trash2, Calendar, Wallet, CreditCard, HeartPulse, ListChecks, AlertCircle, Ban } from 'lucide-react';

interface AbaResumoProps {
  cliente: Cliente;
  onUpdate: () => void;
}

const AbaResumo: React.FC<AbaResumoProps> = ({ cliente, onUpdate }) => {
  const { nav } = useProntuarioNav();
  const [contratos, setContratos] = useState<any[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [roteirosPadrao, setRoteirosPadrao] = useState<any[]>([]);
  // Dados cross-domain para a central de controle
  const [patrimonioInvestido, setPatrimonioInvestido] = useState(0);
  const [saldoDevedor, setSaldoDevedor] = useState(0);
  const [protecaoScore, setProtecaoScore] = useState(0);
  const [checklist, setChecklist] = useState({ total: 0, concluidos: 0 });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [modalContrato, setModalContrato] = useState(false);
  const [contratoParaEditar, setContratoParaEditar] = useState<any | null>(null);
  const [modalExtrato, setModalExtrato] = useState(false);
  const [modalExcluirConfirm, setModalExcluirConfirm] = useState(false);

  const [contratoSelecionado, setContratoSelecionado] = useState<any>(null);
  const [parcelasContrato, setParcelasContrato] = useState<Parcela[]>([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelData, setCancelData] = useState({ data_cancelamento: '', data_inadimplencia: '' });
  const [removendo, setRemovendo] = useState(false);
  const [baixaTarget, setBaixaTarget] = useState<Parcela | null>(null);
  const [baixando, setBaixando] = useState(false);

  const [accordionEncerrados, setAccordionEncerrados] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cData, rData, roteiros, ativos, creditos, consorcios, score, itensChecklist] = await Promise.all([
        obterContratosPorCliente(cliente.id!),
        reuniaoService.getPorCliente(cliente.id!),
        configService.getAcompanhamentos(),
        investimentoService.getAtivos(cliente.id!),
        dividasService.getCreditos(cliente.id!),
        dividasService.getConsorcios(cliente.id!),
        protecaoService.getScoreCliente(cliente.id!),
        acompanhamentoService.getItensCliente(cliente.id!)
      ]);

      // Patrimônio investido (soma dos ativos) e saldo devedor (créditos + consórcios)
      setPatrimonioInvestido((ativos || []).reduce((acc: number, a: any) => acc + (a.valor_atual || 0), 0));
      const totalCredito = (creditos || []).reduce((acc, c: any) => acc + (Number(c.outstanding_balance) || 0), 0);
      const totalConsorcio = (consorcios || []).reduce((acc, c: any) => acc + Math.max(0, (Number(c.credit_letter_value) || 0) - (Number(c.total_paid_to_date) || 0)), 0);
      setSaldoDevedor(totalCredito + totalConsorcio);
      setProtecaoScore(score);
      const itens = itensChecklist || [];
      setChecklist({ total: itens.length, concluidos: itens.filter((i: any) => i.concluido).length });

      const contratosComFinanceiro = await Promise.all((cData || []).map(async (c) => {
        try {
          const parcelas = await financeiroService.obterParcelasPorContrato(c.id);
          const recebidoBruto = (parcelas || []).filter(p => p.status === 'pago').reduce((acc, p) => acc + (p.valor_pago || 0), 0);
          const totalParcelas = parcelas?.length || 0;
          const pagas = (parcelas || []).filter(p => p.status === 'pago').length;
          return { ...c, recebidoBruto, totalParcelas, pagas };
        } catch (e) {
          return { ...c, recebidoBruto: 0, totalParcelas: 0, pagas: 0 };
        }
      }));

      setContratos(contratosComFinanceiro);
      setReunioes(rData || []);
      setRoteirosPadrao(roteiros || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [cliente.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openNovoContrato = () => {
    setContratoParaEditar(null);
    setModalContrato(true);
  };

  const handleEditContrato = (c: any) => {
    setContratoParaEditar(c);
    setModalExtrato(false);
    setModalContrato(true);
  };

  const handleAbrirExtrato = async (contrato: any) => {
    setContratoSelecionado(contrato);
    setLoadingParcelas(true);
    setModalExtrato(true);
    setCancelando(false);
    try {
      const data = await financeiroService.obterParcelasPorContrato(contrato.id);
      setParcelasContrato(data || []);
    } finally { setLoadingParcelas(false); }
  };

  const abrirCancelamento = () => {
    setCancelData({ data_cancelamento: new Date().toISOString().split('T')[0], data_inadimplencia: '' });
    setCancelando(true);
  };

  const handleCancelarContrato = async () => {
    if (!contratoSelecionado || !cancelData.data_cancelamento) return;
    setIsSubmitting(true);
    try {
      await atualizarContrato(contratoSelecionado.id, {
        status: 'cancelado',
        data_fim: cancelData.data_cancelamento,
        data_inadimplencia: cancelData.data_inadimplencia || null,
      });
      setCancelando(false);
      setModalExtrato(false);
      fetchData();
    } catch (err: any) {
      alert(`Erro ao cancelar contrato: ${err.message}`);
    } finally { setIsSubmitting(false); }
  };

  const confirmarBaixa = async () => {
    if (!baixaTarget) return;
    const fatorRepasse = (contratoSelecionado.repasse_percentual || 100) / 100;
    const valorLiquido = baixaTarget.valor_previsto * fatorRepasse;
    setBaixando(true);
    try {
      await financeiroService.registrarPagamento(baixaTarget.id, valorLiquido, new Date().toISOString());
      const data = await financeiroService.obterParcelasPorContrato(contratoSelecionado.id);
      setParcelasContrato(data || []);
      setBaixaTarget(null);
      fetchData();
    } catch (err) { alert("Erro ao baixar parcela."); }
    finally { setBaixando(false); }
  };

  const handleMetodologiaChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const roteiroId = e.target.value;
    const roteiro = roteirosPadrao.find(r => r.id === roteiroId);
    try {
      await atualizarCliente(cliente.id!, {
        protocolo_id: roteiroId || null,
        status_atendimento: roteiro?.nome || ''
      });
      onUpdate();
    } catch (err) { alert("Erro ao vincular metodologia."); }
  };

  const totalLiquidoEsperadoContrato = useMemo(() => {
    const fator = (contratoSelecionado?.repasse_percentual || 100) / 100;
    return parcelasContrato
      .filter(p => p.status !== 'cancelado')
      .reduce((acc, p) => acc + (p.valor_previsto * fator), 0);
  }, [parcelasContrato, contratoSelecionado]);

  const totalLiquidoConciliado = useMemo(() => {
    return parcelasContrato.filter(p => p.status === 'pago').reduce((acc, p) => acc + (p.valor_pago || 0), 0);
  }, [parcelasContrato]);

  const ultimaReuniao = reunioes.find(r => r.status === 'realizada')?.data_reuniao || null;
  const proximaReuniao = reunioes.find(r => r.status === 'agendada')?.data_reuniao || null;
  const termometro = calcularTermometro(ultimaReuniao, proximaReuniao);

  // ─── Central de controle: derivados ──────────────────────────────────────
  const patrimonioLiquido = patrimonioInvestido - saldoDevedor;
  const temPlanoAtivo = contratos.some((c: any) => c.tipo === 'planejamento' && c.status === 'ativo');
  const proximaAcao = categorizarAgendaCliente(reunioes);
  const checklistPct = checklist.total > 0 ? Math.round((checklist.concluidos / checklist.total) * 100) : 0;
  const endividamentoRatio = patrimonioInvestido > 0 ? saldoDevedor / patrimonioInvestido : 0;

  const irPara = (tab: string) => nav?.setActiveTab(tab);
  const pontosAtencao: { label: string; tab: string; sev: 'danger' | 'warning' }[] = [];
  if (!temPlanoAtivo) pontosAtencao.push({ label: 'Sem contrato de planejamento ativo', tab: 'resumo', sev: 'warning' });
  if (protecaoScore < 40) pontosAtencao.push({ label: `Proteção frágil (${Math.round(protecaoScore)}%)`, tab: 'protecao', sev: 'danger' });
  else if (protecaoScore < 70) pontosAtencao.push({ label: `Proteção parcial (${Math.round(protecaoScore)}%)`, tab: 'protecao', sev: 'warning' });
  if (endividamentoRatio > 0.5) pontosAtencao.push({ label: `Endividamento alto (${Math.round(endividamentoRatio * 100)}% do patrimônio)`, tab: 'dividas', sev: 'danger' });
  if (proximaAcao.categoria === 'late') pontosAtencao.push({ label: `Reunião em atraso${proximaAcao.qtdAtrasadas > 1 ? ` (${proximaAcao.qtdAtrasadas})` : ''}`, tab: 'reunioes', sev: 'danger' });
  else if (proximaAcao.categoria === 'pending') pontosAtencao.push({ label: 'Sem reunião agendada', tab: 'reunioes', sev: 'warning' });
  if (checklist.total > 0 && checklistPct < 100) pontosAtencao.push({ label: `Checklist em andamento (${checklistPct}%)`, tab: 'atendimento', sev: 'warning' });

  const labelStyle = "text-[12px] font-semibold text-[color:var(--text-muted)] block mb-1.5";
  const inputStyle = "w-full h-[36px] px-3 bg-surface border border-subtle rounded-lg font-medium text-main outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all text-[13px]";

  const corProtecao = protecaoScore >= 70 ? 'var(--primary)' : protecaoScore >= 40 ? 'var(--warning)' : 'var(--danger)';
  const vigentes = contratos.filter((c: any) => c.status === 'ativo');
  const encerrados = contratos.filter((c: any) => c.status !== 'ativo');
  const kpiCard = 'bg-surface rounded-xl border border-subtle p-4 flex flex-col gap-2';
  const kpiLabel = 'text-[11px] font-semibold text-faint uppercase tracking-wider';
  const kpiValue = 'text-[18px] font-bold text-main tracking-tight leading-none';
  const thCls = 'px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint';

  const LinhaAcordo = ({ c, encerrado }: { c: any; encerrado?: boolean }) => {
    const perc = Math.min(((c.pagas || 0) / (c.totalParcelas || 1)) * 100, 100);
    return (
      <tr onClick={() => handleAbrirExtrato(c)} className={`group border-b border-subtle last:border-0 hover:bg-surface-2 cursor-pointer transition-colors ${encerrado ? 'opacity-70 hover:opacity-100' : ''}`}>
        <td className="px-4 py-3">
          <Badge variant={c.tipo === 'planejamento' ? 'info' : 'warning'} size="sm">{c.tipo}</Badge>
        </td>
        <td className="px-4 py-3 text-[13px] font-semibold text-main">{c.descricao}</td>
        <td className="px-4 py-3 text-right text-[13px] font-semibold text-main whitespace-nowrap">{formatarMoeda(c.valor)}</td>
        <td className="px-4 py-3 min-w-[140px]">
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${perc}%`, backgroundColor: c.status === 'cancelado' ? 'var(--danger)' : 'var(--primary)' }} />
            </div>
            <span className="text-[11px] font-medium text-muted whitespace-nowrap">{c.pagas}/{c.totalParcelas}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <Badge variant={c.status === 'ativo' || c.status === 'concluido' ? 'success' : 'danger'} size="sm">{c.status}</Badge>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Faixa de KPIs (central de controle) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Relacionamento */}
        <div className={kpiCard}>
          <div className="flex items-center justify-between">
            <span className={kpiLabel}>Relacionamento</span>
            <Activity size={14} className="text-faint" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: termometro.cor }} />
            <span className="text-[14px] font-bold leading-none" style={{ color: termometro.cor }}>{termometro.status}</span>
          </div>
        </div>

        {/* Protocolo */}
        <div className={kpiCard}>
          <span className={kpiLabel}>Protocolo</span>
          <select
            value={cliente.protocolo_id || ''}
            onChange={handleMetodologiaChange}
            className="w-full h-8 px-2 bg-surface-2 border border-subtle rounded-lg font-semibold text-primary text-[12px] outline-none cursor-pointer hover:border-primary transition-colors"
          >
            <option value="">Vincular...</option>
            {roteirosPadrao.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>

        {/* Patrimônio Líquido */}
        <div className={kpiCard}>
          <div className="flex items-center justify-between">
            <span className={kpiLabel}>Patrimônio Líq.</span>
            <Wallet size={14} className="text-[color:var(--info)]" />
          </div>
          <p className={kpiValue} style={patrimonioLiquido < 0 ? { color: 'var(--danger)' } : undefined}>{formatarMoeda(patrimonioLiquido)}</p>
        </div>

        {/* Endividamento */}
        <div className={kpiCard}>
          <div className="flex items-center justify-between">
            <span className={kpiLabel}>Endividamento</span>
            <CreditCard size={14} className="text-[color:var(--danger)]" />
          </div>
          <p className={kpiValue}>{formatarMoeda(saldoDevedor)}</p>
        </div>

        {/* Proteção */}
        <div className={kpiCard}>
          <div className="flex items-center justify-between">
            <span className={kpiLabel}>Proteção</span>
            <HeartPulse size={14} style={{ color: corProtecao }} />
          </div>
          <p className={kpiValue} style={{ color: corProtecao }}>{Math.round(protecaoScore)}%</p>
        </div>

        {/* Checklist */}
        <div className={kpiCard}>
          <div className="flex items-center justify-between">
            <span className={kpiLabel}>Checklist</span>
            <ListChecks size={14} className="text-[color:var(--primary)]" />
          </div>
          <p className={kpiValue}>{checklist.total > 0 ? `${checklistPct}%` : '—'}</p>
          {checklist.total > 0 && <p className="text-[10px] text-faint -mt-1">{checklist.concluidos}/{checklist.total} concluídos</p>}
        </div>
      </div>

      {/* ── Pontos de Atenção ── */}
      <div className="bg-surface rounded-xl border border-subtle p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={15} className="text-faint" />
          <h3 className="text-[13px] font-semibold text-main">Pontos de atenção</h3>
        </div>
        {pontosAtencao.length === 0 ? (
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <CheckCircle2 size={15} className="text-[color:var(--primary)]" />
            Nenhum ponto crítico — cliente em dia nos principais pilares.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pontosAtencao.map((p, i) => (
              <button
                key={i}
                onClick={() => irPara(p.tab)}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg border text-[12px] font-medium transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  color: p.sev === 'danger' ? 'var(--danger)' : 'var(--warning)',
                  backgroundColor: p.sev === 'danger' ? 'rgba(248,113,113,0.10)' : 'rgba(251,191,36,0.10)',
                }}
              >
                {p.sev === 'danger' ? <AlertTriangle size={13} /> : <AlertCircle size={13} />}
                {p.label}
                <ChevronRight size={13} className="opacity-60" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Acordos (tabela) ── */}
      <section className="bg-surface rounded-xl border border-subtle overflow-hidden">
        <div className="px-4 py-3 border-b border-subtle flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-[color:var(--primary)]" />
            <h3 className="text-[13px] font-semibold text-main">Acordos</h3>
          </div>
          <Button onClick={openNovoContrato} size="sm" variant="primary" leftIcon={<Plus size={14} />}>
            Nova Ativação
          </Button>
        </div>

        {vigentes.length === 0 ? (
          <div className="py-10 text-center text-faint font-medium text-[12px]">Nenhum contrato ativo.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-subtle">
                  <th className={thCls}>Tipo</th>
                  <th className={thCls}>Descrição</th>
                  <th className={`${thCls} text-right`}>Bruto</th>
                  <th className={thCls}>Progresso</th>
                  <th className={`${thCls} text-center`}>Status</th>
                </tr>
              </thead>
              <tbody>
                {vigentes.map((c: any) => <LinhaAcordo key={c.id} c={c} />)}
              </tbody>
            </table>
          </div>
        )}

        {/* Encerrados — ocultos por padrão */}
        {encerrados.length > 0 && (
          <div className="border-t border-subtle">
            <button
              onClick={() => setAccordionEncerrados(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-2 transition-colors"
            >
              <span className="text-[12px] font-medium text-muted">
                Concluídos / Cancelados
                <span className="ml-2 px-1.5 py-0.5 rounded bg-surface-2 text-faint text-[11px] font-semibold">{encerrados.length}</span>
              </span>
              <ChevronRight size={14} className={`text-faint transition-transform ${accordionEncerrados ? 'rotate-90' : ''}`} />
            </button>
            {accordionEncerrados && (
              <div className="overflow-x-auto border-t border-subtle">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    {encerrados.map((c: any) => <LinhaAcordo key={c.id} c={c} encerrado />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Anotações Gerais ── */}
      <div className="bg-surface rounded-xl border border-subtle p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[13px] font-semibold text-main">Anotações gerais</h3>
          <Edit3 size={14} className="text-faint" />
        </div>
        <textarea
          className="w-full bg-surface-2 border border-subtle rounded-xl p-3 text-[13px] font-medium text-main focus:ring-2 focus:ring-emerald-500/20 focus:bg-surface focus:border-emerald-500 outline-none transition-all min-h-[120px] leading-relaxed placeholder:text-faint"
          placeholder="Mapeamento de dores e metas de curto prazo..."
          defaultValue={cliente.observacoes}
          onBlur={(e) => atualizarCliente(cliente.id!, { observacoes: e.target.value })}
        />
      </div>

      <ContratoFormDrawer
        open={modalContrato}
        onClose={() => setModalContrato(false)}
        cliente={cliente}
        contratoParaEditar={contratoParaEditar}
        onSaved={fetchData}
      />

      <SidePanel
        open={modalExtrato}
        onClose={() => setModalExtrato(false)}
        title="Extrato do Acordo"
        subtitle={contratoSelecionado?.descricao}
        widthClass="max-w-2xl"
        footer={
          contratoSelecionado && !cancelando && (
            <div className="flex gap-2">
              <button onClick={() => handleEditContrato(contratoSelecionado)} className="flex-1 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors flex items-center justify-center gap-1.5">
                <Edit3 size={14} /> Ajustar
              </button>
              {contratoSelecionado.status !== 'cancelado' && (
                <button onClick={abrirCancelamento} className="h-9 px-4 rounded-lg border border-subtle text-[color:var(--warning)] font-semibold text-[12px] hover:bg-surface-2 transition-colors flex items-center gap-1.5">
                  <Ban size={14} /> Cancelar
                </button>
              )}
              <button onClick={() => setModalExcluirConfirm(true)} className="h-9 px-4 rounded-lg border border-subtle text-[color:var(--danger)] font-semibold text-[12px] hover:bg-surface-2 transition-colors flex items-center gap-1.5">
                <Trash2 size={14} /> Remover
              </button>
            </div>
          )
        }
      >
        {contratoSelecionado && cancelando && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-[color:var(--danger)]" />
              <h3 className="text-[14px] font-semibold text-main">Cancelar contrato</h3>
            </div>
            <div>
              <label className={labelStyle}>Data do cancelamento</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-[11px] text-faint" />
                <input type="date" required value={cancelData.data_cancelamento}
                  onChange={e => setCancelData({ ...cancelData, data_cancelamento: e.target.value })}
                  className={`${inputStyle} pl-9`} />
              </div>
            </div>
            <div>
              <label className={labelStyle}>Data de inadimplência <span className="text-faint font-normal">(opcional)</span></label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-[11px] text-faint" />
                <input type="date" value={cancelData.data_inadimplencia}
                  onChange={e => setCancelData({ ...cancelData, data_inadimplencia: e.target.value })}
                  className={`${inputStyle} pl-9`} />
              </div>
              <p className="text-[11px] text-faint mt-1.5">
                Se anterior ao cancelamento, as parcelas são cortadas a partir dela, sem a carência (D+{contratoSelecionado.prazo_recebimento_dias || 0} dias).
              </p>
            </div>
            <div className="bg-surface-2 border border-subtle rounded-lg p-3">
              <p className="text-[11px] text-faint">
                Parcelas já pagas são preservadas. As demais com vencimento após a data de corte serão canceladas. O cliente ficará inativo se este for o último planejamento ativo.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setCancelando(false)} className="h-9 px-4 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors">Voltar</button>
              <button type="button" onClick={handleCancelarContrato} disabled={isSubmitting || !cancelData.data_cancelamento}
                className="flex-1 h-9 rounded-lg text-white font-semibold text-[12px] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--danger)' }}>
                <Ban size={14} /> {isSubmitting ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        )}

        {contratoSelecionado && !cancelando && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-faint">Situação atual</span>
              <Badge variant={contratoSelecionado.status === 'ativo' ? 'success' : contratoSelecionado.status === 'concluido' ? 'success' : 'danger'} size="sm">
                {contratoSelecionado.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-2 p-4 rounded-xl border border-subtle">
                <span className="text-[11px] text-faint block mb-1">Total líquido do contrato</span>
                <p className="text-[16px] font-bold text-main">{formatarMoeda(totalLiquidoEsperadoContrato)}</p>
              </div>
              <div className="bg-surface-2 p-4 rounded-xl border border-subtle">
                <span className="text-[11px] text-faint block mb-1">Líquido conciliado</span>
                <p className="text-[16px] font-bold text-[color:var(--primary)]">{formatarMoeda(totalLiquidoConciliado)}</p>
              </div>
            </div>

            <div className="bg-surface border border-subtle rounded-xl overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-2 border-b border-subtle">
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-faint tracking-wider">Vencimento</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-faint tracking-wider text-right">Valor bruto</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-faint tracking-wider">Recebimento</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-[color:var(--primary)] tracking-wider text-right">Valor líquido</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-faint tracking-wider text-center">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold uppercase text-faint tracking-wider text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {parcelasContrato.map((p) => {
                    const fator = (contratoSelecionado.repasse_percentual || 100) / 100;
                    const valLiquido = p.status === 'pago' ? p.valor_pago : p.valor_previsto * fator;

                    return (
                      <tr key={p.id} className={`hover:bg-surface-2 transition-colors ${p.status === 'cancelado' ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-3 font-semibold text-main text-[13px] whitespace-nowrap">{formatarData(p.data_vencimento)}</td>
                        <td className="px-4 py-3 font-medium text-muted text-[13px] text-right whitespace-nowrap">{formatarMoeda(p.valor_previsto)}</td>
                        <td className="px-4 py-3 font-medium text-muted text-[13px] whitespace-nowrap">{p.status === 'pago' ? formatarData(p.data_pagamento) : '—'}</td>
                        <td className="px-4 py-3 font-semibold text-[color:var(--primary)] text-[13px] text-right whitespace-nowrap">{formatarMoeda(valLiquido || 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${p.status === 'pago' ? 'text-[color:var(--primary)] bg-[rgba(16,185,129,0.12)] border-[rgba(16,185,129,0.25)]' :
                            p.status === 'atrasado' ? 'text-[color:var(--danger)] bg-[rgba(248,113,113,0.12)] border-[rgba(248,113,113,0.25)]' :
                              'bg-surface-2 text-faint border-subtle'
                            }`}>
                            {p.status === 'pago' ? <CheckCircle2 size={10} /> : p.status === 'atrasado' ? <AlertTriangle size={10} /> : <Clock size={10} />}
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {(p.status === 'pendente' || p.status === 'atrasado') && contratoSelecionado.status === 'ativo' && (
                            <button onClick={() => setBaixaTarget(p)} className="text-[color:var(--primary)] font-semibold text-[11px] hover:underline">Baixar líquido</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SidePanel>

      <Confirmacao
        isOpen={modalExcluirConfirm}
        onClose={() => setModalExcluirConfirm(false)}
        loading={removendo}
        onConfirm={async () => {
          setRemovendo(true);
          try {
            await deletarContrato(contratoSelecionado.id);
            setModalExcluirConfirm(false);
            setModalExtrato(false);
            fetchData();
          } catch (err) { alert("Erro ao deletar."); }
          finally { setRemovendo(false); }
        }}
        title="Remover Acordo"
        message={`Deseja realmente excluir o contrato "${contratoSelecionado?.descricao}"? Todos os lançamentos financeiros vinculados também serão removidos.`}
      />

      <Confirmacao
        isOpen={!!baixaTarget}
        onClose={() => setBaixaTarget(null)}
        onConfirm={confirmarBaixa}
        loading={baixando}
        danger={false}
        confirmLabel="Confirmar recebimento"
        title="Baixar parcela"
        message={baixaTarget ? `Confirmar recebimento líquido de ${formatarMoeda(baixaTarget.valor_previsto * ((contratoSelecionado?.repasse_percentual || 100) / 100))}?` : ''}
      />
    </div>
  );
};

export default AbaResumo;
