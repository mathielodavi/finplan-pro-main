
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { investimentoService } from '../../services/investimentoService';
import { obterClientePorId, atualizarCliente } from '../../services/clienteService';
import { configService } from '../../services/configuracoesService';
import { carteiraRecomendadaService } from '../../services/carteiraRecomendadaService';
import { formatarMoeda, formatarData } from '../../utils/formatadores';
import {
  CheckCircle2, ArrowRight, ShieldCheck, Target,
  Bird, Plus, Trash2, Search,
  ChevronRight, ShoppingCart, Landmark, History,
  XCircle, PlayCircle, AlertCircle, RefreshCw,
  Eye, FileText, Download
} from 'lucide-react';
import Accordion from '../UI/Accordion';
import Modal from '../Modal';
import { gerarRelatorioAportePDF } from '../../utils/pdfGenerator';
import { supabase } from '../../services/supabaseClient';

interface AlocacaoManual {
  id: string;
  nome: string;
  valor: number;
  ticker?: string;
  ativo_id?: string;
}

type DestinoVenda = 'reserva' | 'projetos' | 'independencia' | 'livre';

interface VendaItem {
  valor: number;
  destino: DestinoVenda;
}

interface ManualOverride {
  preco_mercado?: number;
  status_manual?: boolean;
  aporte_efetivo?: number;
}

