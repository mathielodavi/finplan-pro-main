
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Cliente, atualizarCliente } from '../../services/clienteService';
import { obterContratosPorCliente, criarContrato, atualizarContrato, deletarContrato } from '../../services/contratoService';
import { reuniaoService, Reuniao } from '../../services/reuniaoService';
import { configService } from '../../services/configuracoesService';
import { financeiroService, Parcela } from '../../services/financeiroService';
import { investimentoService } from '../../services/investimentoService';
import { dividasService } from '../../services/dividasService';
import { protecaoService } from '../../services/protecaoService';
import { acompanhamentoService } from '../../services/acompanhamentoService';
import { formatarMoeda, formatarData, toLocalDateString } from '../../utils/formatadores';
import { calcularTermometro } from '../../utils/termometroUtils';
import { categorizarAgendaCliente } from '../../utils/agendaUtils';
import { useProntuarioNav } from '../../context/ProntuarioNavContext';
import SidePanel from '../UI/SidePanel';
import Badge from '../UI/Badge';
import Button from '../UI/Button';
import Confirmacao from '../Confirmacao';
import { Activity, Plus, FileText, ChevronRight, DollarSign, Clock, CheckCircle2, AlertTriangle, Edit3, Trash2, Calendar, ArrowRight, ArrowLeft, Wallet, Zap, CreditCard, HeartPulse, ListChecks, AlertCircle } from 'lucide-react';

interface AbaResumoProps {
  cliente: Cliente;
  onUpdate: () => void;
}

