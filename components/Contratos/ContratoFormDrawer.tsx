import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Cliente } from '../../services/clienteService';
import { criarContrato, atualizarContrato } from '../../services/contratoService';
import { configService } from '../../services/configuracoesService';
import { formatarMoeda, formatarData, toLocalDateString } from '../../utils/formatadores';
import SidePanel from '../UI/SidePanel';
import CampoMoeda from '../UI/CampoMoeda';
import Badge from '../UI/Badge';
import { FileText, Plus, Clock, CheckCircle2, Calendar, ArrowRight, ArrowLeft, Zap } from 'lucide-react';

interface ContratoFormDrawerProps {
  open: boolean;
  onClose: () => void;
  cliente: Cliente;
  /** Contrato existente para edição; ausente/null cria um novo. */
  contratoParaEditar?: any | null;
  /** Chamado após salvar (criar/atualizar) com sucesso. */
  onSaved: () => void;
}

const defaultForm = () => ({
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

/**
 * Drawer reutilizável de vinculação/edição de contrato (Planejamento ou Extras).
 * Extraído do prontuário (AbaResumo) para permitir reuso — ex.: renovação a
 * partir da Visão Geral. Mantém o wizard de 3 passos e o motor de projeção.
 */
const ContratoFormDrawer: React.FC<ContratoFormDrawerProps> = ({ open, onClose, cliente, contratoParaEditar, onSaved }) => {
  const [padroesPlanejamento, setPadroesPlanejamento] = useState<any[]>([]);
  const [padroesExtras, setPadroesExtras] = useState<any[]>([]);
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formContrato, setFormContrato] = useState(defaultForm());

  // Carrega padrões uma vez (necessários para derivar ticket na edição de extras).
  useEffect(() => {
    (async () => {
      try {
        const [pPlan, pExt] = await Promise.all([
          configService.getPlanejamento(),
          configService.getExtras()
        ]);
        setPadroesPlanejamento(pPlan || []);
        setPadroesExtras(pExt || []);
      } catch (err) {
        console.error('Erro ao carregar padrões de contrato:', err);
      }
    })();
  }, []);

  // Inicializa o formulário quando o drawer abre (novo ou edição).
  useEffect(() => {
    if (!open) return;
    setSaveSuccess(false);
    setIsSubmitting(false);

    if (contratoParaEditar) {
      const c = contratoParaEditar;
      let derivedTicket = 0;
      if (c.tipo === 'extra' && c.padrao_id) {
        const padrao = padroesExtras.find(p => p.id === c.padrao_id);
        const pesoBonus = (padrao?.tem_bonus && padrao?.taxa_bonus > 0) ? (padrao.taxa_bonus / 100) : 0;
        const divisorReal = (c.prazo_meses || 1) + pesoBonus;
        derivedTicket = c.valor / divisorReal;
      } else {
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
    } else {
      setFormContrato(defaultForm());
      setStep(1);
    }
  }, [open, contratoParaEditar, padroesExtras]);

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
      setTimeout(() => { onClose(); onSaved(); }, 1500);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally { setIsSubmitting(false); }
  };

  const labelStyle = "text-[12px] font-semibold text-[color:var(--text-muted)] block mb-1.5";
  const inputStyle = "w-full h-[36px] px-3 bg-surface border border-subtle rounded-lg font-medium text-main outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all text-[13px]";

  return (
    <SidePanel
      open={open}
      onClose={onClose}
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
                    <CampoMoeda
                      value={formContrato.ticket_mensal}
                      onChange={n => setFormContrato({ ...formContrato, ticket_mensal: Math.round(n * 100) / 100 })}
                      className={inputStyle}
                      required
                    />
                  </div>
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
  );
};

export default ContratoFormDrawer;