const PriceInputCell = ({ initialValue, onConfirm, prefix = "R$" }: { initialValue: number, onConfirm: (val: number) => void, prefix?: string }) => {
  const [display, setDisplay] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<number>(initialValue);

  useEffect(() => {
    setDisplay(initialValue > 0 ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(initialValue) : '');
    setCurrentValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const handler = setTimeout(() => {
      // Evita disparar updates iniciais redundantes
      if (currentValue !== initialValue) {
        onConfirm(currentValue);
      }
    }, 2000);
    return () => clearTimeout(handler);
  }, [currentValue, initialValue, onConfirm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (!val) {
      setDisplay('');
      setCurrentValue(0);
      return;
    }
    const num = parseInt(val) / 100;
    setDisplay(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(num));
    setCurrentValue(num); // Apenas atualiza estado local; debounce envia o onConfirm depois
  };

  return (
    <div className="relative group">
      <span className="absolute left-2.5 top-[11px] text-[9px] font-bold text-faint">{prefix}</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        className="h-9 w-full pl-7 pr-2 bg-surface-2 border border-subtle rounded-[8px] text-[12px] font-bold text-main outline-none focus:bg-surface focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500/20 transition-all text-center shadow-sm"
        placeholder="0,00"
      />
    </div>
  );
};

const RebalanceamentoInvestimentos = ({ clienteId, ativos, onFinish }: any) => {
  const [step, setStep] = useState(0);
  const [ultimoRebal, setUltimoRebal] = useState<any>(null);
  const [modalRevisao, setModalRevisao] = useState(false);

  const [aporte, setAporte] = useState(0);
  const [vendas, setVendas] = useState<Record<string, VendaItem>>({});
  const [estrategiaId, setEstrategiaId] = useState('');
  const [teseId, setTeseId] = useState('');
  const [bancosSelecionados, setBancosSelecionados] = useState<string[]>([]);
  const [modelosDisponiveis, setModelosDisponiveis] = useState<any[]>([]);
  const [tesesDisponiveis, setTesesDisponiveis] = useState<any[]>([]);
  const [bancosDisponiveis, setBancosDisponiveis] = useState<any[]>([]);
  const [carteiraRec, setCarteiraRec] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [resumo, setResumo] = useState<any>(null);
  const [rebateClasses, setRebateClasses] = useState<any[]>([]);
  const [patrimonioProjetado, setPatrimonioProjetado] = useState(0);
  const [distribuicaoAtivos, setDistribuicaoAtivos] = useState<any[]>([]);
  const [manualSettings, setManualSettings] = useState<Record<string, ManualOverride>>({});
  const [faixaAplicada, setFaixaAplicada] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [planejador, setPlanejador] = useState<any>(null);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [reservaAlloc, setReservaAlloc] = useState<AlocacaoManual[]>([]);
  const [projetosAlloc, setProjetosAlloc] = useState<AlocacaoManual[]>([]);

  useEffect(() => {
    Promise.all([
      obterClientePorId(clienteId),
      investimentoService.getProjetos(clienteId),
      configService.getAssetAllocations(),
      configService.getEstrategias(),
      configService.getBancos(),
      investimentoService.getUltimoRebalanceamento(clienteId),
      supabase.auth.getUser(),
      carteiraRecomendadaService.listarAtivos()
    ])
      .then(async ([cli, proj, models, theses, banks, lastRebal, { data: { user } }, rec]) => {
        setCliente(cli);
        setProjetos(proj || []);
        setModelosDisponiveis(models || []);
        setTesesDisponiveis(theses || []);
        setBancosDisponiveis(banks || []);
        setUltimoRebal(lastRebal);
        setCarteiraRec(rec || []);

        if (user) {
          const { data: profile } = await supabase.from('perfis').select('*').eq('id', user.id).single();
          setPlanejador(profile);
        }

        if (cli?.estrategia_padrao_id) {
          setEstrategiaId(cli.estrategia_padrao_id);
        } else if (models && models.length > 0) {
          setEstrategiaId(models[0].id);
        }

        if (cli?.tese_investimento_id) {
          setTeseId(cli.tese_investimento_id);
        } else if (theses && theses.length > 0) {
          setTeseId(theses[0].id);
        }

        if (cli?.bancos_ativos) setBancosSelecionados(cli.bancos_ativos.split(',').filter(Boolean));
      });
  }, [clienteId]);

  const totalAlocadoReserva = useMemo(() => reservaAlloc.reduce((acc, it) => acc + it.valor, 0), [reservaAlloc]);
  const totalAlocadoProjetos = useMemo(() => projetosAlloc.reduce((acc, it) => acc + it.valor, 0), [projetosAlloc]);

  const runCalculoTatico = useCallback(async (overrides = manualSettings) => {
    if (!teseId) return;
    setLoading(true);
    try {
      const rec = await carteiraRecomendadaService.listarAtivos();
      const tese = tesesDisponiveis.find(t => t.id === teseId);
      const indepAtual = (ativos || []).filter((a: any) => (a.distribuicao_objetivos || []).some((o: any) => o.tipo === 'independencia')).reduce((acc: number, a: any) => acc + (a.valor_atual * (a.distribuicao_objetivos.find((o: any) => o.tipo === 'independencia').percentual / 100)), 0);

      // Vendas com destino independência entram direto; vendas livre são redistribuídas
      const vendasIF = (Object.values(vendas) as VendaItem[]).filter(v => v.destino === 'independencia').reduce((s, v) => s + v.valor, 0);
      const vendasLivre = (Object.values(vendas) as VendaItem[]).filter(v => v.destino === 'livre').reduce((s, v) => s + v.valor, 0);
      const aporteBase = aporte + vendasLivre;
      const patFinal = indepAtual + vendasIF + Math.max(0, aporteBase - totalAlocadoReserva - totalAlocadoProjetos);

      const faixa = tese?.faixas?.find((f: any) => patFinal >= f.intervalo_minimo && (f.intervalo_maximo === null || patFinal < f.intervalo_maximo));
      if (!faixa) throw new Error("Patrimônio fora das faixas.");
      setFaixaAplicada(faixa);
      const det = investimentoService.calcularDistribuicaoDetalhadaAtivos(ativos, rec, rebateClasses, { teseId, faixaId: faixa.id, bancos: bancosSelecionados }, patFinal, overrides);
      setDistribuicaoAtivos(det);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [teseId, tesesDisponiveis, ativos, bancosSelecionados, manualSettings, aporte, totalAlocadoReserva, totalAlocadoProjetos, rebateClasses, vendas]);

  const updateManual = (id: string, up: Partial<ManualOverride>) => {
    const nm = { ...manualSettings, [id]: { ...manualSettings[id], ...up } };
    setManualSettings(nm);
    runCalculoTatico(nm);
  };

  const handleUpdatePerfil = async (key: string, value: any) => {
    const payload = { [key]: key === 'bancos_ativos' ? (value as string[]).join(',') : value };
    await atualizarCliente(clienteId, payload);
  };

  const handleCalcularClasses = () => {
    const modelo = modelosDisponiveis.find(m => m.id === estrategiaId);
    if (!modelo) return alert("Selecione uma estratégia de alocação.");
    setLoading(true);
    try {
      // Separar vendas por destino
      const vendasPorDestino = { reserva: 0, projetos: 0, independencia: 0, livre: 0 };
      (Object.values(vendas) as VendaItem[]).forEach(({ valor, destino }: VendaItem) => {
        vendasPorDestino[destino as DestinoVenda] = (vendasPorDestino[destino as DestinoVenda] || 0) + valor;
      });

      // Vendas por objetivo (legado para cálculo interno do service)
      const vendasPorObj = { reserva: vendasPorDestino.reserva, projetos: vendasPorDestino.projetos, independencia: vendasPorDestino.independencia };
      // Tratamos livre como aporte adicional
      const aporteEfetivo = aporte + vendasPorDestino.livre;

      const result = investimentoService.calcularRebateOtimo(ativos, aporteEfetivo, cliente?.reserva_recomendada || 0, projetos, modelo.classes || [], vendasPorObj);
      setResumo(result.resumo);
      setRebateClasses(result.distribuicaoIndependencia);
      setPatrimonioProjetado(result.totalIndepProjetado);
      setStep(3);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao calcular classes: " + (err.message || "Verifique as configurações de alocação."));
    } finally {
      setLoading(false);
    }
  };

  const handleCalcularAtivos = () => { runCalculoTatico(); setStep(6); };

  const totalVendas = useMemo(() => (Object.values(vendas) as VendaItem[]).reduce((acc, v) => acc + v.valor, 0), [vendas]);

  const ativosComControle = useMemo(() => {
    const totalCustodia = (ativos || []).reduce((acc: number, cur: any) => acc + (cur.valor_atual || 0), 0);
    const patrimonioIndependencia = (ativos || []).reduce((acc: number, a: any) => {
      const linkIndep = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'independencia');
      const perc = linkIndep ? (linkIndep.percentual / 100) : 0;
      return acc + (a.valor_atual * perc);
    }, 0);

    const teseCliente = tesesDisponiveis.find(t => t.id === teseId);
    const faixas = teseCliente?.faixas || [];
    const faixaAtual = faixas.find((f: any) => patrimonioIndependencia >= f.intervalo_minimo && (f.intervalo_maximo === null || patrimonioIndependencia < f.intervalo_maximo));
    const proximaFaixa = faixas.find((f: any) => f.intervalo_minimo > patrimonioIndependencia);
    const dentroToleranciaUpgrade = proximaFaixa ? ((proximaFaixa.intervalo_minimo - patrimonioIndependencia) / proximaFaixa.intervalo_minimo) <= 0.05 : false;

    const totaisPorClasseIndep = (ativos || []).reduce((acc: any, cur: any) => {
      const linkIndep = (cur.distribuicao_objetivos || []).find((o: any) => o.tipo === 'independencia');
      if (linkIndep && linkIndep.percentual > 0) {
        const classe = cur.tipo_ativo || 'OUTROS';
        const valorIndep = cur.valor_atual * (linkIndep.percentual / 100);
        acc[classe] = (acc[classe] || 0) + valorIndep;
      }
      return acc;
    }, {});

    return (ativos || []).map((a: any) => {
      const linkIndep = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'independencia');
      const temIndependencia = linkIndep && linkIndep.percentual > 0;
      const totalClasseIndep = totaisPorClasseIndep[a.tipo_ativo || 'OUTROS'] || 0;
      const valorParaIndep = temIndependencia ? (a.valor_atual * (linkIndep.percentual / 100)) : 0;
      const pesoNaClasse = (totalClasseIndep > 0 && temIndependencia) ? (valorParaIndep / totalClasseIndep) * 100 : 0;

      const matchesRec = (carteiraRec || []).filter(r => (r.ticker && a.ticker && r.ticker === a.ticker) || (r.cnpj && a.cnpj && r.cnpj === a.cnpj) || (r.nome_ativo === a.nome));
      let statusControle = 'Não recomendado';
      let metaAlvo = 0;
      let desvio = 0;

      if (matchesRec.length > 0) {
        const naTese = matchesRec.filter(r => r.estrategia_id === teseId);
        if (naTese.length === 0) statusControle = 'Fora da estratégia';
        else {
          const naFaixa = naTese.find(r => r.faixa_id === faixaAtual?.id);
          const naFaixaSeguinte = proximaFaixa ? naTese.find(r => r.faixa_id === proximaFaixa.id) : null;
          if (naFaixa) { statusControle = 'Ok'; metaAlvo = naFaixa.alocacao; }
          else if (naFaixaSeguinte && dentroToleranciaUpgrade) { statusControle = 'Ok'; metaAlvo = naFaixaSeguinte.alocacao; }
          else { statusControle = 'Fora da faixa'; metaAlvo = naTese[0].alocacao; }
        }
      }
      if (temIndependencia && metaAlvo > 0) {
        const partRealIndepTotal = patrimonioIndependencia > 0 ? (valorParaIndep / patrimonioIndependencia) * 100 : 0;
        desvio = partRealIndepTotal - metaAlvo;
      }
      return { ...a, pesoNaClasse, desvio, temIndependencia, statusControle, metaAlvo };
    });
  }, [ativos, carteiraRec, tesesDisponiveis, teseId, cliente]);

  const handleToggleVenda = (id: string, valorAtual: number) => {
    const nv: Record<string, VendaItem> = { ...vendas };
    if (nv[id]) delete nv[id];
    else nv[id] = { valor: valorAtual, destino: 'livre' };
    setVendas(nv);
  };

  const handleUpdateVenda = (id: string, patch: Partial<VendaItem>) => {
    setVendas(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleFinalizarEfetivo = async (e: React.MouseEvent) => {
    e.preventDefault();
    setFinishing(true);
    try {
      const indepEfetivos = distribuicaoAtivos.flatMap(c =>
        (c.ativos || [])
          .filter((a: any) => (manualSettings[a.id]?.aporte_efetivo || 0) > 0.01)
          .map((a: any) => ({
            nome: a.nome,
            ticker: a.ticker,
            cnpj: a.cnpj,
            tipo: a.tipo,
            ativo_id: a.id_banco_original || null,
            valor_anterior: a.saldo_atual || 0,
            valor_distribuido: manualSettings[a.id]?.aporte_efetivo || 0,
            valor_novo: (a.saldo_atual || 0) + (manualSettings[a.id]?.aporte_efetivo || 0),
            valor_efetivo: manualSettings[a.id]?.aporte_efetivo || 0
          }))
      );

      const temReserva = (reservaAlloc || []).some(r => r.valor > 0.01);
      const temProjetos = (projetosAlloc || []).some(p => p.valor > 0.01);
      const temIndep = indepEfetivos.length > 0;

      if (!temReserva && !temProjetos && !temIndep) {
        alert("Preencha ao menos um valor de 'Aporte Efetivo' antes de finalizar.");
        setFinishing(false); return;
      }

      // await investimentoService.processarAporteFinal(clienteId, ativos, reservaAlloc, projetosAlloc, indepEfetivos, projetos);

      // Processar vendas no histórico
      const vendasEfetivas = (Object.entries(vendas) as [string, VendaItem][]).map(([id, venda]) => {
        const at = ativos.find((a: any) => a.id === id);
        return {
          nome: `[VENDA→${venda.destino.toUpperCase()}] ${at?.nome || id}`,
          valor_distribuido: -venda.valor,
          valor_anterior: at?.valor_atual || 0,
          valor_novo: (at?.valor_atual || 0) - venda.valor
        };
      });

      const todosItensHistorico = [
        ...reservaAlloc.map(r => ({ nome: `[RESERVA] ${r.nome}`, valor_distribuido: r.valor, valor_anterior: 0, valor_novo: r.valor })),
        ...projetosAlloc.map(p => ({ nome: `[PROJETO] ${p.nome}`, valor_distribuido: p.valor, valor_anterior: 0, valor_novo: p.valor })),
        ...indepEfetivos,
        ...vendasEfetivas
      ];
      await investimentoService.salvarHistoricoRebalanceamento(clienteId, estrategiaId, aporte, todosItensHistorico);
      // Atualiza o snapshot mensal do patrimônio de independência (upsert mensal)
      await investimentoService.snapshotPatrimonioIndependencia(clienteId, aporte).catch(() => {});
      setSuccess(true);
      setShowPdfModal(true);
    } catch (err: any) {
      alert("Erro técnico ao salvar: " + (err.message || "Erro desconhecido"));
    } finally { setFinishing(false); }
  };

  const handleGerarPDF = () => {
    if (!distribuicaoAtivos || distribuicaoAtivos.length === 0) return;

    const ordensCompra: any[] = [];
    distribuicaoAtivos.forEach((c: any) => {
      (c.ativos || []).filter((a: any) => a.acao === 'COMPRAR').forEach((at: any) => {
        ordensCompra.push({
          classe: c.classe,
          nome: at.nome,
          ticker: at.ticker || at.cnpj,
          valor: manualSettings[at.id]?.aporte_efetivo || at.aporte_sugerido,
          cotas: at.cotas
        });
      });
    });

    const ordensVenda: any[] = [];
    Object.entries(vendas).forEach(([id, valor]) => {
      const at = ativos.find((a: any) => a.id === id);
      if (at) {
        ordensVenda.push({
          classe: at.tipo_ativo,
          nome: at.nome,
          ticker: at.ticker || at.cnpj,
          valor: valor
        });
      }
    });

    const totalVendas = Object.values(vendas).reduce((a, b: any) => a + b.valor, 0);

    const saldoAtualReserva = (ativos || []).filter((a: any) => (a.distribuicao_objetivos || []).some((o: any) => o.tipo === 'reserva')).reduce((acc: number, a: any) => acc + ((a.valor_atual || 0) * (a.distribuicao_objetivos.find((o: any) => o.tipo === 'reserva')?.percentual / 100)), 0);
    const acumuladoReserva = saldoAtualReserva + totalAlocadoReserva;

    const saldoAtualProjetos = (ativos || []).filter((a: any) => (a.distribuicao_objetivos || []).some((o: any) => o.tipo === 'projetos')).reduce((acc: number, a: any) => acc + ((a.valor_atual || 0) * (a.distribuicao_objetivos.find((o: any) => o.tipo === 'projetos')?.percentual / 100)), 0);
    const acumuladoProjetos = saldoAtualProjetos + totalAlocadoProjetos;

    gerarRelatorioAportePDF({
      cliente,
      planejador,
      estrategia: modelosDisponiveis.find(m => m.id === estrategiaId)?.nome || 'N/A',
      tese: tesesDisponiveis.find(t => t.id === teseId)?.nome || 'N/A',
      faixa: faixaAplicada?.nome || '',
      aporteTotal: aporte,
      totalVendas: totalVendas,
      assetMix: rebateClasses.map(c => ({
        ...c,
        cor: distribuicaoAtivos?.find(d => d.classe === c.classe)?.cor || '#10b981'
      })),
      reservaAlloc,
      projetosAlloc,
      distribuicao: {
        reserva: resumo.reserva,
        projetos: resumo.projetos,
        independencia: resumo.independencia,
        acumuladoReserva,
        acumuladoProjetos
      },
      ordensCompra,
      ordensVenda,
      dataGeracao: new Date().toLocaleDateString('pt-BR')
    });

    setShowPdfModal(false);
  };

  if (success) {
    return (
      <div className="py-16 text-center space-y-8 animate-in zoom-in-95 duration-500">
        <div className="h-24 w-24 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl border border-emerald-100"><CheckCircle2 size={40} strokeWidth={2.5} /></div>
        <div className="space-y-3">
          <h3 className="text-3xl font-black text-main uppercase tracking-tight">Protocolo Finalizado!</h3>
          <p className="text-muted font-bold uppercase text-[10px] tracking-[0.3em] italic">O histórico de rebalanceamento foi registrado com sucesso.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={handleGerarPDF}
            className="w-full sm:w-auto px-10 py-4 bg-emerald-600 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl flex items-center justify-center gap-3"
          >
            <Download size={18} />
            Gerar Relatório PDF
          </button>
          <button onClick={onFinish} className="w-full sm:w-auto px-10 py-4 bg-surface-3 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-strong transition-all shadow-xl">Voltar ao Resumo</button>
        </div>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
        <div onClick={() => setStep(1)} className="bg-surface p-8 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group flex flex-col items-center text-center space-y-4"><div className="h-14 w-14 bg-emerald-50 text-emerald-600 rounded-[12px] flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all"><Plus size={24} strokeWidth={3} /></div><div><h3 className="text-[16px] font-bold text-main uppercase tracking-tight">Novo Aporte Mensal</h3><p className="text-faint font-bold uppercase text-[10px] tracking-wider mt-1">Iniciar simulador do zero</p></div></div>
        <div onClick={() => ultimoRebal ? setModalRevisao(true) : alert('Nenhum histórico disponível.')} className={`p-8 rounded-xl border transition-all flex flex-col items-center text-center space-y-4 ${ultimoRebal ? 'bg-surface border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-md hover:border-emerald-200 cursor-pointer group' : 'bg-surface-2 border-transparent opacity-50 cursor-not-allowed'}`}><div className={`h-14 w-14 rounded-[12px] flex items-center justify-center transition-all ${ultimoRebal ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-surface-2 text-faint'}`}><History size={24} strokeWidth={3} /></div><div><h3 className="text-[16px] font-bold text-main uppercase tracking-tight">Revisar Último Aporte</h3>{ultimoRebal ? (<p className="text-emerald-600 font-bold uppercase text-[10px] tracking-wider mt-1">Executado em {formatarData(ultimoRebal.data_rebalanceamento)}</p>) : (<p className="text-faint font-bold uppercase text-[10px] tracking-wider mt-1">Sem registros</p>)}</div></div>
        <Modal isOpen={modalRevisao} onClose={() => setModalRevisao(false)} title="Resumo da Última Execução" size="lg">{ultimoRebal && (<div className="space-y-6 animate-fade-in"><div className="grid grid-cols-2 gap-4"><div className="bg-surface-2 p-4 rounded-xl border border-subtle"><span className="text-[10px] font-bold text-faint uppercase tracking-wider block mb-1">Aporte Total</span><p className="text-[20px] font-bold text-main tracking-tighter">{formatarMoeda(ultimoRebal.valor_aporte)}</p></div><div className="bg-surface-2 p-4 rounded-xl border border-subtle"><span className="text-[10px] font-bold text-faint uppercase tracking-wider block mb-1">Data</span><p className="text-[20px] font-bold text-main tracking-tighter">{formatarData(ultimoRebal.data_rebalanceamento)}</p></div></div><div className="bg-surface rounded-xl border border-subtle overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)]"><table className="w-full text-left"><thead><tr className="bg-surface-2 border-b border-subtle"><th className="px-5 py-3 text-[10px] font-bold uppercase text-faint tracking-wider">Ativo / Destino</th><th className="px-5 py-3 text-[10px] font-bold uppercase text-faint tracking-wider text-right">Aporte</th><th className="px-5 py-3 text-[10px] font-bold uppercase text-faint tracking-wider text-right">Valor Final</th></tr></thead><tbody className="divide-y divide-subtle">{ultimoRebal.itens?.map((it: any, idx: number) => (<tr key={idx}><td className="px-5 py-3"><p className="text-[12px] font-bold text-main uppercase">{it.ativo_nome_avulso}</p></td><td className="px-5 py-3 text-right font-bold text-emerald-600 text-[12px]">{formatarMoeda(it.valor_distribuido)}</td><td className="px-5 py-3 text-right font-bold text-muted text-[12px]">{formatarMoeda(it.valor_novo)}</td></tr>))}</tbody></table></div><button onClick={() => setModalRevisao(false)} className="w-full h-9 bg-surface-3 text-white font-bold uppercase text-[10px] rounded-[8px] tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-strong transition-colors">Fechar Revisão</button></div>)}</Modal>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-4 relative">
      {finishing && (<div className="fixed inset-0 z-[60] bg-surface/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-4"><RefreshCw size={48} className="text-emerald-600 animate-spin" /><p className="text-xs font-black text-main uppercase tracking-widest">Sincronizando Decisões...</p></div>)}
      <div className="flex items-center justify-center gap-4 mb-12">
        <button onClick={() => setStep(0)} className="h-10 w-10 bg-surface-2 text-faint rounded-2xl flex items-center justify-center hover:bg-surface-3 transition-all"><XCircle size={18} /></button>
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <React.Fragment key={i}>
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-black text-xs transition-all ${step >= i ? 'bg-emerald-600 text-white shadow-xl' : 'bg-surface-2 text-faint'}`}>{step > i ? <CheckCircle2 size={18} /> : i}</div>
            {i < 7 && <div className={`h-1 w-12 rounded-full ${step > i ? 'bg-emerald-600' : 'bg-surface-2'}`} />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-surface p-8 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] space-y-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="text-center">
            <h3 className="text-[20px] font-bold text-main uppercase">Fluxo de Aporte</h3>
            <p className="text-faint font-bold uppercase text-[10px] mt-1 tracking-wider">Defina o capital disponível para o protocolo mensal</p>
          </div>

          <div className="max-w-xl mx-auto space-y-8">
            <div className="bg-surface-2 p-8 rounded-xl border border-subtle space-y-5">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-bold text-faint uppercase tracking-wider">Capital Disponível</label>
                <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-[6px]">
                  <Landmark size={12} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Saldo em Conta</span>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-0 top-2.5 text-faint font-bold text-[24px]">R$</span>
                <input
                  type="text"
                  autoFocus
                  value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(aporte)}
                  onChange={e => setAporte(parseInt(e.target.value.replace(/\D/g, "") || "0") / 100)}
                  className="w-full pl-12 bg-transparent border-b-2 border-subtle text-[32px] font-bold text-main outline-none pb-2 focus:border-emerald-500 transition-all tracking-tighter"
                />
              </div>
              <p className="text-[10px] text-faint font-bold uppercase tracking-wider">O valor será distribuído conforme a estratégia definida no resumo geral.</p>
            </div>

            <div className="bg-surface p-5 rounded-xl border border-subtle space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-faint uppercase tracking-wider">Estratégia Atual</span>
                <span className="text-[10px] font-bold text-main uppercase tracking-wider">{modelosDisponiveis.find(m => m.id === estrategiaId)?.nome || 'Não definida'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-faint uppercase tracking-wider">Tese de Investimento</span>
                <span className="text-[10px] font-bold text-main uppercase tracking-wider">{tesesDisponiveis.find(t => t.id === teseId)?.nome || 'Não definida'}</span>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={aporte <= 0 || !estrategiaId || loading}
              className="w-full h-12 bg-emerald-600 text-white font-bold rounded-[8px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] uppercase text-[11px] tracking-wider hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              Confirmar Aporte e Avançar
            </button>
          </div>
        </div>
      )}

      {/* ────── STEP 2: DESINVESTIMENTO ────── */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          <div className="bg-surface p-6 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] space-y-6">
            <div className="text-center">
              <h3 className="text-[20px] font-bold text-main uppercase tracking-tight">Desinvestimento</h3>
              <p className="text-faint font-bold uppercase text-[10px] mt-1 tracking-wider">Selecione ativos para venda e defina o destino do saldo</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-surface-2 border-b border-subtle">
                    <th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider">Ativo</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-center">Controle</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-center">Aloc. Classe</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-center">Desvio Meta</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-center">Objetivo</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-right">Saldo</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-rose-600 uppercase tracking-wider text-right">Valor Venda</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-center">Destino do Saldo</th>
                    <th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle text-[12px]">
                  {(ativosComControle || []).filter((a: any) => a.valor_atual > 0.01).map((at: any) => {
                    const isVendendo = !!vendas[at.id];
                    const venda = vendas[at.id];
                    const objetivo = (at.distribuicao_objetivos || [])[0]?.tipo || 'independencia';
                    const DESTINOS: { key: DestinoVenda; label: string; color: string }[] = [
                      { key: 'reserva', label: 'Reserva', color: 'bg-sky-50 text-sky-600 border-sky-200' },
                      { key: 'projetos', label: 'Projetos', color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
                      { key: 'independencia', label: 'Indep.', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
                      { key: 'livre', label: 'Livre', color: 'bg-surface-2 text-muted border-subtle' },
                    ];
                    return (
                      <tr key={at.id} className={`hover:bg-surface-2/50 transition-colors ${isVendendo ? 'bg-rose-50/30' : ''}`}>
                        <td className="py-3 px-4">
                          <p className="font-bold text-main uppercase tracking-tight">{at.nome}</p>
                          <p className="text-[10px] text-muted font-bold uppercase mt-0.5">{at.ticker || at.cnpj || '---'}</p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${at.statusControle === 'Ok' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : at.statusControle === 'Fora da estratégia' ? 'bg-rose-50 text-rose-600 border-rose-100' : at.statusControle === 'Fora da faixa' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-surface-2 text-faint border-subtle'}`}>
                            {at.statusControle}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`font-bold ${at.temIndependencia ? 'text-main' : 'text-faint'}`}>{at.pesoNaClasse.toFixed(1)}%</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {at.temIndependencia && at.metaAlvo > 0 ? (
                            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${Math.abs(at.desvio) <= 2 ? 'bg-surface-2 text-faint border-subtle' : at.desvio > 2 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                              <span className="text-[9px] font-bold uppercase tracking-wider">{Math.abs(at.desvio) <= 2 ? 'OK' : `${at.desvio > 0 ? '+' : ''}${at.desvio.toFixed(1)}%`}</span>
                            </div>
                          ) : (<div className="h-0.5 w-3 bg-surface-3 rounded-full mx-auto" />)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-[9px] font-bold text-muted uppercase bg-surface-2 px-2 py-0.5 rounded-md tracking-wider">{objetivo}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-main tracking-tighter">{formatarMoeda(at.valor_atual)}</td>
                        <td className="py-3 px-4 text-right">
                          {isVendendo ? (
                            <input
                              type="number"
                              value={venda.valor}
                              onChange={e => handleUpdateVenda(at.id, { valor: parseFloat(e.target.value) || 0 })}
                              className="w-24 px-2 h-7 bg-surface border border-rose-200 rounded-md text-right text-[12px] font-bold text-rose-600 outline-none focus:ring-1 focus:ring-rose-500"
                            />
                          ) : <span className="text-faint">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          {isVendendo && (
                            <div className="flex items-center gap-1 justify-center flex-wrap">
                              {DESTINOS.map(d => (
                                <button
                                  key={d.key}
                                  onClick={() => handleUpdateVenda(at.id, { destino: d.key })}
                                  className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider transition-colors ${venda.destino === d.key ? d.color + ' ring-1 ring-offset-1 ring-current' : 'bg-surface text-faint border-subtle hover:border-subtle'
                                    }`}
                                >
                                  {d.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleToggleVenda(at.id, at.valor_atual)}
                            className={`px-3 h-7 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors border ${isVendendo ? 'bg-rose-500 text-white border-rose-600 shadow-sm hover:bg-rose-600' : 'bg-surface text-muted border-subtle hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                              }`}
                          >
                            {isVendendo ? 'Cancelar' : 'Vender'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Total banner */}
            <div className="grid grid-cols-3 gap-4 p-5 bg-surface-2 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div>
                <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Aporte Base</p>
                <p className="text-[16px] font-bold text-main tracking-tighter">{formatarMoeda(aporte)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-faint uppercase tracking-wider mb-1">Saldo de Vendas</p>
                <p className="text-[16px] font-bold text-rose-500 tracking-tighter">{formatarMoeda(totalVendas)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Disponível</p>
                <p className="text-[16px] font-bold text-emerald-600 tracking-tighter">{formatarMoeda(aporte + totalVendas)}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 h-9 font-bold text-muted border border-subtle rounded-[8px] uppercase text-[10px] tracking-wider shadow-sm hover:bg-surface-2 transition-colors">Voltar</button>
            <button onClick={handleCalcularClasses} disabled={loading} className="flex-[2] h-9 font-bold text-white bg-emerald-600 rounded-[8px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] uppercase text-[10px] tracking-wider hover:bg-emerald-700 transition-colors disabled:opacity-50">
              {loading ? 'Processando...' : 'Calcular Distribuição'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && resumo && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface p-6 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)]"><ShieldCheck size={20} className="text-emerald-500 mb-4" /><p className="text-[10px] font-bold text-faint uppercase tracking-wider">Alvo Reserva</p><p className="text-[20px] font-bold tracking-tighter">{formatarMoeda(resumo.reserva)}</p>{(Object.values(vendas) as VendaItem[]).some(v => v.destino === 'reserva') && <p className="text-[9px] font-bold text-sky-500 mt-1 uppercase tracking-wider">+ saldo de vendas</p>}</div>
            <div className="bg-surface p-6 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)]"><Target size={20} className="text-emerald-500 mb-4" /><p className="text-[10px] font-bold text-faint uppercase tracking-wider">Alvo Projetos</p><p className="text-[20px] font-bold tracking-tighter">{formatarMoeda(resumo.projetos)}</p>{(Object.values(vendas) as VendaItem[]).some(v => v.destino === 'projetos') && <p className="text-[9px] font-bold text-indigo-500 mt-1 uppercase tracking-wider">+ saldo de vendas</p>}</div>
            <div className="bg-surface-3 p-6 rounded-xl text-white shadow-lg"><Bird size={20} className="text-emerald-400 mb-4" /><p className="text-[10px] font-bold text-faint uppercase tracking-wider">Alvo Independência</p><p className="text-[20px] font-bold tracking-tighter">{formatarMoeda(resumo.independencia)}</p>{(Object.values(vendas) as VendaItem[]).some(v => v.destino === 'independencia') && <p className="text-[9px] font-bold text-emerald-400 mt-1 uppercase tracking-wider">+ saldo de vendas</p>}</div>
          </div>
          <div className="flex gap-3"><button onClick={() => setStep(2)} className="flex-1 h-9 font-bold text-muted border border-subtle rounded-[8px] uppercase text-[10px] tracking-wider shadow-sm hover:bg-surface-2 transition-colors">Voltar</button><button onClick={() => setStep(4)} className="flex-[2] h-9 font-bold text-white bg-emerald-600 rounded-[8px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] uppercase text-[10px] tracking-wider hover:bg-emerald-700 transition-colors">Próximo: Destino Manual</button></div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          <section className="bg-surface p-6 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-subtle"><div><h3 className="font-bold text-main uppercase tracking-tight text-[16px]">Reserva</h3><p className="text-[10px] text-muted font-bold tracking-wider mt-0.5">Meta: {formatarMoeda(resumo.reserva)}</p></div><div className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-[8px] text-[10px] font-bold tracking-wider">Alocado: {formatarMoeda(totalAlocadoReserva)}</div></div>
            {reservaAlloc.map((it, idx) => (<div key={it.id} className="flex items-center gap-3"><div className="flex-1 px-4 py-3 bg-surface-2 rounded-[8px] font-bold text-[11px] uppercase tracking-wider text-main">{it.nome}</div><div className="w-40"><PriceInputCell initialValue={it.valor} onConfirm={val => { const n = [...reservaAlloc]; n[idx].valor = val; setReservaAlloc(n); }} /></div><button onClick={() => setReservaAlloc(reservaAlloc.filter(x => x.id !== it.id))} className="p-2 text-faint hover:text-rose-500 transition-colors"><Trash2 size={16} /></button></div>))}
            <SelectorAtivo onSelect={(val: string) => { const ex = ativos.find((a: any) => a.id === val || a.nome === val); setReservaAlloc([...reservaAlloc, { id: ex?.id || `new-${Date.now()}`, nome: ex?.nome || val, valor: 0, ticker: ex?.ticker, ativo_id: ex?.id }]); }} placeholder="Adicionar à Reserva..." ativos={ativos} />
          </section>
          <section className="bg-surface p-6 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-subtle"><div><h3 className="font-bold text-main uppercase tracking-tight text-[16px]">Projetos</h3><p className="text-[10px] text-muted font-bold tracking-wider mt-0.5">Meta: {formatarMoeda(resumo.projetos)}</p></div><div className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-[8px] text-[10px] font-bold tracking-wider">Alocado: {formatarMoeda(totalAlocadoProjetos)}</div></div>
            {projetosAlloc.map((it, idx) => (<div key={it.id} className="flex items-center gap-3"><div className="flex-1 px-4 py-3 bg-surface-2 rounded-[8px] font-bold text-[11px] uppercase tracking-wider text-main">{it.nome}</div><div className="w-40"><PriceInputCell initialValue={it.valor} onConfirm={val => { const n = [...projetosAlloc]; n[idx].valor = val; setProjetosAlloc(n); }} /></div><button onClick={() => setProjetosAlloc(projetosAlloc.filter(x => x.id !== it.id))} className="p-2 text-faint hover:text-rose-500 transition-colors"><Trash2 size={16} /></button></div>))}
            <SelectorAtivo onSelect={(val: string) => { const ex = ativos.find((a: any) => a.id === val || a.nome === val); setProjetosAlloc([...projetosAlloc, { id: ex?.id || `new-${Date.now()}`, nome: ex?.nome || val, valor: 0, ticker: ex?.ticker, ativo_id: ex?.id }]); }} placeholder="Adicionar aos Projetos..." ativos={ativos} />
          </section>
          <div className="flex gap-3"><button onClick={() => setStep(3)} className="flex-1 h-9 font-bold text-muted border border-subtle rounded-[8px] uppercase text-[10px] tracking-wider shadow-sm hover:bg-surface-2 transition-colors">Voltar</button><button onClick={() => setStep(5)} className="flex-[2] h-9 font-bold text-white bg-emerald-600 rounded-[8px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] uppercase text-[10px] tracking-wider hover:bg-emerald-700 transition-colors">Próximo: Rebate por Classes</button></div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          <div className="bg-surface p-6 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)]"><table className="w-full text-left"><thead><tr className="bg-surface-2 border-b border-subtle"><th className="px-5 py-3 text-[10px] font-bold uppercase text-faint tracking-wider">Classe</th><th className="px-5 py-3 text-[10px] font-bold uppercase text-faint tracking-wider text-right">Saldo</th><th className="px-5 py-3 text-[10px] font-bold uppercase text-faint tracking-wider text-center">% Alvo</th><th className="px-5 py-3 text-[10px] font-bold uppercase text-emerald-600 tracking-wider text-right">Aporte</th></tr></thead><tbody className="divide-y divide-subtle">{rebateClasses.map((c, i) => (<tr key={i}><td className="px-5 py-3 font-bold text-main uppercase text-[12px] tracking-tight">{c.classe}</td><td className="px-5 py-3 text-right font-bold text-muted text-[12px]">{formatarMoeda(c.saldo_atual)}</td><td className="px-5 py-3 text-center font-bold text-faint text-[11px]">{c.alvo_perc}%</td><td className="px-5 py-3 text-right font-bold text-emerald-600 text-[13px]">{formatarMoeda(c.aporte_sugerido)}</td></tr>))}</tbody></table></div>
          <div className="flex gap-3"><button onClick={() => setStep(4)} className="flex-1 h-9 font-bold text-muted border border-subtle rounded-[8px] uppercase text-[10px] tracking-wider shadow-sm hover:bg-surface-2 transition-colors">Voltar</button><button onClick={handleCalcularAtivos} className="flex-[2] h-9 font-bold text-white bg-emerald-600 rounded-[8px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] uppercase text-[10px] tracking-wider hover:bg-emerald-700 transition-colors">Explorar Simulador Tático</button></div>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
          <div className="bg-surface-3 p-5 rounded-xl text-white flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="relative z-10 text-center md:text-left"><span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Simulador de Ordens de Compra</span><p className="text-[20px] font-bold tracking-tighter">{formatarMoeda(resumo.independencia)} <span className="text-[10px] text-muted uppercase tracking-wider ml-1">Aporte IF Total</span></p>{faixaAplicada && (<div className="mt-2 flex items-center gap-2"><span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-md uppercase tracking-wider">Tese: {faixaAplicada.estrategias_base?.nome || 'Estratégia Base'} • Faixa: {faixaAplicada.nome}</span></div>)}</div>
            <div className="relative z-10 text-right"><p className="text-[10px] font-bold text-muted uppercase tracking-wider">Patrimônio IF Projetado</p><p className="text-[20px] font-bold tracking-tighter text-emerald-400">{formatarMoeda(patrimonioProjetado)}</p></div>
            <Landmark size={120} className="absolute -bottom-10 -right-10 text-white/5 pointer-events-none" />
          </div>
          <div className="space-y-4">
            {distribuicaoAtivos.map((classe, cIdx) => {
              const isClasseSkip = classe.valor_aporte_classe <= 0.01;
              return (
                <Accordion key={cIdx} title={classe.classe} subtitle={isClasseSkip ? 'CATEGORIA IGNORADA (Redistribuído)' : `${classe.ativos.filter((a: any) => a.acao === 'COMPRAR').length} ativos em compra • Fundo: ${formatarMoeda(classe.valor_aporte_classe)}`} defaultOpen={!isClasseSkip}>
                  <div className="overflow-x-auto mt-4"><table className="w-full text-left"><thead><tr className="bg-surface-2 border-b border-subtle"><th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider">Ativo</th><th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-center">Aloc. Atual</th><th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-center">Aloc. Sugerida</th><th className="py-3 px-4 text-[10px] font-bold text-emerald-600 uppercase tracking-wider text-right">Sugerido</th><th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-center w-28">Preço Mercado</th><th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-center">Cotas</th><th className="py-3 px-4 text-[10px] font-bold text-emerald-600 uppercase tracking-wider text-center w-36">Aporte Efetivo</th><th className="py-3 px-4 text-[10px] font-bold text-faint uppercase tracking-wider text-right">Ação</th></tr></thead>
                    <tbody className="divide-y divide-subtle">
                      {classe.ativos.map((at: any, aIdx: number) => {
                        const isComprando = at.acao === 'COMPRAR';
                        return (
                          <tr key={aIdx} className={`hover:bg-surface-2/50 transition-colors ${!isComprando ? 'opacity-50 grayscale bg-surface-2/30' : ''}`}>
                            <td className="py-3 px-4"><div className="flex items-center gap-2">{!isComprando && <AlertCircle size={10} className="text-faint" />}<div><p className="text-[12px] font-bold text-main uppercase tracking-tight">{at.nome}</p><p className="text-[10px] text-muted font-bold uppercase mt-0.5 tracking-wider">{at.ticker || at.cnpj || '---'}</p></div></div></td>
                            <td className="py-3 px-4 text-center text-[11px] font-bold text-muted">{at.alocacao_atual.toFixed(1)}%</td>
                            <td className="py-3 px-4 text-center text-[11px] font-bold text-main bg-emerald-50/50 rounded-md">{at.alocacao_atualizada.toFixed(1)}%</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600 text-[12px]">{at.aporte_sugerido > 0.01 ? formatarMoeda(at.aporte_sugerido) : '---'}</td>
                            <td className="py-3 px-4"><PriceInputCell initialValue={at.preco_mercado} onConfirm={v => updateManual(at.id, { preco_mercado: v })} /></td>
                            <td className="py-3 px-4 text-center"><span className={`text-[12px] font-bold ${at.cotas > 0 ? 'text-emerald-600' : 'text-faint'}`}>{at.cotas || 0}</span></td>
                            <td className="py-3 px-4"><PriceInputCell initialValue={manualSettings[at.id]?.aporte_efetivo || 0} onConfirm={v => updateManual(at.id, { aporte_efetivo: v })} /></td>
                            <td className="py-3 px-4 text-right"><button onClick={() => updateManual(at.id, { status_manual: at.acao !== 'COMPRAR' })} className={`px-3 h-7 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors border ${isComprando ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-surface-2 text-muted border-subtle hover:bg-surface-2'}`}>{isComprando ? 'Comprar' : 'Ignorar'}</button></td>
                          </tr>
                        );
                      })}
                    </tbody></table></div></Accordion>
              );
            })}
          </div>
          <div className="flex gap-3"><button onClick={() => setStep(5)} className="flex-1 h-9 font-bold text-muted border border-subtle rounded-[8px] uppercase text-[10px] tracking-wider shadow-sm hover:bg-surface-2 transition-colors">Voltar</button><button onClick={() => setStep(7)} className="flex-[2] h-9 font-bold text-white bg-emerald-600 rounded-[8px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] uppercase text-[10px] tracking-wider hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">Revisar Resumo Final <ArrowRight size={16} /></button></div>
        </div>
      )}

      {step === 7 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 pb-20">
          <div className="bg-surface p-8 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-subtle">
              <div>
                <h3 className="text-[20px] font-bold text-main uppercase tracking-tight">Resumo da Estratégia</h3>
                <p className="text-faint font-bold uppercase text-[10px] mt-1 tracking-wider">Configuração Consolidada para Execução</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-surface-2 px-4 py-3 rounded-[8px] border border-subtle shadow-sm">
                  <span className="text-[9px] font-bold text-faint uppercase block mb-1 tracking-wider">Asset Mix</span>
                  <p className="text-[12px] font-bold text-main uppercase tracking-tight">{modelosDisponiveis.find(m => m.id === estrategiaId)?.nome}</p>
                </div>
                <div className="bg-surface-2 px-4 py-3 rounded-[8px] border border-subtle shadow-sm">
                  <span className="text-[9px] font-bold text-faint uppercase block mb-1 tracking-wider">Tese / Faixa</span>
                  <p className="text-[12px] font-bold text-main uppercase tracking-tight">{tesesDisponiveis.find(t => t.id === teseId)?.nome} • {faixaAplicada?.nome}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-emerald-600 p-5 rounded-xl text-white shadow-sm">
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block mb-1">Aporte Novo</span>
                <p className="text-[24px] font-bold tracking-tighter">{formatarMoeda(aporte)}</p>
              </div>
              <div className="bg-rose-500 p-5 rounded-xl text-white shadow-sm">
                <span className="text-[10px] font-bold text-rose-100 uppercase tracking-wider block mb-1">Saldo de Vendas</span>
                <p className="text-[24px] font-bold tracking-tighter">{formatarMoeda(totalVendas)}</p>
              </div>
              <div className="bg-surface-3 p-5 rounded-xl text-white shadow-sm col-span-2 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-faint uppercase tracking-wider block mb-1">Total Disponível</span>
                  <p className="text-[24px] font-bold tracking-tighter">{formatarMoeda(aporte + totalVendas)}</p>
                </div>
                <Landmark size={28} className="text-main" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 text-emerald-600">
                  <ShieldCheck size={18} />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider">Reserva de Emergência</h4>
                </div>
                <div className="bg-surface-2 p-5 rounded-xl border border-subtle space-y-4 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-subtle">
                    <span className="text-[10px] font-bold text-faint uppercase tracking-wider">Total Alocado</span>
                    <span className="text-[14px] font-bold text-main tracking-tight">{formatarMoeda(totalAlocadoReserva)}</span>
                  </div>
                  <div className="space-y-2.5">
                    {reservaAlloc.filter(r => r.valor > 0.01).map(r => (
                      <div key={r.id} className="flex justify-between text-[11px] font-bold text-muted">
                        <span className="uppercase">{r.nome}</span>
                        <span className="font-bold">{formatarMoeda(r.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2.5 text-emerald-600">
                  <Target size={18} />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider">Projetos / Objetivos</h4>
                </div>
                <div className="bg-surface-2 p-5 rounded-xl border border-subtle space-y-4 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-subtle">
                    <span className="text-[10px] font-bold text-faint uppercase tracking-wider">Total Alocado</span>
                    <span className="text-[14px] font-bold text-main tracking-tight">{formatarMoeda(totalAlocadoProjetos)}</span>
                  </div>
                  <div className="space-y-2.5">
                    {projetosAlloc.filter(p => p.valor > 0.01).map(p => (
                      <div key={p.id} className="flex justify-between text-[11px] font-bold text-muted">
                        <span className="uppercase">{p.nome}</span>
                        <span className="font-bold">{formatarMoeda(p.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2.5 text-emerald-600">
                  <Bird size={18} />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider">Independência Financeira</h4>
                </div>
                <div className="bg-surface-2 p-5 rounded-xl border border-subtle space-y-4 shadow-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-subtle">
                    <span className="text-[10px] font-bold text-faint uppercase tracking-wider">Aporte Sugerido</span>
                    <span className="text-[14px] font-bold text-main tracking-tight">{formatarMoeda(resumo.independencia)}</span>
                  </div>
                  <div className="space-y-2.5">
                    {rebateClasses.filter(c => c.aporte_sugerido > 0.01).map((c, i) => (
                      <div key={i} className="flex justify-between text-[11px] font-bold text-muted">
                        <span className="uppercase">{c.classe}</span>
                        <span className="font-bold">{formatarMoeda(c.aporte_sugerido)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-2.5 text-main">
                <ShoppingCart size={18} />
                <h4 className="text-[11px] font-bold uppercase tracking-wider">Ordens de Compra (Simulador Tático)</h4>
              </div>
              <div className="space-y-4">
                {distribuicaoAtivos.filter(c => c.ativos.some((a: any) => a.acao === 'COMPRAR')).map((classe, cIdx) => (
                  <div key={cIdx} className="bg-surface border border-subtle rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-surface-2 px-5 py-3 border-b border-subtle flex justify-between items-center">
                      <span className="text-[10px] font-bold text-main uppercase tracking-wider">{classe.classe}</span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Fundo: {formatarMoeda(classe.valor_aporte_classe)}</span>
                    </div>
                    <table className="w-full text-left">
                      <tbody className="divide-y divide-subtle text-[12px]">
                        {classe.ativos.filter((a: any) => a.acao === 'COMPRAR').map((at: any, aIdx: number) => (
                          <tr key={aIdx}>
                            <td className="py-3 px-5">
                              <p className="font-bold text-main uppercase tracking-tight">{at.nome}</p>
                              <p className="text-[10px] text-muted font-bold uppercase mt-0.5 tracking-wider">{at.ticker || at.cnpj}</p>
                            </td>
                            <td className="py-3 px-5 text-right">
                              <div className="flex flex-col items-end">
                                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Aporte: {formatarMoeda(manualSettings[at.id]?.aporte_efetivo || at.aporte_sugerido)}</span>
                                <span className="text-[9px] font-bold text-faint uppercase mt-0.5 tracking-wider">Cotas: {at.cotas || 0}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>

            {Object.keys(vendas).length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2.5 text-rose-600">
                  <Trash2 size={18} />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider">Ordens de Venda (Desinvestimento)</h4>
                </div>
                <div className="bg-surface border border-rose-200 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-rose-50 border-b border-rose-200">
                        <th className="px-5 py-3 text-[10px] font-bold text-rose-500 uppercase tracking-wider">Ativo</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-rose-500 uppercase text-center tracking-wider">Destino</th>
                        <th className="px-5 py-3 text-[10px] font-bold text-rose-600 uppercase text-right tracking-wider">Valor Venda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-50 text-[12px]">
                      {(Object.entries(vendas) as [string, VendaItem][]).map(([id, venda]) => {
                        const at = ativos.find((a: any) => a.id === id);
                        if (!at) return null;
                        return (
                          <tr key={id}>
                            <td className="py-3 px-5">
                              <p className="font-bold text-main uppercase tracking-tight">{at.nome}</p>
                              <p className="text-[10px] text-muted font-bold uppercase mt-0.5 tracking-wider">{at.ticker || at.cnpj}</p>
                            </td>
                            <td className="py-3 px-5 text-center">
                              <span className="text-[9px] font-bold text-muted uppercase tracking-wider bg-surface-2 px-2.5 py-1 rounded-md">{venda.destino}</span>
                            </td>
                            <td className="py-3 px-5 text-right font-bold text-rose-600 tracking-tighter">{formatarMoeda(venda.valor)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3"><button onClick={() => setStep(6)} className="flex-1 h-9 font-bold text-muted border border-subtle rounded-[8px] uppercase text-[10px] tracking-wider shadow-sm hover:bg-surface-2 transition-colors">Voltar ao Simulador</button><button onClick={handleFinalizarEfetivo} className="flex-[2] h-9 font-bold text-white bg-emerald-600 rounded-[8px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] uppercase text-[10px] tracking-wider hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2">Finalizar e Sincronizar Carteira <ShoppingCart size={16} /></button></div>
        </div>
      )
      }
    </div >
  );
};

const SelectorAtivo = ({ onSelect, placeholder, ativos }: any) => {
  const [inp, setInp] = useState(''); const [show, setShow] = useState(false);
  const fil = (ativos || []).filter((a: any) => a.nome?.toLowerCase().includes(inp.toLowerCase()));
  return (<div className="relative"><div className="relative group"><input type="text" placeholder={placeholder} value={inp} onChange={e => { setInp(e.target.value); setShow(true); }} onFocus={() => setShow(true)} className="w-full h-10 pl-10 pr-4 bg-surface-2 border border-subtle rounded-[8px] text-[12px] font-bold text-main outline-none focus:bg-surface focus:border-emerald-300 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-sm" /><Search size={14} className="absolute left-4 top-3 text-faint" /><button type="button" disabled={!inp} onClick={() => { onSelect(inp); setInp(''); setShow(false); }} className="absolute right-2 top-2 h-6 w-6 flex items-center justify-center bg-emerald-600 text-white rounded-[4px] hover:bg-emerald-700 disabled:opacity-20 transition-all"><Plus size={12} strokeWidth={3} /></button></div>{show && inp && (<div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-subtle rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">{fil.map((a: any) => (<button key={a.id} type="button" onClick={() => { onSelect(a.id); setInp(''); setShow(false); }} className="w-full p-3 text-left text-[11px] font-bold text-main uppercase hover:bg-emerald-50 flex justify-between items-center transition-colors">{a.nome}</button>))}</div>)}{show && <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />}</div>);
};

export default RebalanceamentoInvestimentos;