const AbaResumo: React.FC<AbaResumoProps> = ({ cliente, onUpdate }) => {
  const { nav } = useProntuarioNav();
  const [contratos, setContratos] = useState<any[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [roteirosPadrao, setRoteirosPadrao] = useState<any[]>([]);
  const [padroesPlanejamento, setPadroesPlanejamento] = useState<any[]>([]);
  const [padroesExtras, setPadroesExtras] = useState<any[]>([]);
  // Dados cross-domain para a central de controle
  const [patrimonioInvestido, setPatrimonioInvestido] = useState(0);
  const [saldoDevedor, setSaldoDevedor] = useState(0);
  const [protecaoScore, setProtecaoScore] = useState(0);
  const [checklist, setChecklist] = useState({ total: 0, concluidos: 0 });
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [modalContrato, setModalContrato] = useState(false);
  const [modalExtrato, setModalExtrato] = useState(false);
  const [modalExcluirConfirm, setModalExcluirConfirm] = useState(false);

  const [contratoSelecionado, setContratoSelecionado] = useState<any>(null);
  const [parcelasContrato, setParcelasContrato] = useState<Parcela[]>([]);
  const [loadingParcelas, setLoadingParcelas] = useState(false);

  const [step, setStep] = useState(1);
  const [accordionEncerrados, setAccordionEncerrados] = useState(false);
  const [formContrato, setFormContrato] = useState({
    id: '',
    categoria: 'planejamento' as 'planejamento' | 'extra',
    forma_pagamento: 'parcelado' as 'vista' | 'parcelado',
    padrao_id: '',
    ticket_mensal: 0,
    prazo_meses: 12,
    prazo_recebimento_dias: 30,
    repasse_percentual: 100,
    data_inicio: new Date().toISOString().split('T')[0],
    descricao: '',
    status: 'ativo' as any,
    data_cancelamento: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cData, rData, roteiros, pPlan, pExt, ativos, creditos, consorcios, score, itensChecklist] = await Promise.all([
        obterContratosPorCliente(cliente.id!),
        reuniaoService.getPorCliente(cliente.id!),
        configService.getAcompanhamentos(),
        configService.getPlanejamento(),
        configService.getExtras(),
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
      setPadroesPlanejamento(pPlan || []);
      setPadroesExtras(pExt || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [cliente.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const aplicarPadrao = useCallback((padraoId: string, categoria: string) => {
    if (!padraoId) return;
    const lista = categoria === 'planejamento' ? padroesPlanejamento : padroesExtras;
    const p = lista.find(item => item.id === padraoId);
    if (p) {
      const temIlimitado = p.fases?.some((f: any) => f.mes_fim === null);
      let duracaoTotal = temIlimitado ? 24 : (p.prazo_meses || 12);

      if (categoria === 'extra' && !p.recorrente) {
        duracaoTotal = 12;
      } else if (categoria === 'extra' && p.fases && p.fases.length > 0 && !temIlimitado) {
        duracaoTotal = p.fases.reduce((acc: number, f: any) => acc + (f.mes_fim || 0), 0);
      }

      setFormContrato(prev => ({
        ...prev,
        padrao_id: padraoId,
        prazo_recebimento_dias: p.prazo_recebimento_medio_dias || p.prazo_recebimento_parcelado_dias || 30,
        ticket_mensal: Math.round((p.valor || 0) * 100) / 100,
        prazo_meses: duracaoTotal,
        repasse_percentual: p.percentual_repasse_liquido || p.percentual_repasse || 100,
        descricao: p.nome
      }));
    }
  }, [padroesPlanejamento, padroesExtras]);

  const fluxoProjetado = useMemo(() => {
    const parcelas = [];
    const [year, month, day] = formContrato.data_inicio.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day, 12, 0, 0);
    const netTransfer = formContrato.repasse_percentual / 100;

    if (formContrato.categoria === 'extra' && formContrato.padrao_id) {
      const padrao = padroesExtras.find(p => p.id === formContrato.padrao_id);
      if (padrao && padrao.fases && padrao.fases.length > 0) {
        if (padrao.tem_bonus && padrao.taxa_bonus > 0) {
          const dataBonus = new Date(baseDate);
          dataBonus.setDate(baseDate.getDate() + (padrao.prazo_bonus_dias || 0));
          const mesReferenciaBonus = Math.floor((padrao.prazo_bonus_dias || 0) / 30);
          const valorBrutoBonus = formContrato.ticket_mensal * (padrao.taxa_bonus / 100);
          parcelas.push({
            num: 0,
            tipo: 'BÔNUS',
            vencimento: toLocalDateString(dataBonus),
            valorBruto: valorBrutoBonus,
            valorLiquido: valorBrutoBonus * netTransfer,
            repasseLabel: `BÔNUS ${padrao.taxa_bonus}% → NET ${formContrato.repasse_percentual}%`,
            ordemSort: mesReferenciaBonus + 0.5
          });
        }

        let mesGlobal = 0;
        const fases = [...(padrao.fases || [])].sort((a, b) => a.ordem - b.ordem);
        const limiteReal = padrao.recorrente
          ? (padrao.fases.some((f: any) => f.mes_fim === null) ? 24 : formContrato.prazo_meses)
          : formContrato.prazo_meses;

        fases.forEach(fase => {
          const mesesNestaFase = fase.mes_fim === null ? limiteReal : (fase.mes_fim || 1);
          for (let i = 1; i <= mesesNestaFase; i++) {
            mesGlobal++;
            if (mesGlobal > limiteReal) break;
            const vencimento = new Date(baseDate);
            vencimento.setDate(baseDate.getDate() + formContrato.prazo_recebimento_dias);
            vencimento.setMonth(vencimento.getMonth() + (mesGlobal - 1));
            const valorBruto = formContrato.ticket_mensal;
            const taxaRepasseFase = fase.percentual_repasse / 100;
            const valorLiquido = valorBruto * taxaRepasseFase * netTransfer;
            parcelas.push({
              num: mesGlobal,
              tipo: 'PARCELA',
              vencimento: toLocalDateString(vencimento),
              valorBruto: valorBruto,
              valorLiquido: valorLiquido,
              repasseLabel: `REPASSE ${fase.percentual_repasse}% → NET ${formContrato.repasse_percentual}%`,
              ordemSort: mesGlobal
            });
          }
        });
        return parcelas.sort((a, b) => a.ordemSort - b.ordemSort);
      }
    }

    const numParcelas = formContrato.forma_pagamento === 'vista' ? 1 : formContrato.prazo_meses;
    const valorParcelaBruto = formContrato.forma_pagamento === 'vista'
      ? formContrato.ticket_mensal * formContrato.prazo_meses
      : formContrato.ticket_mensal;

    for (let i = 0; i < numParcelas; i++) {
      const vencimento = new Date(baseDate);
      vencimento.setDate(baseDate.getDate() + formContrato.prazo_recebimento_dias);
      vencimento.setMonth(vencimento.getMonth() + i);
      parcelas.push({
        num: i + 1,
        tipo: formContrato.forma_pagamento === 'vista' ? 'À VISTA' : 'PARCELA',
        vencimento: toLocalDateString(vencimento),
        valorBruto: valorParcelaBruto,
        valorLiquido: valorParcelaBruto * netTransfer,
        repasseLabel: `NET ${formContrato.repasse_percentual}%`,
        ordemSort: i + 1
      });
    }
    return parcelas;
  }, [formContrato, padroesExtras]);

  const receitaLiquidaTotal = useMemo(() => fluxoProjetado.reduce((acc, curr) => acc + curr.valorLiquido, 0), [fluxoProjetado]);
  const valorTotalBruto = useMemo(() => fluxoProjetado.reduce((acc, curr) => acc + curr.valorBruto, 0), [fluxoProjetado]);

  const openNovoContrato = () => {
    setStep(1);
    setSaveSuccess(false);
    setFormContrato({
      id: '', categoria: 'planejamento', forma_pagamento: 'parcelado', padrao_id: '',
      ticket_mensal: 0, prazo_meses: 12, prazo_recebimento_dias: 30, repasse_percentual: 100,
      data_inicio: new Date().toISOString().split('T')[0], descricao: '', status: 'ativo', data_cancelamento: ''
    });
    setModalContrato(true);
  };

  const handleEditContrato = (c: any) => {
    // CORREÇÃO: Reversão do ticket mensal ao editar
    let derivedTicket = 0;
    if (c.tipo === 'extra' && c.padrao_id) {
      const padrao = padroesExtras.find(p => p.id === c.padrao_id);
      const pesoBonus = (padrao?.tem_bonus && padrao?.taxa_bonus > 0) ? (padrao.taxa_bonus / 100) : 0;
      const divisorReal = (c.prazo_meses || 1) + pesoBonus;
      derivedTicket = c.valor / divisorReal;
    } else {
      // Para contratos de planejamento, o ticket mensal SEMPRE é o valor total / prazo em meses,
      // independente se foi pago à vista ou parcelado.
      derivedTicket = c.valor / (c.prazo_meses || 12);
    }

    setFormContrato({
      id: c.id, categoria: c.tipo, forma_pagamento: c.forma_pagamento || 'parcelado',
      padrao_id: c.padrao_id || '', ticket_mensal: Math.round(derivedTicket * 100) / 100,
      prazo_meses: c.prazo_meses, prazo_recebimento_dias: c.prazo_recebimento_dias || 30,
      repasse_percentual: c.repasse_percentual || 100, data_inicio: c.data_inicio,
      descricao: c.descricao, status: c.status, data_cancelamento: c.data_fim || ''
    });
    setStep(2);
    setSaveSuccess(false);
    setModalExtrato(false);
    setModalContrato(true);
  };

  const handleFinalizarAcordo = async () => {
    setIsSubmitting(true);
    try {
      let dataFim = formContrato.status === 'cancelado' ? formContrato.data_cancelamento : null;
      if (formContrato.status !== 'cancelado' && formContrato.data_inicio && formContrato.prazo_meses) {
        const [y, m, d] = formContrato.data_inicio.split('-').map(Number);
        const dtInicio = new Date(y, m - 1, d);
        dtInicio.setMonth(dtInicio.getMonth() + parseInt(formContrato.prazo_meses.toString()));
        dataFim = dtInicio.toISOString().split('T')[0];
      }

      const payload = {
        cliente_id: cliente.id!, tipo: formContrato.categoria, valor: valorTotalBruto,
        repasse_percentual: formContrato.repasse_percentual, forma_pagamento: formContrato.forma_pagamento,
        prazo_meses: formContrato.prazo_meses, prazo_recebimento_dias: formContrato.prazo_recebimento_dias,
        descricao: formContrato.descricao, data_inicio: formContrato.data_inicio,
        status: formContrato.status, data_fim: dataFim,
        padrao_id: formContrato.padrao_id || null
      };
      if (formContrato.id) await atualizarContrato(formContrato.id, payload);
      else await criarContrato(payload);
      setSaveSuccess(true);
      setTimeout(() => { setModalContrato(false); fetchData(); }, 1500);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally { setIsSubmitting(false); }
  };

  const handleAbrirExtrato = async (contrato: any) => {
    setContratoSelecionado(contrato);
    setLoadingParcelas(true);
    setModalExtrato(true);
    try {
      const data = await financeiroService.obterParcelasPorContrato(contrato.id);
      setParcelasContrato(data || []);
    } finally { setLoadingParcelas(false); }
  };

  const handleBaixarParcela = async (parcela: Parcela) => {
    const fatorRepasse = (contratoSelecionado.repasse_percentual || 100) / 100;
    const valorLiquido = parcela.valor_previsto * fatorRepasse;

    if (!window.confirm(`Confirmar recebimento líquido de ${formatarMoeda(valorLiquido)}?`)) return;
    try {
      await financeiroService.registrarPagamento(parcela.id, valorLiquido, new Date().toISOString());
      const data = await financeiroService.obterParcelasPorContrato(contratoSelecionado.id);
      setParcelasContrato(data || []);
      fetchData();
    } catch (err) { alert("Erro ao baixar parcela."); }
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

      <SidePanel
        open={modalContrato}
        onClose={() => setModalContrato(false)}
        title={formContrato.id ? 'Ajustar Parâmetros do Acordo' : 'Nova Ativação Estratégica'}
        subtitle={cliente.nome}
        widthClass="max-w-2xl"
      >
        <div className="space-y-6 animate-fade-in">
          {!saveSuccess && (
            <div className="flex items-center justify-center gap-2 mb-1">
              {[1, 2, 3].map(i => (
                <React.Fragment key={i}>
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center font-semibold text-[12px] transition-all ${step >= i ? 'text-[#0b0e14]' : 'bg-surface-2 text-faint'}`}
                    style={step >= i ? { backgroundColor: 'var(--primary)' } : undefined}
                  >
                    {step > i ? <CheckCircle2 size={14} /> : i}
                  </div>
                  {i < 3 && (
                    <div className={`h-0.5 w-8 rounded-full ${step > i ? '' : 'bg-surface-2'}`} style={step > i ? { backgroundColor: 'var(--primary)' } : undefined} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          {saveSuccess ? (
            <div className="py-16 text-center space-y-3">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto text-[color:var(--primary)]" style={{ backgroundColor: 'var(--primary-soft)' }}>
                <CheckCircle2 size={28} strokeWidth={2.5} />
              </div>
              <h3 className="text-[16px] font-semibold text-main">Acordo formalizado</h3>
              <p className="text-[13px] text-faint">Sincronizando fluxo de caixa com o motor financeiro...</p>
            </div>
          ) : (
            <>
              {step === 1 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => { setFormContrato({ ...formContrato, categoria: 'planejamento', padrao_id: '' }); setStep(2); }}
                    className="p-6 bg-surface-2 border border-subtle rounded-xl hover:border-primary transition-colors flex flex-col items-center text-center gap-3"
                  >
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center text-[color:var(--primary)]" style={{ backgroundColor: 'var(--primary-soft)' }}>
                      <FileText size={22} />
                    </div>
                    <div>
                      <h4 className="text-[14px] font-semibold text-main">Planejamento</h4>
                      <p className="text-[11px] text-faint mt-1">Consultoria e ciclos anuais</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setFormContrato({ ...formContrato, categoria: 'extra', padrao_id: '' }); setStep(2); }}
                    className="p-6 bg-surface-2 border border-subtle rounded-xl hover:border-[color:var(--warning)] transition-colors flex flex-col items-center text-center gap-3"
                  >
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center text-[color:var(--warning)]" style={{ backgroundColor: 'rgba(251,191,36,0.12)' }}>
                      <Plus size={22} />
                    </div>
                    <div>
                      <h4 className="text-[14px] font-semibold text-main">Serviços Extras</h4>
                      <p className="text-[11px] text-faint mt-1">Implementações sob demanda</p>
                    </div>
                  </button>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-6 animate-slide-up">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelStyle}>Status do Acordo</label>
                      <select
                        value={formContrato.status}
                        onChange={e => {
                          const status = e.target.value as any;
                          setFormContrato({
                            ...formContrato,
                            status,
                            data_cancelamento: status === 'cancelado'
                              ? (formContrato.data_cancelamento || new Date().toISOString().split('T')[0])
                              : formContrato.data_cancelamento
                          });
                        }}
                        className={inputStyle}
                      >
                        <option value="ativo">Ativo</option>
                        <option value="concluido">Concluído</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelStyle}>Padrão de Recebimento <span className="text-[color:var(--danger)]">*</span></label>
                      <select
                        value={formContrato.padrao_id}
                        onChange={e => aplicarPadrao(e.target.value, formContrato.categoria)}
                        className={inputStyle}
                        required
                      >
                        <option value="" disabled>Selecione um padrão...</option>
                        {(formContrato.categoria === 'planejamento' ? padroesPlanejamento : padroesExtras).map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                      {!formContrato.padrao_id && (
                        <p className="text-[11px] text-[color:var(--warning)] font-medium mt-1.5">Selecione um padrão — ele define duração, repasse e prazo de recebimento.</p>
                      )}
                    </div>
                    {formContrato.status === 'cancelado' && (
                      <div className="sm:col-span-2 bg-surface-2 p-3 rounded-lg border border-subtle">
                        <label className={`${labelStyle} !text-[color:var(--danger)]`}>Data Efetiva de Cancelamento</label>
                        <div className="relative">
                          <Calendar size={14} className="absolute left-3 top-[11px] text-faint" />
                          <input
                            type="date"
                            required
                            value={formContrato.data_cancelamento || ''}
                            onChange={e => setFormContrato({ ...formContrato, data_cancelamento: e.target.value })}
                            className={`${inputStyle} pl-9`}
                          />
                        </div>
                        <p className="text-[11px] text-faint mt-2">O motor de encerramento blinda parcelas passadas. Apenas parcelas com repasse posterior a D+{formContrato.prazo_recebimento_dias || 0} dias desta data serão descartadas.</p>
                      </div>
                    )}
                    <div>
                      <label className={labelStyle}>Data Base do Acordo</label>
                      <div className="relative">
                        <Calendar size={14} className="absolute left-3 top-[11px] text-faint" />
                        <input type="date" required value={formContrato.data_inicio} onChange={e => setFormContrato({ ...formContrato, data_inicio: e.target.value })} className={`${inputStyle} pl-9`} />
                      </div>
                    </div>
                    <div>
                      <label className={labelStyle}>Forma de Pagamento</label>
                      <div className="flex bg-surface-2 p-1 rounded-lg h-9 border border-subtle">
                        <button
                          type="button"
                          onClick={() => setFormContrato({ ...formContrato, forma_pagamento: 'vista' })}
                          className={`flex-1 text-[12px] font-semibold rounded-md transition-all ${formContrato.forma_pagamento === 'vista' ? 'bg-surface text-[color:var(--primary)] shadow-sm' : 'text-faint hover:text-muted'}`}
                        >
                          À Vista
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormContrato({ ...formContrato, forma_pagamento: 'parcelado' })}
                          className={`flex-1 text-[12px] font-semibold rounded-md transition-all ${formContrato.forma_pagamento === 'parcelado' ? 'bg-surface text-[color:var(--primary)] shadow-sm' : 'text-faint hover:text-muted'}`}
                        >
                          Parcelado
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelStyle}>{formContrato.categoria === 'extra' ? 'Mensalidade Bruta' : 'Ticket Mensal'}</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-[11px] text-faint" />
                        <input type="number" step="0.01" required value={formContrato.ticket_mensal} onChange={e => setFormContrato({ ...formContrato, ticket_mensal: Math.round(parseFloat(e.target.value) * 100) / 100 || 0 })} className={`${inputStyle} pl-9`} />
                      </div>
                    </div>
                    {/* Duração, repasse e prazo de recebimento vêm do padrão (somente leitura) */}
                    {formContrato.padrao_id && (
                      <>
                        <div>
                          <label className={labelStyle}>Duração <span className="text-faint font-normal">(do padrão)</span></label>
                          <div className="relative">
                            <Clock size={14} className="absolute left-3 top-[11px] text-faint" />
                            <input type="text" readOnly value={`${formContrato.prazo_meses} meses`} className={`${inputStyle} pl-9 bg-surface-2 text-muted cursor-not-allowed`} />
                          </div>
                        </div>
                        <div>
                          <label className={labelStyle}>Repasse líquido <span className="text-faint font-normal">(do padrão)</span></label>
                          <input type="text" readOnly value={`${formContrato.repasse_percentual}%`} className={`${inputStyle} bg-surface-2 text-muted cursor-not-allowed`} />
                        </div>
                        <div>
                          <label className={labelStyle}>Prazo de recebimento <span className="text-faint font-normal">(do padrão)</span></label>
                          <input type="text" readOnly value={`D+${formContrato.prazo_recebimento_dias} dias`} className={`${inputStyle} bg-surface-2 text-muted cursor-not-allowed`} />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="bg-surface-2 border border-subtle rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <span className="text-[11px] text-faint">Expectativa líquida total</span>
                      <p className="text-[18px] font-bold text-[color:var(--primary)] leading-tight mt-0.5">{formatarMoeda(receitaLiquidaTotal)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-faint">Duração do fluxo</span>
                      <p className="text-[14px] font-semibold text-main leading-tight mt-0.5">{formContrato.forma_pagamento === 'vista' ? 'Único' : `${formContrato.prazo_meses} meses`}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!formContrato.id && (
                      <button type="button" onClick={() => setStep(1)} className="h-9 px-4 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors flex items-center gap-1.5">
                        <ArrowLeft size={14} /> Voltar
                      </button>
                    )}
                    <button
                      onClick={() => setStep(3)}
                      disabled={!formContrato.padrao_id || formContrato.ticket_mensal <= 0}
                      className="flex-1 h-9 rounded-lg text-[#0b0e14] font-semibold text-[12px] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      Validar sequenciamento
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-6 animate-slide-up">
                  <div className="bg-surface-2 p-4 rounded-xl border border-subtle grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div><p className="text-[11px] text-faint mb-1">Categoria</p><p className="text-[13px] font-semibold text-main capitalize">{formContrato.categoria}</p></div>
                    <div><p className="text-[11px] text-faint mb-1">Vigência</p><p className="text-[13px] font-semibold text-main">{formContrato.prazo_meses} meses</p></div>
                    <div><p className="text-[11px] text-faint mb-1">Repasse líquido</p><Badge variant="success" size="sm">{formContrato.repasse_percentual}%</Badge></div>
                    <div><p className="text-[11px] text-faint mb-1">Ticket bruto</p><p className="text-[13px] font-semibold text-main">{formatarMoeda(formContrato.ticket_mensal)}</p></div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-[color:var(--primary)]" />
                      <h4 className="text-[11px] font-semibold text-faint uppercase tracking-wider">Escalonamento de recebíveis (D+{formContrato.prazo_recebimento_dias})</h4>
                    </div>
                    <div className="bg-surface border border-subtle rounded-xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-surface-2 border-b border-subtle z-10">
                          <tr>
                            <th className="px-4 py-2.5 text-[11px] font-semibold text-faint uppercase tracking-wider">Referência</th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold text-faint uppercase tracking-wider text-center">Data est.</th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold text-faint uppercase tracking-wider text-right">Valor bruto</th>
                            <th className="px-4 py-2.5 text-[11px] font-semibold text-[color:var(--primary)] uppercase tracking-wider text-right">Repasse líquido</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                          {fluxoProjetado.map((parc, idx) => (
                            <tr key={idx} className={`hover:bg-surface-2 transition-colors ${parc.tipo === 'BÔNUS' ? 'bg-surface-2/50' : ''}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  {parc.tipo === 'BÔNUS' ? <Zap size={13} className="text-indigo-500" /> : <Clock size={13} className="text-faint" />}
                                  <div>
                                    <p className={`text-[12px] font-semibold ${parc.tipo === 'BÔNUS' ? 'text-indigo-500' : 'text-main'}`}>{parc.tipo === 'BÔNUS' ? 'Bônus ativação' : `Mês ${String(parc.num).padStart(2, '0')}`}</p>
                                    <span className="text-[10px] text-faint block mt-0.5">{parc.repasseLabel}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-[12px] text-main text-center">{formatarData(parc.vencimento)}</td>
                              <td className="px-4 py-3 text-[12px] text-main text-right">{formatarMoeda(parc.valorBruto)}</td>
                              <td className="px-4 py-3 text-[12px] font-semibold text-[color:var(--primary)] text-right">{formatarMoeda(parc.valorLiquido)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setStep(2)} className="h-9 px-4 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors">Ajustar dados</button>
                    <button onClick={handleFinalizarAcordo} disabled={isSubmitting} className="flex-1 h-9 rounded-lg text-[#0b0e14] font-semibold text-[12px] transition-all flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: 'var(--primary)' }}>
                      {isSubmitting ? 'Sincronizando...' : 'Confirmar ativação'}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SidePanel>

      <SidePanel
        open={modalExtrato}
        onClose={() => setModalExtrato(false)}
        title="Extrato do Acordo"
        subtitle={contratoSelecionado?.descricao}
        widthClass="max-w-2xl"
        footer={
          contratoSelecionado && (
            <div className="flex gap-2">
              <button onClick={() => handleEditContrato(contratoSelecionado)} className="flex-1 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors flex items-center justify-center gap-1.5">
                <Edit3 size={14} /> Ajustar
              </button>
              <button onClick={() => setModalExcluirConfirm(true)} className="h-9 px-4 rounded-lg border border-subtle text-[color:var(--danger)] font-semibold text-[12px] hover:bg-surface-2 transition-colors flex items-center gap-1.5">
                <Trash2 size={14} /> Remover
              </button>
            </div>
          )
        }
      >
        {contratoSelecionado && (
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
                            <button onClick={() => handleBaixarParcela(p)} className="text-[color:var(--primary)] font-semibold text-[11px] hover:underline">Baixar líquido</button>
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
        onConfirm={async () => {
          try {
            await deletarContrato(contratoSelecionado.id);
            setModalExcluirConfirm(false);
            setModalExtrato(false);
            fetchData();
          } catch (err) { alert("Erro ao deletar."); }
        }}
        title="Remover Acordo"
        message={`Deseja realmente excluir o contrato "${contratoSelecionado?.descricao}"? Todos os lançamentos financeiros vinculados também serão removidos.`}
      />
    </div>
  );
};

export default AbaResumo;
