
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Cliente, atualizarCliente } from '../../services/clienteService';
import { obterContratosPorCliente, criarContrato, atualizarContrato, deletarContrato } from '../../services/contratoService';
import { reuniaoService, Reuniao } from '../../services/reuniaoService';
import { configService } from '../../services/configuracoesService';
import { financeiroService, Parcela } from '../../services/financeiroService';
import { formatarMoeda, formatarData, toLocalDateString } from '../../utils/formatadores';
import { calcularTermometro } from '../../utils/termometroUtils';
import Modal from '../Modal';
import Badge from '../UI/Badge';
import Confirmacao from '../Confirmacao';
import { Activity, Plus, FileText, ChevronRight, ShieldCheck, DollarSign, Clock, CheckCircle2, AlertTriangle, Edit3, Trash2, Layout, Calendar, ArrowRight, ArrowLeft, Wallet, Info, Zap } from 'lucide-react';

interface AbaResumoProps {
  cliente: Cliente;
  onUpdate: () => void;
}

const AbaResumo: React.FC<AbaResumoProps> = ({ cliente, onUpdate }) => {
  const [contratos, setContratos] = useState<any[]>([]);
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [roteirosPadrao, setRoteirosPadrao] = useState<any[]>([]);
  const [padroesPlanejamento, setPadroesPlanejamento] = useState<any[]>([]);
  const [padroesExtras, setPadroesExtras] = useState<any[]>([]);
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
  const [accordionVigentes, setAccordionVigentes] = useState(true);
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
      const [cData, rData, roteiros, pPlan, pExt] = await Promise.all([
        obterContratosPorCliente(cliente.id!),
        reuniaoService.getPorCliente(cliente.id!),
        configService.getAcompanhamentos(),
        configService.getPlanejamento(),
        configService.getExtras()
      ]);

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

  const showDuracaoInput = useMemo(() => {
    if (!formContrato.padrao_id) return true;
    if (formContrato.categoria === 'planejamento') return false;
    const padrao = padroesExtras.find(p => p.id === formContrato.padrao_id);
    if (!padrao) return true;
    if (padrao.recorrente === false) return true;
    return false;
  }, [formContrato.padrao_id, formContrato.categoria, padroesExtras]);

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
    for (let i = 0; i < numParcelas; i++) {
      const vencimento = new Date(baseDate);
      vencimento.setDate(baseDate.getDate() + formContrato.prazo_recebimento_dias);
      vencimento.setMonth(vencimento.getMonth() + i);
      parcelas.push({
        num: i + 1,
        tipo: 'PARCELA',
        vencimento: toLocalDateString(vencimento),
        valorBruto: formContrato.ticket_mensal,
        valorLiquido: formContrato.ticket_mensal * netTransfer,
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
      derivedTicket = c.forma_pagamento === 'vista' ? c.valor : c.valor / (c.prazo_meses || 12);
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
        padrao_id: formContrato.categoria === 'extra' ? (formContrato.padrao_id || null) : null
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

  const labelStyle = "text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2";
  const inputStyle = "w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-600 transition-all text-sm";

  return (
    <div className="grid grid-cols-1 gap-8 animate-fade-in">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Saúde do Relacionamento</span>
                <h4 className="text-lg font-black mt-1" style={{ color: termometro.cor }}>{termometro.status}</h4>
              </div>
              <div className="p-2 rounded-xl bg-slate-50" style={{ color: termometro.cor }}><Activity size={18} /></div>
            </div>
            <div className="space-y-3">
              <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                <div className="h-full transition-all duration-1000 ease-out" style={{ width: `${termometro.percentual}%`, backgroundColor: termometro.cor }} />
              </div>
              <p className="text-[10px] font-bold text-slate-400 leading-tight italic">{termometro.percentual}% de engajamento estimado</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo Ativo</span>
              <Layout size={18} className="text-emerald-500 opacity-30" />
            </div>
            <div className="relative group">
              <select
                value={cliente.protocolo_id || ''}
                onChange={handleMetodologiaChange}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-emerald-600 uppercase text-[10px] outline-none appearance-none cursor-pointer transition-colors hover:border-emerald-500"
              >
                <option value="">Vincular Checklist...</option>
                {roteirosPadrao.map(r => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
              <ChevronRight size={14} className="absolute right-4 top-4 rotate-90 text-slate-300 pointer-events-none" />
            </div>
          </div>
        </div>

        <section className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-emerald-600" />
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Acordos</h3>
            </div>
            <button onClick={openNovoContrato} className="flex items-center gap-2 text-emerald-600 font-black text-[9px] uppercase tracking-widest bg-emerald-50 px-5 py-2.5 rounded-xl hover:bg-emerald-600 hover:text-white transition-all">
              <Plus size={14} strokeWidth={3} /> Nova Ativação
            </button>
          </div>

          {/* Acordeão: Vigentes */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <button
              onClick={() => setAccordionVigentes(v => !v)}
              className="w-full flex items-center justify-between px-6 py-4 bg-slate-50/60 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={16} className="text-emerald-500" />
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                  Vigentes
                  {contratos.filter((c: any) => c.status === 'ativo').length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px]">
                      {contratos.filter((c: any) => c.status === 'ativo').length}
                    </span>
                  )}
                </span>
              </div>
              <ChevronRight size={14} className={`text-slate-400 transition-transform ${accordionVigentes ? 'rotate-90' : ''}`} />
            </button>
            {accordionVigentes && (
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contratos.filter((c: any) => c.status === 'ativo').length === 0 ? (
                    <div className="col-span-2 py-8 text-center border border-dashed border-slate-100 rounded-2xl text-slate-300 font-bold uppercase text-[10px] tracking-widest">Nenhum contrato ativo.</div>
                  ) : contratos.filter((c: any) => c.status === 'ativo').map((c: any) => {
                    const totalP = c.totalParcelas || 1;
                    const pagasP = c.pagas || 0;
                    const percQuantidade = Math.min((pagasP / totalP) * 100, 100);
                    return (
                      <div key={c.id} onClick={() => handleAbrirExtrato(c)} className="p-6 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col gap-5 group hover:bg-white hover:border-emerald-200 hover:shadow-lg transition-all cursor-pointer">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${c.tipo === 'planejamento' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{c.tipo}</span>
                            <p className="text-xs font-black text-slate-800 leading-tight uppercase line-clamp-1">{c.descricao}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900 leading-none">{formatarMoeda(c.valor)}</p>
                            <span className="text-[7px] font-bold text-slate-400 uppercase mt-0.5 block">Valor Bruto Total</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-slate-400">
                            <span>Status: {c.pagas}/{c.totalParcelas} parcelas</span>
                            <span className="text-emerald-600">{percQuantidade.toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${percQuantidade}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Acordeão: Encerrados */}
          {contratos.filter((c: any) => c.status !== 'ativo').length > 0 && (
            <div className="border border-slate-100 rounded-2xl overflow-hidden">
              <button
                onClick={() => setAccordionEncerrados(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 bg-slate-50/60 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-slate-400" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Concluídos / Cancelados
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px]">
                      {contratos.filter((c: any) => c.status !== 'ativo').length}
                    </span>
                  </span>
                </div>
                <ChevronRight size={14} className={`text-slate-400 transition-transform ${accordionEncerrados ? 'rotate-90' : ''}`} />
              </button>
              {accordionEncerrados && (
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {contratos.filter((c: any) => c.status !== 'ativo').map((c: any) => {
                      const totalP = c.totalParcelas || 1;
                      const pagasP = c.pagas || 0;
                      const percQuantidade = Math.min((pagasP / totalP) * 100, 100);
                      return (
                        <div key={c.id} onClick={() => handleAbrirExtrato(c)} className="p-6 bg-slate-50/20 rounded-2xl border border-slate-100 flex flex-col gap-5 opacity-70 hover:opacity-100 cursor-pointer transition-all">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${c.tipo === 'planejamento' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{c.tipo}</span>
                              <p className="text-xs font-black text-slate-700 leading-tight uppercase line-clamp-1">{c.descricao}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-700 leading-none">{formatarMoeda(c.valor)}</p>
                              <Badge variant={c.status === 'concluido' ? 'success' : 'danger'} size="sm" >{c.status}</Badge>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest text-slate-400">
                              <span>{c.pagas}/{c.totalParcelas} parcelas</span>
                              <span>{percQuantidade.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full transition-all duration-1000 ${c.status === 'concluido' ? 'bg-emerald-600' : 'bg-slate-400'}`} style={{ width: `${percQuantidade}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <textarea
          className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-medium text-slate-600 focus:ring-8 focus:ring-emerald-500/5 focus:bg-white focus:border-emerald-500 outline-none transition-all min-h-[140px] leading-relaxed placeholder:text-slate-300"
          placeholder="Mapeamento de dores e metas de curto prazo..."
          defaultValue={cliente.observacoes}
          onBlur={(e) => atualizarCliente(cliente.id!, { observacoes: e.target.value })}
        />
      </div>

      {/* Asset Summary foi removido conforme solicitação de simplificação visual */}

      <Modal isOpen={modalContrato} onClose={() => setModalContrato(false)} title={formContrato.id ? 'Ajustar Parâmetros do Acordo' : 'Nova Ativação Estratégica'}>
        {/* ... rest of modal code ... */}
        <div className="space-y-8 animate-fade-in">
          {!saveSuccess && (
            <div className="flex items-center justify-center gap-4 mb-4">
              {[1, 2, 3].map(i => (
                <React.Fragment key={i}>
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-black text-xs transition-all ${step >= i ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-400'}`}>
                    {step > i ? <CheckCircle2 size={16} /> : i}
                  </div>
                  {i < 3 && <div className={`h-1 w-10 rounded-full ${step > i ? 'bg-emerald-600' : 'bg-slate-100'}`} />}
                </React.Fragment>
              ))}
            </div>
          )}

          {saveSuccess ? (
            <div className="py-20 text-center space-y-4 animate-in zoom-in-95 duration-500">
              <div className="h-20 w-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-xl">
                <CheckCircle2 size={40} strokeWidth={2.5} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase">Acordo Formalizado!</h3>
              <p className="text-slate-400 font-medium italic text-sm">Sincronizando fluxo de caixa com o motor financeiro...</p>
            </div>
          ) : (
            <>
              {step === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
                  <button
                    onClick={() => { setFormContrato({ ...formContrato, categoria: 'planejamento', padrao_id: '' }); setStep(2); }}
                    className="p-10 bg-white border border-slate-200 rounded-3xl hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all group flex flex-col items-center text-center space-y-6"
                  >
                    <div className="h-14 w-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner">
                      <FileText size={28} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Planejamento</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed tracking-widest">Consultoria e Ciclos Anuais</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { setFormContrato({ ...formContrato, categoria: 'extra', padrao_id: '' }); setStep(2); }}
                    className="p-10 bg-white border border-slate-200 rounded-3xl hover:border-amber-500 hover:shadow-2xl hover:shadow-amber-500/10 transition-all group flex flex-col items-center text-center space-y-6"
                  >
                    <div className="h-14 w-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all shadow-inner">
                      <Plus size={28} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Serviços Extras</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 leading-relaxed tracking-widest">Implementações Sob Demanda</p>
                    </div>
                  </button>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-8 animate-slide-up">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className={labelStyle}>Padrão de Recebimento</label>
                      <select
                        value={formContrato.padrao_id}
                        onChange={e => aplicarPadrao(e.target.value, formContrato.categoria)}
                        className={inputStyle}
                      >
                        <option value="">Configuração Personalizada...</option>
                        {(formContrato.categoria === 'planejamento' ? padroesPlanejamento : padroesExtras).map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelStyle}>Data Base do Acordo</label>
                      <div className="relative">
                        <Calendar size={18} className="absolute left-4 top-4 text-slate-300" />
                        <input type="date" required value={formContrato.data_inicio} onChange={e => setFormContrato({ ...formContrato, data_inicio: e.target.value })} className={`${inputStyle} pl-12 font-black`} />
                      </div>
                    </div>
                    <div>
                      <label className={labelStyle}>Forma de Pagamento</label>
                      <div className="flex bg-slate-100 p-1 rounded-xl h-[42px]">
                        <button
                          type="button"
                          onClick={() => setFormContrato({ ...formContrato, forma_pagamento: 'vista' })}
                          className={`flex-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${formContrato.forma_pagamento === 'vista' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          À Vista
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormContrato({ ...formContrato, forma_pagamento: 'parcelado' })}
                          className={`flex-1 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${formContrato.forma_pagamento === 'parcelado' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Parcelado
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelStyle}>{formContrato.categoria === 'extra' ? 'Mensalidade Bruta' : 'Ticket Mensal'}</label>
                      <div className="relative">
                        <DollarSign size={18} className="absolute left-4 top-4 text-slate-300" />
                        <input type="number" step="0.01" required value={formContrato.ticket_mensal} onChange={e => setFormContrato({ ...formContrato, ticket_mensal: Math.round(parseFloat(e.target.value) * 100) / 100 || 0 })} className={`${inputStyle} pl-12 font-black text-lg text-slate-900`} />
                      </div>
                    </div>
                    {showDuracaoInput && (
                      <div>
                        <label className={labelStyle}>Duração (Meses)</label>
                        <div className="relative">
                          <Clock size={16} className="absolute left-4 top-4 text-slate-300" />
                          <input type="number" required value={formContrato.prazo_meses} onChange={e => setFormContrato({ ...formContrato, prazo_meses: parseInt(e.target.value) || 1 })} className={`${inputStyle} pl-12`} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-6 bg-slate-900 rounded-3xl text-white flex justify-between items-center shadow-xl border-b-4 border-emerald-500 transition-all">
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Expectativa Líquida Total</span>
                      <p className="text-2xl font-black text-emerald-400">{formatarMoeda(receitaLiquidaTotal)}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Duração do Fluxo</span>
                      <p className="text-xl font-black">{formContrato.forma_pagamento === 'vista' ? 'Único' : `${formContrato.prazo_meses} Meses`}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    {!formContrato.id && (
                      <button type="button" onClick={() => setStep(1)} className="flex-1 py-5 font-black text-slate-400 uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:text-slate-600 transition-all">
                        <ArrowLeft size={16} /> Voltar
                      </button>
                    )}
                    <button onClick={() => setStep(3)} className="flex-[2] py-5 bg-slate-900 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-3 group">
                      Validar Sequenciamento de Fases
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-10 animate-slide-up">
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div><p className={labelStyle}>Categoria</p><p className="text-sm font-black text-slate-800 uppercase tracking-tighter">{formContrato.categoria}</p></div>
                    <div><p className={labelStyle}>Vigência</p><p className="text-sm font-black text-slate-800 uppercase tracking-tighter">{formContrato.prazo_meses} Meses</p></div>
                    <div><p className={labelStyle}>Net Repasse %</p><Badge variant="emerald" size="sm">{formContrato.repasse_percentual}%</Badge></div>
                    <div><p className={labelStyle}>Ticket Bruto</p><p className="text-sm font-black text-slate-800 uppercase tracking-tighter">{formatarMoeda(formContrato.ticket_mensal)}</p></div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2">
                      <Clock size={18} className="text-emerald-500" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Escalonamento de Recebíveis (D+{formContrato.prazo_recebimento_dias})</h4>
                    </div>
                    <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-inner max-h-72 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
                          <tr>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase">Referência</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase text-center">Data Est.</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase text-right">Valor Bruto</th>
                            <th className="px-8 py-4 text-[9px] font-black text-emerald-600 uppercase text-right">Repasse Líquido</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {fluxoProjetado.map((parc, idx) => (
                            <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${parc.tipo === 'BÔNUS' ? 'bg-indigo-50/20' : ''}`}>
                              <td className="px-8 py-4">
                                <div className="flex items-center gap-3">
                                  {parc.tipo === 'BÔNUS' ? <Zap size={14} className="text-indigo-500" /> : <Clock size={14} className="text-slate-300" />}
                                  <div>
                                    <p className={`text-[10px] font-black ${parc.tipo === 'BÔNUS' ? 'text-indigo-600' : 'text-slate-400'} uppercase`}>{parc.tipo === 'BÔNUS' ? 'BÔNUS ATIVAÇÃO' : `MÊS ${String(parc.num).padStart(2, '0')}`}</p>
                                    <span className="text-[7px] font-bold text-slate-300 uppercase block mt-0.5">{parc.repasseLabel}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-4 text-xs font-black text-slate-700 text-center">{formatarData(parc.vencimento)}</td>
                              <td className="px-8 py-4 text-xs font-bold text-slate-800 text-right">{formatarMoeda(parc.valorBruto)}</td>
                              <td className="px-8 py-4 text-xs font-black text-emerald-600 text-right">{formatarMoeda(parc.valorLiquido)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setStep(2)} className="flex-1 py-5 font-black text-slate-400 uppercase text-[10px] tracking-widest hover:text-slate-600 transition-all">Ajustar Dados</button>
                    <button onClick={handleFinalizarAcordo} disabled={isSubmitting} className="flex-[2] py-5 bg-emerald-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-2xl shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 group">
                      {isSubmitting ? 'Sincronizando...' : 'Confirmar Ativação'}
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={modalExtrato}
        onClose={() => setModalExtrato(false)}
        title="Extrato do Acordo"
        subtitle={
          contratoSelecionado && (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[9px] font-black text-slate-400 uppercase">Situação Atual:</span>
              <Badge variant={contratoSelecionado.status === 'ativo' ? 'success' : contratoSelecionado.status === 'concluido' ? 'emerald' : 'danger'} size="sm">
                {contratoSelecionado.status.toUpperCase()}
              </Badge>
            </div>
          )
        }
        headerActions={
          contratoSelecionado && (
            <div className="flex gap-2">
              <button onClick={() => handleEditContrato(contratoSelecionado)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-[9px] uppercase text-slate-600 hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm">
                <Edit3 size={12} /> Ajustar
              </button>
              <button onClick={() => setModalExcluirConfirm(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-[9px] uppercase text-rose-400 hover:border-rose-500 hover:text-rose-600 transition-all shadow-sm">
                <Trash2 size={12} /> Remover
              </button>
            </div>
          )
        }
      >
        {contratoSelecionado && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Líquido do Contrato</span>
                <p className="text-lg font-black text-slate-900">{formatarMoeda(totalLiquidoEsperadoContrato)}</p>
              </div>
              <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50">
                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Líquido Conciliado</span>
                <p className="text-lg font-black text-emerald-700">{formatarMoeda(totalLiquidoConciliado)}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Vencimento</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Valor Bruto</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Data Recebimento</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase text-emerald-600 tracking-widest text-right">Valor Líquido</th>
                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Status</th>
                    <th className="px-8 py-4 text-right text-[9px] font-black uppercase text-slate-400 tracking-widest">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {parcelasContrato.map((p) => {
                    const fator = (contratoSelecionado.repasse_percentual || 100) / 100;
                    const valLiquido = p.status === 'pago' ? p.valor_pago : p.valor_previsto * fator;

                    return (
                      <tr key={p.id} className={`hover:bg-slate-50/20 transition-colors ${p.status === 'cancelado' ? 'opacity-30' : ''}`}>
                        <td className="px-8 py-4 font-bold text-slate-700 text-xs">{formatarData(p.data_vencimento)}</td>
                        <td className="px-8 py-4 font-black text-slate-400 text-xs">{formatarMoeda(p.valor_previsto)}</td>
                        <td className="px-8 py-4 font-bold text-slate-500 text-xs italic">{p.status === 'pago' ? formatarData(p.data_pagamento) : ''}</td>
                        <td className="px-8 py-4 font-black text-emerald-600 text-xs text-right">{formatarMoeda(valLiquido || 0)}</td>
                        <td className="px-8 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border ${p.status === 'pago' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            p.status === 'atrasado' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                              'bg-slate-50 text-slate-400 border-slate-100'
                            }`}>
                            {p.status === 'pago' ? <CheckCircle2 size={10} /> : p.status === 'atrasado' ? <AlertTriangle size={10} /> : <Clock size={10} />}
                            {p.status}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-right">
                          {(p.status === 'pendente' || p.status === 'atrasado') && contratoSelecionado.status === 'ativo' && (
                            <button onClick={() => handleBaixarParcela(p)} className="text-emerald-600 font-black text-[9px] uppercase tracking-widest hover:underline">Baixar Líquido</button>
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
      </Modal>

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
