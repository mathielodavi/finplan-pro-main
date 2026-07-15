
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { investimentoService } from '../../services/investimentoService';
import { obterClientePorId, atualizarCliente } from '../../services/clienteService';
import { configService } from '../../services/configuracoesService';
import { carteiraRecomendadaService } from '../../services/carteiraRecomendadaService';
import { cotacaoService } from '../../services/cotacaoService';
import { formatarMoeda, formatarData, diasDesde } from '../../utils/formatadores';
import {
  CheckCircle2, ShieldCheck, Target,
  Bird, Plus, Trash2, Search,
  ChevronRight, ShoppingCart, Landmark, History,
  XCircle, AlertCircle, RefreshCw,
  Download, FileText, ArrowLeft
} from 'lucide-react';
import Accordion from '../UI/Accordion';
import { supabase } from '../../services/supabaseClient';
import { DestinoVenda, DESTINOS_VENDA } from '../../utils/destinosVenda';
import { baixarPaginasComoPDF } from '../../utils/pdfFromElement';
import HistoricoAportes from './HistoricoAportes';
import RelatorioAporteDoc, { DadosRelatorioAporte } from './RelatorioAporteDoc';
import Badge from '../UI/Badge';
import { protecaoService } from '../../services/protecaoService';
import { calcularIdade } from '../../utils/calculosFinanceiros';
import { projetarIndependencia, calcularPrazoERentabilidade, calcularAporteNecessario } from '../../utils/independenciaUtils';
import { HistoricoPatrimonio, PremissasIndependencia } from '../../services/investimentoService';
import { toast } from '../../utils/toast';

interface AlocacaoManual {
  id: string;
  nome: string;
  valor: number;
  ticker?: string;
  ativo_id?: string;
}

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

  // Flush no desmonte: se o usuário digita um valor e sai da tela (ex.: "Gerar Relatório") antes
  // do debounce de 2s disparar, o cleanup acima descartaria a edição — as cotas/aportes chegariam
  // zerados ao relatório. Aqui a edição pendente é confirmada na hora do desmonte.
  const pendenteRef = useRef({ currentValue, initialValue, onConfirm });
  pendenteRef.current = { currentValue, initialValue, onConfirm };
  useEffect(() => () => {
    const { currentValue: cv, initialValue: iv, onConfirm: fn } = pendenteRef.current;
    if (cv !== iv) fn(cv);
  }, []);

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
      <span className="absolute left-2.5 top-[11px] text-[10px] font-semibold text-faint">{prefix}</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        className="h-9 w-full pl-7 pr-2 bg-surface-2 border border-subtle rounded-lg text-[12px] font-semibold text-main outline-none focus:bg-surface focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[rgba(16,185,129,0.2)] transition-all text-center shadow-sm"
        placeholder="0,00"
      />
    </div>
  );
};

const SECOES = [
  { id: 'sec-capital', label: 'Capital' },
  { id: 'sec-distribuicao', label: 'Distribuição' },
  { id: 'sec-alocacao', label: 'Alocação' },
  { id: 'sec-tatico', label: 'Simulador Tático' },
];

// Tokens de estilo compartilhados — alinhados ao padrão calmo já usado em ResumoInvestimentos.tsx
// (cards bg-surface/border-subtle, rótulos discretos, números com peso, sem uppercase tracking-widest em excesso).
const cardCls = 'bg-surface rounded-xl border border-subtle p-4 sm:p-5';
const kpiLabel = 'text-[11px] font-semibold text-faint uppercase tracking-wider';
const sectionTitleCls = 'text-[14px] font-semibold text-main';

const RebalanceamentoInvestimentos = ({ clienteId, ativos, onFinish }: any) => {
  // 'idle' = entrada (histórico + botões); 'novo' = fluxo editável (seções 1-4);
  // 'relatorio' = tela de relatório/revisão (download PDF + finalizar); 'revisao' = leitura do último aporte.
  const [modo, setModo] = useState<'idle' | 'novo' | 'relatorio' | 'revisao'>('idle');
  const [ultimoRebal, setUltimoRebal] = useState<any>(null);
  const relatorioRef = useRef<HTMLDivElement>(null);
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  const [aporte, setAporte] = useState(0);
  // Pré-semeado a partir de ativos já sinalizados como "Vender" na Carteira Ativa (status + destino_venda
  // persistentes). Inicializador lazy: roda só uma vez no mount, nunca resemeia ao voltar para o Passo 2
  // (preserva edições manuais do consultor durante a sessão do wizard).
  const [vendas, setVendas] = useState<Record<string, VendaItem>>(() => {
    const seed: Record<string, VendaItem> = {};
    (ativos || []).forEach((a: any) => {
      if (a.status === 'Vender' && (a.valor_atual || 0) > 0.01) {
        seed[a.id] = { valor: a.valor_atual, destino: (a.destino_venda as DestinoVenda) || 'livre' };
      }
    });
    return seed;
  });
  // Seção de vendas mesclada ao Passo 1: expandida por padrão só quando já há algo pré-sinalizado.
  const [vendasExpandido, setVendasExpandido] = useState(() => Object.keys(vendas).length > 0);
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
  // Dados do plano de independência — alimentam a seção "Plano de Independência" do relatório
  // (mesmos cálculos do Resumo Geral: aporte necessário, prazos e alocação alvo vs carteira).
  const [premissasIndep, setPremissasIndep] = useState<PremissasIndependencia | null>(null);
  const [historicoPatrimonio, setHistoricoPatrimonio] = useState<HistoricoPatrimonio[]>([]);
  const [idadeCliente, setIdadeCliente] = useState<number | null>(null);
  const [taxaPosPadrao, setTaxaPosPadrao] = useState(6.25);

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

    // Plano de independência (isolado do carregamento principal — falha aqui não bloqueia o wizard)
    Promise.all([
      investimentoService.getPremissasIndependencia(clienteId),
      investimentoService.getHistoricoMensal(clienteId),
      protecaoService.getDataNascimentoCliente(clienteId),
      protecaoService.getParametros(),
    ]).then(([premData, histData, dataNascimento, parametros]) => {
      setPremissasIndep(premData || null);
      setHistoricoPatrimonio(histData || []);
      setIdadeCliente(calcularIdade(dataNascimento || undefined));
      setTaxaPosPadrao(Number(parametros.taxa_juros_aa) || 6.25);
    }).catch(err => console.error('Erro ao carregar plano de independência:', err));
  }, [clienteId]);

  const totalAlocadoReserva = useMemo(() => reservaAlloc.reduce((acc, it) => acc + it.valor, 0), [reservaAlloc]);
  const totalAlocadoProjetos = useMemo(() => projetosAlloc.reduce((acc, it) => acc + it.valor, 0), [projetosAlloc]);

  const runCalculoTatico = useCallback(async (overrides = manualSettings) => {
    if (!teseId) return;
    setLoading(true);
    try {
      // Reusa a carteira recomendada já carregada no mount; só busca se ainda não veio (evita refetch por recálculo).
      const rec = (carteiraRec && carteiraRec.length) ? carteiraRec : await carteiraRecomendadaService.listarAtivos();
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
  }, [teseId, tesesDisponiveis, ativos, bancosSelecionados, manualSettings, aporte, totalAlocadoReserva, totalAlocadoProjetos, rebateClasses, vendas, carteiraRec]);

  // Apenas registra o override manual; o recálculo tático é reativo (efeito debounce abaixo) e preserva os overrides.
  const updateManual = (id: string, up: Partial<ManualOverride>) => {
    setManualSettings(prev => ({ ...prev, [id]: { ...prev[id], ...up } }));
  };

  // Cotas derivadas em tempo de render (sempre dos overrides mais recentes). O `at.cotas` vindo
  // do último recálculo pode estar defasado: a cadeia debounce (2s) + recálculo (500ms) é
  // cancelada quando o usuário troca para o modo relatório logo após editar, e o relatório
  // exibiria cotas zeradas mesmo com preço/aporte já confirmados em manualSettings.
  const cotasAtuais = (at: any): number => {
    const ovr = manualSettings[at.id];
    const preco = ovr?.preco_mercado ?? at.preco_mercado;
    const aporteEf = ovr?.aporte_efetivo || at.aporte_sugerido;
    return preco > 0 ? Math.floor(aporteEf / preco) : 0;
  };

  // Ticker efetivo para a cotação: alguns fundos/ETFs (ex.: "ETF FIXA11 ou ETF IDKA11") foram
  // cadastrados na Carteira Recomendada com o ticker real gravado no campo `cnpj` (ex.: cnpj
  // "IDKA11", ticker "" vazio) — um resquício de importação antiga. Sem isso, esses ativos
  // nunca entravam no lote de cotação (a.ticker vazio), mesmo aparecendo como "Comprar".
  const tickerEfetivo = (a: any): string => (a.ticker || (a.cnpj && !a.cnpj.includes('/') ? a.cnpj : '')).trim();

  // Cotação automática (edge function cotacao-ativos, via brapi.dev) para ativos de bolsa com
  // ticker — só preenche o preço de mercado quando o usuário ainda não editou manualmente aquele
  // ativo. Em lotes grandes (muitos ativos "Comprar" na mesma simulação) alguns tickers podem
  // falhar por rate-limit momentâneo da brapi.dev enquanto outros do mesmo lote são atendidos —
  // por isso um ticker só é "desistido" após algumas tentativas (retryzinho automático a cada
  // ~4s), em vez de ficar bloqueado pro resto da sessão na primeira falha.
  const tentativasRef = useRef<Map<string, number>>(new Map());
  const MAX_TENTATIVAS_COTACAO = 3;
  useEffect(() => {
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const buscar = () => {
      const candidatos = distribuicaoAtivos.flatMap((c: any) => c.ativos || [])
        .filter((a: any) => a.acao === 'COMPRAR' && tickerEfetivo(a) && manualSettings[a.id]?.preco_mercado === undefined
          && (tentativasRef.current.get(tickerEfetivo(a)) || 0) < MAX_TENTATIVAS_COTACAO);
      const tickers = Array.from(new Set(candidatos.map((a: any) => tickerEfetivo(a))));
      if (tickers.length === 0) return;
      tickers.forEach(t => tentativasRef.current.set(t, (tentativasRef.current.get(t) || 0) + 1));

      cotacaoService.getCotacoes(tickers).then(cotacoes => {
        if (cancelado) return;
        let faltouAlgum = false;
        candidatos.forEach((a: any) => {
          const tk = tickerEfetivo(a);
          if (cotacoes[tk] && manualSettings[a.id]?.preco_mercado === undefined) {
            updateManual(a.id, { preco_mercado: cotacoes[tk] });
          } else if (!cotacoes[tk]) {
            faltouAlgum = true;
          }
        });
        if (faltouAlgum) timer = setTimeout(buscar, 4000);
      }).catch(() => {});
    };

    buscar();
    return () => { cancelado = true; if (timer) clearTimeout(timer); };
  }, [distribuicaoAtivos]);


  // Recálculo reativo das classes (resumo/rebate) — substitui o antigo botão "Confirmar Aporte e Avançar".
  useEffect(() => {
    if (modo !== 'novo') return;
    if (aporte <= 0 || !estrategiaId) { setResumo(null); setRebateClasses([]); setPatrimonioProjetado(0); return; }
    const modelo = modelosDisponiveis.find(m => m.id === estrategiaId);
    if (!modelo) return;
    const h = setTimeout(() => {
      try {
        const vendasPorDestino = { reserva: 0, projetos: 0, independencia: 0, livre: 0 };
        (Object.values(vendas) as VendaItem[]).forEach(({ valor, destino }: VendaItem) => {
          vendasPorDestino[destino as DestinoVenda] = (vendasPorDestino[destino as DestinoVenda] || 0) + valor;
        });
        const vendasPorObj = { reserva: vendasPorDestino.reserva, projetos: vendasPorDestino.projetos, independencia: vendasPorDestino.independencia };
        const aporteEfetivo = aporte + vendasPorDestino.livre;
        const result = investimentoService.calcularRebateOtimo(ativos, aporteEfetivo, cliente?.reserva_recomendada || 0, projetos, modelo.classes || [], vendasPorObj);
        setResumo(result.resumo);
        setRebateClasses(result.distribuicaoIndependencia);
        setPatrimonioProjetado(result.totalIndepProjetado);
      } catch (err) { console.error(err); }
    }, 400);
    return () => clearTimeout(h);
  }, [modo, aporte, estrategiaId, vendas, cliente, projetos, modelosDisponiveis, ativos]);

  // Recálculo reativo do Simulador Tático — substitui o antigo botão "Próximo: Simulador Tático".
  useEffect(() => {
    if (modo !== 'novo' || !teseId || rebateClasses.length === 0) return;
    const h = setTimeout(() => { runCalculoTatico(); }, 500);
    return () => clearTimeout(h);
  }, [modo, teseId, rebateClasses, runCalculoTatico]);

  const handleUpdatePerfil = async (key: string, value: any) => {
    const payload = { [key]: key === 'bancos_ativos' ? (value as string[]).join(',') : value };
    await atualizarCliente(clienteId, payload);
  };

  const totalVendas = useMemo(() => (Object.values(vendas) as VendaItem[]).reduce((acc, v) => acc + v.valor, 0), [vendas]);

  // Defasagem da carteira recomendada: algum ativo da tese/faixa aplicada com atualização > 30 dias.
  const carteiraDefasada = useMemo(() => {
    if (!faixaAplicada || !teseId) return false;
    return (carteiraRec || []).some((r: any) =>
      r.estrategia_id === teseId && r.faixa_id === faixaAplicada.id && (diasDesde(r.atualizado_em) === null || (diasDesde(r.atualizado_em) as number) > 30)
    );
  }, [carteiraRec, faixaAplicada, teseId]);

  // ─── Plano de independência (para o relatório) — mesma matemática do Resumo Geral ───────────
  const patrimonioFinanceiroTotal = useMemo(
    () => (ativos || []).reduce((acc: number, a: any) => acc + (a.valor_atual || 0), 0),
    [ativos]
  );

  const premissasEfetivas = useMemo<PremissasIndependencia>(() => ({
    cliente_id: clienteId,
    renda_alvo: Number(premissasIndep?.renda_alvo ?? 10000),
    taxa_real_anual: Number(premissasIndep?.taxa_real_anual ?? 6),
    patrimonio_inicial: cliente?.patrimonio_total || 0,
    aporte_mensal: premissasIndep ? Number(premissasIndep.aporte_mensal) : (cliente?.aporte_mensal || 0),
    prazo_anos: Number(premissasIndep?.prazo_anos ?? 20),
    data_inicio: premissasIndep?.data_inicio ?? new Date().toISOString().split('T')[0],
    outras_fontes_renda: Number(premissasIndep?.outras_fontes_renda) || 0,
    taxa_pos_aposentadoria: premissasIndep?.taxa_pos_aposentadoria !== null && premissasIndep?.taxa_pos_aposentadoria !== undefined ? Number(premissasIndep.taxa_pos_aposentadoria) : null,
  }), [premissasIndep, cliente, clienteId]);

  const eventosSaque = useMemo(() => {
    const dataInicio = new Date(premissasEfetivas.data_inicio);
    return (projetos || [])
      .filter((p: any) => p.data_alvo && p.valor_alvo > 0)
      .map((p: any) => {
        const dataAlvo = new Date(p.data_alvo);
        return { mes: Math.round((dataAlvo.getFullYear() - dataInicio.getFullYear()) * 12 + (dataAlvo.getMonth() - dataInicio.getMonth())), valor: p.valor_alvo };
      });
  }, [projetos, premissasEfetivas.data_inicio]);

  const prazoIndepInfo = useMemo(() => calcularPrazoERentabilidade(premissasEfetivas, historicoPatrimonio), [premissasEfetivas, historicoPatrimonio]);

  const projecaoIndep = useMemo(
    () => projetarIndependencia(premissasEfetivas, patrimonioFinanceiroTotal, historicoPatrimonio, {
      consumo: { idadeAtual: idadeCliente, taxaRentabilizacaoAnual: premissasEfetivas.taxa_pos_aposentadoria ?? taxaPosPadrao },
      realizado: prazoIndepInfo,
      eventosSaque,
    }),
    [premissasEfetivas, patrimonioFinanceiroTotal, historicoPatrimonio, idadeCliente, taxaPosPadrao, prazoIndepInfo, eventosSaque]
  );

  // Meta de aporte mensal (mesma do callout do Resumo): quanto precisa investir/mês para chegar
  // ao capital de liberdade no prazo planejado, repondo os saques de objetivos no caminho.
  const aporteMetaMensal = useMemo(() => {
    const mesesRestantes = premissasEfetivas.prazo_anos * 12 - projecaoIndep.mesesAteHoje;
    const saquesAntesDaMeta = eventosSaque
      .map(e => ({ mesesAteSaque: e.mes - projecaoIndep.mesesAteHoje, valor: e.valor }))
      .filter(s => s.mesesAteSaque > 0 && s.mesesAteSaque <= mesesRestantes);
    return calcularAporteNecessario(patrimonioFinanceiroTotal, projecaoIndep.patrimonioNecessario, mesesRestantes, premissasEfetivas.taxa_real_anual, saquesAntesDaMeta);
  }, [premissasEfetivas, projecaoIndep, eventosSaque, patrimonioFinanceiroTotal]);

  // Alocação alvo (modelo) vs carteira atual por classe — versão em barras CSS (html2canvas-safe)
  // do gráfico do Resumo Geral, restrita à fatia de independência como lá.
  const barDataRelatorio = useMemo(() => {
    const modelo = modelosDisponiveis.find(m => m.id === estrategiaId);
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
    return (modelo?.classes || []).map((c: any) => ({
      classe: c.nome,
      alvo: Number(c.percentual) || 0,
      atual: total > 0 ? ((porClasse[c.nome] || 0) / total) * 100 : 0,
      cor: c.cor_rgb || '#10b981',
    }));
  }, [modelosDisponiveis, estrategiaId, ativos]);

  // Reconstrói a Revisão Final do último aporte a partir do log salvo (prefixos nos nomes), para o modo leitura.
  const revisaoData = useMemo(() => {
    if (!ultimoRebal) return null;
    const reserva: any[] = [], projeto: any[] = [], indep: any[] = [], venda: any[] = [];
    (ultimoRebal.itens || []).forEach((it: any) => {
      const nome = it.ativo_nome_avulso || '';
      const v = it.valor_distribuido || 0;
      if (nome.startsWith('[RESERVA]')) reserva.push({ nome: nome.replace('[RESERVA]', '').trim(), valor: v });
      else if (nome.startsWith('[PROJETO]')) projeto.push({ nome: nome.replace('[PROJETO]', '').trim(), valor: v });
      else if (nome.startsWith('[VENDA')) {
        const m = nome.match(/\[VENDA→(.+?)\]/);
        venda.push({ destino: (m?.[1] || '').toLowerCase(), nome: nome.replace(/\[VENDA→.+?\]\s*/, '').trim(), valor: Math.abs(v) });
      } else indep.push({ nome, valor: v });
    });
    const sum = (arr: any[]) => arr.reduce((s, x) => s + x.valor, 0);
    return { reserva, projeto, indep, venda, totalReserva: sum(reserva), totalProjeto: sum(projeto), totalIndep: sum(indep), totalVendasRev: sum(venda) };
  }, [ultimoRebal]);

  // Habilitação progressiva das seções da página única.
  const temAporteEfetivo = useMemo(() => distribuicaoAtivos.some((c: any) => (c.ativos || []).some((a: any) => (manualSettings[a.id]?.aporte_efetivo || 0) > 0.01)), [distribuicaoAtivos, manualSettings]);
  const temReservaAlloc = useMemo(() => reservaAlloc.some(r => r.valor > 0.01), [reservaAlloc]);
  const temProjetosAlloc = useMemo(() => projetosAlloc.some(p => p.valor > 0.01), [projetosAlloc]);
  const secEnabled: Record<string, boolean> = {
    'sec-capital': true,
    'sec-distribuicao': !!resumo,
    'sec-alocacao': !!resumo,
    'sec-tatico': distribuicaoAtivos.length > 0,
  };
  const podeFinalizar = aporte > 0 && !!estrategiaId && (temAporteEfetivo || temReservaAlloc || temProjetosAlloc);

  const handleToggleVenda = (id: string, valorAtual: number) => {
    const nv: Record<string, VendaItem> = { ...vendas };
    if (nv[id]) delete nv[id];
    else nv[id] = { valor: valorAtual, destino: 'livre' };
    setVendas(nv);
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
        toast.info("Preencha ao menos um valor de 'Aporte Efetivo' antes de finalizar.");
        setFinishing(false); return;
      }

      // Consolida na carteira real: aportes/compras somam a um ativo já existente (por ticker/cnpj/nome)
      // ou criam um novo registro; vendas mantidas até aqui (sem cancelamento do consultor) retiram o
      // ativo integralmente da carteira.
      await investimentoService.processarAporteFinal(clienteId, ativos, reservaAlloc, projetosAlloc, indepEfetivos, projetos);
      const idsVendidos = Object.keys(vendas);
      await investimentoService.processarVendasEfetivas(idsVendidos);

      // Processar vendas no histórico
      const vendasEfetivas = (Object.entries(vendas) as [string, VendaItem][]).map(([id, venda]) => {
        const at = ativos.find((a: any) => a.id === id);
        return {
          nome: `[VENDA→${venda.destino.toUpperCase()}] ${at?.nome || id}`,
          valor_distribuido: -venda.valor,
          valor_anterior: at?.valor_atual || 0,
          valor_novo: 0
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
    } catch (err: any) {
      toast.error("Erro técnico ao salvar: " + (err.message || "Erro desconhecido"));
    } finally { setFinishing(false); }
  };

  // Gera o PDF a partir do próprio layout do relatório na tela: cada [data-pdf-page] vira uma
  // folha A4 paisagem, com os links (QR codes, Finclass) reanotados como áreas clicáveis.
  const handleDownloadRelatorio = async () => {
    if (!relatorioRef.current) return;
    setBaixandoPdf(true);
    try {
      const nomeArq = `Simulacao_Alocacao_${(cliente?.nome || 'cliente').replace(/\s+/g, '_')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      await document.fonts.ready;
      await baixarPaginasComoPDF(relatorioRef.current, nomeArq);
    } catch (err: any) {
      toast.error('Erro ao gerar o PDF: ' + (err?.message || 'tente novamente.'));
    } finally {
      setBaixandoPdf(false);
    }
  };

  // Tela de relatório/revisão — separada do fluxo de edição. Baixa o PDF (mesmo layout) ou finaliza.
  if (modo === 'relatorio') {
    const reservaAcumulada = (ativos || []).reduce((acc: number, a: any) => {
      const l = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'reserva');
      return acc + (l ? a.valor_atual * (l.percentual / 100) : 0);
    }, 0);

    const dadosRelatorio: DadosRelatorioAporte = {
      clienteNome: cliente?.nome || 'Cliente',
      planejadorNome: planejador?.nome || null,
      dataStr: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
      perfilNome: modelosDisponiveis.find(m => m.id === estrategiaId)?.nome || '—',
      teseNome: tesesDisponiveis.find(t => t.id === teseId)?.nome || '—',
      faixaNome: faixaAplicada?.nome || '—',
      aporte,
      totalVendas,
      recursoDisponivel: aporte + totalVendas,
      distribuicao: {
        reserva: totalAlocadoReserva,
        projetos: totalAlocadoProjetos,
        independencia: Math.max(0, aporte + totalVendas - totalAlocadoReserva - totalAlocadoProjetos),
      },
      aporteMetaMensal,
      deltaPrazoMeses: projecaoIndep.mesIndependenciaReal !== null
        ? projecaoIndep.mesIndependenciaReal - prazoIndepInfo.prazoInicialMeses
        : null,
      barData: barDataRelatorio,
      curva: projecaoIndep.chartData,
      reserva: {
        alvo: cliente?.reserva_recomendada || 0,
        acumulado: reservaAcumulada,
        aportarEm: reservaAlloc.filter(r => r.valor > 0.01).map(r => ({ nome: r.nome, valor: r.valor })),
      },
      projetos: (projetos || []).filter((p: any) => p.valor_alvo > 0).map((p: any) => ({
        nome: p.nome,
        alvo: p.valor_alvo,
        acumulado: (ativos || []).reduce((acc: number, a: any) => {
          const l = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'projeto' && o.projeto_id === p.id);
          return acc + (l ? a.valor_atual * (l.percentual / 100) : 0);
        }, 0),
      })),
      projetosAportarEm: projetosAlloc.filter(p => p.valor > 0.01).map(p => ({ nome: p.nome, valor: p.valor })),
      vendas: (Object.entries(vendas) as [string, VendaItem][]).map(([id, v]) => {
        const at = (ativos || []).find((a: any) => a.id === id);
        return { nome: at?.nome || id, codigo: at?.ticker || at?.cnpj || '', destino: v.destino, valor: v.valor };
      }),
      ordens: distribuicaoAtivos
        .filter((c: any) => (c.ativos || []).some((a: any) => a.acao === 'COMPRAR'))
        .map((c: any) => ({
          classe: c.classe,
          fundo: c.valor_aporte_classe,
          ativos: c.ativos.filter((a: any) => a.acao === 'COMPRAR').map((a: any) => ({
            nome: a.nome,
            codigo: a.ticker || a.cnpj || '',
            aporte: manualSettings[a.id]?.aporte_efetivo || a.aporte_sugerido,
            cotas: cotasAtuais(a),
          })),
        })),
      whatsappUrl: 'https://wa.me/5527988535056',
      instagramUrl: 'https://instagram.com/mathielodavi',
    };

    return (
      <div className="max-w-5xl mx-auto py-4 px-2 sm:px-4 relative animate-in fade-in slide-in-from-bottom-4">
        {finishing && (<div className="fixed inset-0 z-[60] bg-surface/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4"><RefreshCw size={48} className="text-[color:var(--primary)] animate-spin" /><p className="text-[12px] font-semibold text-main">Sincronizando decisões...</p></div>)}

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setModo('novo')} disabled={success} className="h-9 w-9 shrink-0 bg-surface-2 text-faint rounded-2xl flex items-center justify-center hover:bg-surface-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"><ArrowLeft size={18} /></button>
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-main truncate">Relatório de Alocação</h3>
            <p className="text-[12px] text-muted mt-0.5">Revise, baixe o relatório em PDF e finalize a sincronização</p>
          </div>
        </div>

        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border p-4" style={{ backgroundColor: 'var(--primary-soft)', borderColor: 'rgba(16,185,129,0.25)' }}>
            <CheckCircle2 size={20} style={{ color: 'var(--primary)' }} />
            <div>
              <p className="text-[13px] font-semibold text-main">Aporte finalizado e sincronizado</p>
              <p className="text-[12px] text-muted">O histórico foi registrado e já aparece na tela de aportes.</p>
            </div>
          </div>
        )}

        {/* Documento editorial paginado — rola horizontal na tela se a janela for menor que a página */}
        <div className="overflow-x-auto rounded-xl">
          <RelatorioAporteDoc dados={dadosRelatorio} innerRef={relatorioRef} />
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={handleDownloadRelatorio}
            disabled={baixandoPdf}
            className="h-11 px-6 inline-flex items-center justify-center gap-2 rounded-lg border border-subtle bg-surface-2 text-main text-[12px] font-semibold hover:bg-surface-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} /> {baixandoPdf ? 'Gerando PDF...' : 'Gerar Relatório'}
          </button>
          {!success ? (
            <button
              onClick={handleFinalizarEfetivo}
              disabled={finishing}
              className="h-11 px-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[color:var(--primary)] text-[#0b0e14] text-[12px] font-semibold hover:opacity-90 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)] disabled:opacity-50"
            >
              Finalizar e Sincronizar <ShoppingCart size={16} />
            </button>
          ) : (
            <button
              onClick={onFinish}
              className="h-11 px-6 inline-flex items-center justify-center gap-2 rounded-lg bg-surface-3 text-white text-[12px] font-semibold hover:bg-strong transition-colors"
            >
              Voltar ao Resumo
            </button>
          )}
        </div>
      </div>
    );
  }

  if (modo === 'idle') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-surface p-4 sm:p-5 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div>
            <h3 className="text-[16px] font-semibold text-main">Aporte Mensal</h3>
            <p className="text-[12px] text-muted mt-1">Simule o protocolo do mês ou revise o último executado</p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => ultimoRebal ? setModo('revisao') : toast.info('Nenhum histórico disponível.')}
              disabled={!ultimoRebal}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-lg border border-subtle bg-surface-2 text-muted text-[12px] font-semibold hover:bg-surface-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <History size={15} /> Revisar Último
            </button>
            <button
              onClick={() => setModo('novo')}
              className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-[color:var(--primary)] text-[#0b0e14] text-[12px] font-semibold hover:opacity-90 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
            >
              <Plus size={15} /> Novo Aporte Mensal
            </button>
          </div>
        </div>
        <HistoricoAportes clienteId={clienteId} />
      </div>
    );
  }

  // Modo leitura — reconstrói a Revisão Final do último aporte dentro do mesmo shell da página única.
  if (modo === 'revisao') {
    return (
      <div className="max-w-6xl mx-auto py-4 px-2 sm:px-4 relative animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setModo('idle')} className="h-9 w-9 shrink-0 bg-surface-2 text-faint rounded-2xl flex items-center justify-center hover:bg-surface-3 transition-all"><XCircle size={18} /></button>
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-main truncate">Último Aporte Executado</h3>
            {ultimoRebal && <p className="text-[11px] text-faint mt-0.5">Em {formatarData(ultimoRebal.data_rebalanceamento)} • somente leitura</p>}
          </div>
        </div>

        {!ultimoRebal || !revisaoData ? (
          <div className="py-16 text-center border border-dashed border-subtle rounded-xl"><p className="text-[12px] text-faint font-semibold">Nenhum aporte registrado para revisar.</p></div>
        ) : (
          <div className="bg-surface p-4 sm:p-8 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[color:var(--primary)] p-5 rounded-xl text-[#0b0e14] shadow-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1 opacity-70">Aporte Novo</span>
                <p className="text-[24px] font-bold tracking-tighter">{formatarMoeda(ultimoRebal.valor_aporte)}</p>
              </div>
              <div className="p-5 rounded-xl text-white shadow-sm" style={{ backgroundColor: 'var(--danger)' }}>
                <span className="text-[11px] font-semibold uppercase tracking-wider block mb-1 opacity-80">Saldo de Vendas</span>
                <p className="text-[24px] font-bold tracking-tighter">{formatarMoeda(revisaoData.totalVendasRev)}</p>
              </div>
              <div className="bg-surface-3 p-5 rounded-xl text-white shadow-sm sm:col-span-2 flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-faint uppercase tracking-wider block mb-1">Total Disponível</span>
                  <p className="text-[24px] font-bold tracking-tighter">{formatarMoeda((ultimoRebal.valor_aporte || 0) + revisaoData.totalVendasRev)}</p>
                </div>
                <Landmark size={28} className="text-main" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: <ShieldCheck size={18} />, titulo: 'Reserva de Emergência', total: revisaoData.totalReserva, itens: revisaoData.reserva },
                { icon: <Target size={18} />, titulo: 'Projetos / Objetivos', total: revisaoData.totalProjeto, itens: revisaoData.projeto },
                { icon: <Bird size={18} />, titulo: 'Independência Financeira', total: revisaoData.totalIndep, itens: revisaoData.indep },
              ].map((bloco, bi) => (
                <div key={bi} className="space-y-4">
                  <div className="flex items-center gap-2.5" style={{ color: 'var(--primary)' }}>{bloco.icon}<h4 className="text-[12px] font-semibold">{bloco.titulo}</h4></div>
                  <div className="bg-surface-2 p-5 rounded-xl border border-subtle space-y-4 shadow-sm">
                    <div className="flex justify-between items-center pb-3 border-b border-subtle">
                      <span className="text-[10px] font-bold text-faint uppercase tracking-wider">Total Alocado</span>
                      <span className="text-[14px] font-bold text-main tracking-tight">{formatarMoeda(bloco.total)}</span>
                    </div>
                    <div className="space-y-2.5">
                      {bloco.itens.length === 0 ? <p className="text-[11px] text-faint">—</p> : bloco.itens.map((it: any, ii: number) => (
                        <div key={ii} className="flex justify-between text-[11px] font-bold text-muted"><span className="uppercase">{it.nome}</span><span className="font-bold">{formatarMoeda(it.valor)}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {revisaoData.venda.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5" style={{ color: 'var(--danger)' }}><Trash2 size={16} /><h4 className="text-[12px] font-semibold">Ordens de Venda (Desinvestimento)</h4></div>
                <div className="bg-surface rounded-xl overflow-hidden shadow-sm border" style={{ borderColor: 'rgba(248,113,113,0.25)' }}>
                  <table className="w-full text-left">
                    <thead><tr className="border-b" style={{ backgroundColor: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.25)' }}><th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--danger)' }}>Ativo</th><th className="px-5 py-3 text-[11px] font-semibold uppercase text-center tracking-wider" style={{ color: 'var(--danger)' }}>Destino</th><th className="px-5 py-3 text-[11px] font-semibold uppercase text-right tracking-wider" style={{ color: 'var(--danger)' }}>Valor Venda</th></tr></thead>
                    <tbody className="divide-y divide-subtle text-[12px]">
                      {revisaoData.venda.map((v: any, vi: number) => (
                        <tr key={vi}><td className="py-3 px-5"><p className="font-bold text-main uppercase tracking-tight">{v.nome}</p></td><td className="py-3 px-5 text-center"><span className="text-[10px] font-semibold text-muted uppercase tracking-wider bg-surface-2 px-2.5 py-1 rounded-md">{v.destino}</span></td><td className="py-3 px-5 text-right font-bold tracking-tighter" style={{ color: 'var(--danger)' }}>{formatarMoeda(v.valor)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-4 px-2 sm:px-4 relative">
      {finishing && (<div className="fixed inset-0 z-[60] bg-surface/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4 print:hidden"><RefreshCw size={48} className="text-[color:var(--primary)] animate-spin" /><p className="text-[12px] font-semibold text-main">Sincronizando decisões...</p></div>)}

      {/* Cabeçalho da página única — escondido na impressão (só a Revisão é impressa) */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <button onClick={() => setModo('idle')} className="h-9 w-9 shrink-0 bg-surface-2 text-faint rounded-2xl flex items-center justify-center hover:bg-surface-3 transition-all"><XCircle size={18} /></button>
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-main truncate">Novo Aporte Mensal</h3>
          <p className="text-[12px] text-muted mt-0.5">Preencha as seções em sequência — os cálculos atualizam sozinhos</p>
        </div>
      </div>

      {/* Nav horizontal (mobile) — "Gerar Relatório" junto ao menu de etapas */}
      <SecaoNav secoes={SECOES} enabledMap={secEnabled} variante="mobile" podeFinalizar={podeFinalizar} onGerarRelatorio={() => setModo('relatorio')} />

      <div className="lg:grid lg:grid-cols-[180px_1fr] lg:gap-8">
        <SecaoNav secoes={SECOES} enabledMap={secEnabled} variante="lateral" podeFinalizar={podeFinalizar} onGerarRelatorio={() => setModo('relatorio')} />

        <div className="space-y-10 pb-10 min-w-0">
          <SectionShell id="sec-capital" numero={1} hideOnPrint titulo="Capital Disponível" descricao="Defina o valor do aporte e confirme as vendas sinalizadas">
          <div className="space-y-4">
            <div className={`${cardCls} space-y-4`}>
              <label className={kpiLabel}>Capital Disponível</label>
              <div className="relative">
                <span className="absolute left-0 top-2.5 text-faint font-bold text-[24px]">R$</span>
                <input
                  type="text"
                  autoFocus
                  value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(aporte)}
                  onChange={e => setAporte(parseInt(e.target.value.replace(/\D/g, "") || "0") / 100)}
                  className="w-full pl-12 bg-transparent border-b-2 border-subtle text-[28px] sm:text-[32px] font-bold text-main outline-none pb-2 focus:border-[color:var(--primary)] transition-all tracking-tighter"
                />
              </div>
              <p className="text-[12px] text-faint">O valor será distribuído conforme a estratégia definida no resumo geral.</p>
            </div>

            <div className={`${cardCls} space-y-3`}>
              <div className="flex justify-between items-center">
                <span className={kpiLabel}>Estratégia atual</span>
                <span className="text-[12px] font-semibold text-main">{modelosDisponiveis.find(m => m.id === estrategiaId)?.nome || 'Não definida'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={kpiLabel}>Tese de investimento</span>
                <span className="text-[12px] font-semibold text-main">{tesesDisponiveis.find(t => t.id === teseId)?.nome || 'Não definida'}</span>
              </div>
            </div>

            {/* Vendas e desinvestimentos — seção expansível, mesclada do antigo Passo 2 */}
            <div className="border border-subtle rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setVendasExpandido(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 bg-surface-2 hover:bg-surface-3 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Trash2 size={16} className="text-[color:var(--danger)] shrink-0" />
                  <span className="text-[13px] font-semibold text-main truncate">Vendas e desinvestimentos</span>
                  {Object.keys(vendas).length > 0 && (
                    <Badge variant="danger" size="sm">{Object.keys(vendas).length} sinalizada(s)</Badge>
                  )}
                </div>
                <ChevronRight size={16} className={`text-faint transition-transform ${vendasExpandido ? 'rotate-90' : ''}`} />
              </button>
              {vendasExpandido && (
                <div className="p-5 space-y-4 border-t border-subtle">
                  <p className="text-[12px] text-faint">Vendas sinalizadas na Carteira Ativa — ajuste valores e destinos lá; aqui você só confirma ou cancela para este mês</p>
                  {Object.keys(vendas).length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-subtle rounded-lg">
                      <p className="text-[11px] text-faint">Nenhum ativo sinalizado para venda. Marque "Sinalizar venda" na Carteira Ativa para que apareça aqui.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Object.keys(vendas).map((id: string) => {
                        const at = (ativos || []).find((a: any) => a.id === id);
                        if (!at) return null;
                        const venda = vendas[id];
                        const destinoInfo = DESTINOS_VENDA.find(d => d.key === venda.destino) || DESTINOS_VENDA[DESTINOS_VENDA.length - 1];
                        return (
                          <div key={id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: 'rgba(248,113,113,0.05)' }}>
                            <div className="min-w-0">
                              <p className="font-semibold text-main text-[13px]">{at.nome}</p>
                              <p className="text-[11px] text-muted mt-0.5">{at.ticker || at.cnpj || '---'}</p>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right">
                                <p className={kpiLabel}>Valor a vender</p>
                                <p className="text-[13px] font-bold tracking-tighter" style={{ color: 'var(--danger)' }}>{formatarMoeda(venda.valor)}</p>
                              </div>
                              <span className={`px-2.5 py-1 rounded-md border text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${destinoInfo.color}`}>{destinoInfo.label}</span>
                              <button
                                type="button"
                                onClick={() => handleToggleVenda(id, at.valor_atual)}
                                className="px-3 h-7 rounded-md text-[11px] font-semibold transition-colors border hover:opacity-90 shrink-0"
                                style={{ backgroundColor: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {totalVendas > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-surface-2 rounded-xl border border-subtle">
                      <div>
                        <p className={`${kpiLabel} mb-1`}>Aporte base</p>
                        <p className="text-[14px] font-bold text-main tracking-tighter">{formatarMoeda(aporte)}</p>
                      </div>
                      <div>
                        <p className={`${kpiLabel} mb-1`}>Saldo de vendas</p>
                        <p className="text-[14px] font-bold tracking-tighter" style={{ color: 'var(--danger)' }}>{formatarMoeda(totalVendas)}</p>
                      </div>
                      <div>
                        <p className={`${kpiLabel} mb-1`} style={{ color: 'var(--primary)' }}>Total disponível</p>
                        <p className="text-[14px] font-bold tracking-tighter" style={{ color: 'var(--primary)' }}>{formatarMoeda(aporte + totalVendas)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
          </SectionShell>

          <SectionShell id="sec-distribuicao" numero={2} hideOnPrint titulo="Resumo da Distribuição" descricao="Alvos calculados para Reserva, Projetos e Independência" disabled={!secEnabled['sec-distribuicao']} hint="Defina o capital e a estratégia para calcular a distribuição">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={cardCls}><ShieldCheck size={18} className="mb-3" style={{ color: 'var(--primary)' }} /><p className={kpiLabel}>Alvo Reserva</p><p className="text-[22px] font-bold tracking-tight leading-none text-main mt-2">{formatarMoeda(resumo?.reserva || 0)}</p>{(Object.values(vendas) as VendaItem[]).some(v => v.destino === 'reserva') && <p className="text-[11px] font-semibold text-muted mt-2">+ saldo de vendas</p>}</div>
              <div className={cardCls}><Target size={18} className="mb-3" style={{ color: 'var(--info)' }} /><p className={kpiLabel}>Alvo Projetos</p><p className="text-[22px] font-bold tracking-tight leading-none text-main mt-2">{formatarMoeda(resumo?.projetos || 0)}</p>{(Object.values(vendas) as VendaItem[]).some(v => v.destino === 'projetos') && <p className="text-[11px] font-semibold text-muted mt-2">+ saldo de vendas</p>}</div>
              <div className={cardCls}><Bird size={18} className="mb-3" style={{ color: 'var(--primary)' }} /><p className={kpiLabel}>Alvo Independência</p><p className="text-[22px] font-bold tracking-tight leading-none text-main mt-2">{formatarMoeda(resumo?.independencia || 0)}</p>{(Object.values(vendas) as VendaItem[]).some(v => v.destino === 'independencia') && <p className="text-[11px] font-semibold text-muted mt-2">+ saldo de vendas</p>}</div>
            </div>
          </SectionShell>

          <SectionShell id="sec-alocacao" numero={3} hideOnPrint titulo="Alocação Manual" descricao="Direcione valores para a Reserva e Projetos antes do simulador" disabled={!secEnabled['sec-alocacao']} hint="Aguardando o cálculo da distribuição">
            <div className="space-y-4">
          <section className={`${cardCls} space-y-4`}>
            <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-subtle"><div><h3 className={sectionTitleCls}>Reserva</h3><p className="text-[12px] text-muted mt-0.5">Meta: {formatarMoeda(resumo?.reserva || 0)}</p></div><div className="px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}>Alocado: {formatarMoeda(totalAlocadoReserva)}</div></div>
            {reservaAlloc.map((it, idx) => (<div key={it.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"><div className="flex-1 min-w-0 px-4 py-3 bg-surface-2 rounded-lg font-semibold text-[12px] text-main truncate">{it.nome}</div><div className="flex items-center gap-2"><div className="w-full sm:w-40"><PriceInputCell initialValue={it.valor} onConfirm={val => { const n = [...reservaAlloc]; n[idx].valor = val; setReservaAlloc(n); }} /></div><button onClick={() => setReservaAlloc(reservaAlloc.filter(x => x.id !== it.id))} className="p-2 text-faint hover:text-[color:var(--danger)] transition-colors shrink-0"><Trash2 size={16} /></button></div></div>))}
            <SelectorAtivo onSelect={(val: string) => { const ex = ativos.find((a: any) => a.id === val || a.nome === val); setReservaAlloc([...reservaAlloc, { id: ex?.id || `new-${Date.now()}`, nome: ex?.nome || val, valor: 0, ticker: ex?.ticker, ativo_id: ex?.id }]); }} placeholder="Adicionar à Reserva..." ativos={ativos} />
          </section>
          <section className={`${cardCls} space-y-4`}>
            <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-subtle"><div><h3 className={sectionTitleCls}>Projetos</h3><p className="text-[12px] text-muted mt-0.5">Meta: {formatarMoeda(resumo?.projetos || 0)}</p></div><div className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-[rgba(167,139,250,0.14)] text-[#c4b5fd]">Alocado: {formatarMoeda(totalAlocadoProjetos)}</div></div>
            {projetosAlloc.map((it, idx) => (<div key={it.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"><div className="flex-1 min-w-0 px-4 py-3 bg-surface-2 rounded-lg font-semibold text-[12px] text-main truncate">{it.nome}</div><div className="flex items-center gap-2"><div className="w-full sm:w-40"><PriceInputCell initialValue={it.valor} onConfirm={val => { const n = [...projetosAlloc]; n[idx].valor = val; setProjetosAlloc(n); }} /></div><button onClick={() => setProjetosAlloc(projetosAlloc.filter(x => x.id !== it.id))} className="p-2 text-faint hover:text-[color:var(--danger)] transition-colors shrink-0"><Trash2 size={16} /></button></div></div>))}
            <SelectorAtivo onSelect={(val: string) => { const ex = ativos.find((a: any) => a.id === val || a.nome === val); setProjetosAlloc([...projetosAlloc, { id: ex?.id || `new-${Date.now()}`, nome: ex?.nome || val, valor: 0, ticker: ex?.ticker, ativo_id: ex?.id }]); }} placeholder="Adicionar aos Projetos..." ativos={ativos} />
          </section>
            </div>
          </SectionShell>

          <SectionShell id="sec-tatico" numero={4} hideOnPrint titulo="Simulador Tático" descricao="Ajuste preço de mercado e aporte efetivo por ativo" disabled={!secEnabled['sec-tatico']} hint="Conclua a alocação manual para liberar o simulador">
            <div className="space-y-4">
          {carteiraDefasada && (
            <div className="flex items-start gap-2.5 rounded-xl border p-3" style={{ backgroundColor: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.25)' }}>
              <AlertCircle size={16} className="text-[color:var(--warning)] shrink-0 mt-0.5" />
              <p className="text-[12px] text-muted">
                <span className="font-semibold" style={{ color: 'var(--warning)' }}>Carteira recomendada defasada.</span> Há ativos desta tese/faixa com atualização há mais de 30 dias — revise a Carteira Recomendada antes de aplicar o aporte.
              </p>
            </div>
          )}
          <div className={`${cardCls} flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4`}>
            <div>
              <span className={kpiLabel}>Aporte IF total</span>
              <p className="text-[20px] font-bold text-main tracking-tight leading-none mt-1.5">{formatarMoeda(resumo?.independencia || 0)}</p>
            </div>
            <div className="sm:text-right">
              <span className={kpiLabel}>Patrimônio IF projetado</span>
              <p className="text-[20px] font-bold tracking-tight leading-none mt-1.5" style={{ color: 'var(--primary)' }}>{formatarMoeda(patrimonioProjetado)}</p>
            </div>
            {faixaAplicada && (
              <div className="w-full sm:w-auto sm:ml-auto order-last">
                <Badge variant="primary" size="sm">Tese: {faixaAplicada.estrategias_base?.nome || 'Estratégia Base'} • Faixa: {faixaAplicada.nome}</Badge>
              </div>
            )}
          </div>

          {/* Resumo por classe — mesclado do antigo passo isolado "Rebate por Classes" */}
          <div className="bg-surface rounded-xl border border-subtle overflow-hidden shadow-sm"><table className="w-full text-left"><thead><tr className="bg-surface-2 border-b border-subtle"><th className="px-5 py-3 text-[11px] font-semibold uppercase text-faint tracking-wider">Classe</th><th className="px-5 py-3 text-[11px] font-semibold uppercase text-faint tracking-wider text-right">Saldo</th><th className="px-5 py-3 text-[11px] font-semibold uppercase text-faint tracking-wider text-center">% Alvo</th><th className="px-5 py-3 text-[11px] font-semibold uppercase text-faint tracking-wider text-right">Aporte</th></tr></thead><tbody className="divide-y divide-subtle">{rebateClasses.map((c, i) => (<tr key={i}><td className="px-5 py-3 font-semibold text-main text-[12px]">{c.classe}</td><td className="px-5 py-3 text-right font-semibold text-muted text-[12px]">{formatarMoeda(c.saldo_atual)}</td><td className="px-5 py-3 text-center font-semibold text-faint text-[11px]">{c.alvo_perc}%</td><td className="px-5 py-3 text-right font-semibold text-[13px]" style={{ color: 'var(--primary)' }}>{formatarMoeda(c.aporte_sugerido)}</td></tr>))}</tbody></table></div>

          <div className="space-y-4">
            {distribuicaoAtivos.map((classe, cIdx) => {
              const isClasseSkip = classe.valor_aporte_classe <= 0.01;
              return (
                <Accordion key={cIdx} title={classe.classe} subtitle={isClasseSkip ? 'Categoria ignorada — valor redistribuído' : `${classe.ativos.filter((a: any) => a.acao === 'COMPRAR').length} ativos em compra • Fundo: ${formatarMoeda(classe.valor_aporte_classe)}`} defaultOpen={!isClasseSkip}>
                  <div className="mt-4"><table className="w-full text-left table-fixed">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[8%]" />
                      <col className="w-[8%]" />
                      <col className="w-[10%]" />
                      <col className="w-[14%]" />
                      <col className="w-[7%]" />
                      <col className="w-[16%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead><tr className="bg-surface-2 border-b border-subtle"><th className="py-3 px-2 sm:px-3 text-[11px] font-semibold text-faint uppercase tracking-wider">Ativo</th><th className="py-3 px-2 sm:px-3 text-[11px] font-semibold text-faint uppercase tracking-wider text-center">Aloc. Atual</th><th className="py-3 px-2 sm:px-3 text-[11px] font-semibold text-faint uppercase tracking-wider text-center">Aloc. Sugerida</th><th className="py-3 px-2 sm:px-3 text-[11px] font-semibold uppercase tracking-wider text-right" style={{ color: 'var(--primary)' }}>Sugerido</th><th className="py-3 px-2 sm:px-3 text-[11px] font-semibold text-faint uppercase tracking-wider text-center" title="Preenchido automaticamente pela cotação quando disponível">Preço Mercado</th><th className="py-3 px-2 sm:px-3 text-[11px] font-semibold text-faint uppercase tracking-wider text-center">Cotas</th><th className="py-3 px-2 sm:px-3 text-[11px] font-semibold uppercase tracking-wider text-center" style={{ color: 'var(--primary)' }}>Aporte Efetivo</th><th className="py-3 px-2 sm:px-3 text-[11px] font-semibold text-faint uppercase tracking-wider text-right">Ação</th></tr></thead>
                    <tbody className="divide-y divide-subtle">
                      {classe.ativos.map((at: any, aIdx: number) => {
                        const isComprando = at.acao === 'COMPRAR';
                        return (
                          <tr key={aIdx} className={`hover:bg-surface-2/50 transition-colors ${!isComprando ? 'opacity-50 grayscale bg-surface-2/30' : ''}`}>
                            <td className="py-3 px-2 sm:px-3"><div className="flex items-center gap-2 min-w-0">{!isComprando && <AlertCircle size={10} className="text-faint shrink-0" />}<div className="min-w-0"><p className="text-[12px] font-semibold text-main truncate">{at.nome}</p><p className="text-[10px] text-muted font-medium mt-0.5 truncate">{at.ticker || at.cnpj || '---'}</p></div></div></td>
                            <td className="py-3 px-2 sm:px-3 text-center text-[11px] font-semibold text-muted">{at.alocacao_atual.toFixed(1)}%</td>
                            <td className="py-3 px-2 sm:px-3 text-center text-[11px] font-semibold text-main rounded-md" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>{at.alocacao_atualizada.toFixed(1)}%</td>
                            <td className="py-3 px-2 sm:px-3 text-right font-semibold text-[12px] whitespace-nowrap" style={{ color: 'var(--primary)' }}>{at.aporte_sugerido > 0.01 ? formatarMoeda(at.aporte_sugerido) : '---'}</td>
                            <td className="py-3 px-1.5 sm:px-2"><PriceInputCell initialValue={at.preco_mercado} onConfirm={v => updateManual(at.id, { preco_mercado: v })} /></td>
                            <td className="py-3 px-2 sm:px-3 text-center"><span className="text-[12px] font-semibold" style={{ color: cotasAtuais(at) > 0 ? 'var(--primary)' : 'var(--text-faint)' }}>{cotasAtuais(at)}</span></td>
                            <td className="py-3 px-1.5 sm:px-2"><PriceInputCell initialValue={manualSettings[at.id]?.aporte_efetivo || 0} onConfirm={v => updateManual(at.id, { aporte_efetivo: v })} /></td>
                            <td className="py-3 px-2 sm:px-3 text-right"><button onClick={() => updateManual(at.id, { status_manual: at.acao !== 'COMPRAR' })} className={`w-full px-2 h-7 rounded-md text-[10px] font-semibold whitespace-nowrap transition-colors border ${isComprando ? 'hover:opacity-80' : 'bg-surface-2 text-muted border-subtle hover:bg-surface-2'}`} style={isComprando ? { backgroundColor: 'rgba(16,185,129,0.12)', color: 'var(--primary)', borderColor: 'rgba(16,185,129,0.25)' } : undefined}>{isComprando ? 'Comprar' : 'Ignorar'}</button></td>
                          </tr>
                        );
                      })}
                    </tbody></table></div></Accordion>
              );
            })}
          </div>
            </div>
          </SectionShell>
        </div>
      </div>
    </div>
  );
};

// Casca de seção da página única: número + título calmo (sem uppercase/tracking-widest) + estado
// desabilitado (dim/sem interação) até o pré-requisito existir. `numero` replica o motivo da SecaoNav
// para reforçar a sequência. `hideOnPrint` esconde a seção ao imprimir — só a Revisão é impressa.
const SectionShell = ({ id, numero, titulo, descricao, disabled = false, hint, hideOnPrint = false, children }: { id: string; numero?: number; titulo: string; descricao?: string; disabled?: boolean; hint?: string; hideOnPrint?: boolean; children: React.ReactNode }) => (
  <section id={id} className={`scroll-mt-24 ${hideOnPrint ? 'print:hidden' : ''}`}>
    <div className="flex items-center gap-2.5 mb-4">
      {numero != null && <span className="h-6 w-6 shrink-0 rounded-md bg-surface-2 text-faint flex items-center justify-center text-[11px] font-bold">{numero}</span>}
      <div className="min-w-0">
        <h3 className={sectionTitleCls}>{titulo}</h3>
        {descricao && <p className="text-[12px] text-muted mt-0.5">{descricao}</p>}
      </div>
    </div>
    <div className={disabled ? 'opacity-40 pointer-events-none select-none' : ''}>{children}</div>
    {disabled && hint && (
      <div className="mt-3 text-[11px] font-semibold text-faint flex items-center gap-1.5"><AlertCircle size={12} /> {hint}</div>
    )}
  </section>
);

// Localiza o ancestral scrollável (o <main> do layout tem overflow-y-auto).
const findScrollParent = (el: HTMLElement | null): HTMLElement | null => {
  let p = el?.parentElement || null;
  while (p && p !== document.body) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return null;
};

// Navegação entre seções com scroll-spy. 'lateral' = sticky no desktop; 'mobile' = barra horizontal.
// Usa um listener de scroll (não IntersectionObserver, que não acompanha de forma confiável o
// contêiner aninhado overflow-y-auto deste layout) para destacar a seção atual. Carrega também o
// botão "Gerar Relatório" — junto ao menu de etapas em vez de uma faixa fixa no rodapé.
const SecaoNav = ({ secoes, enabledMap, variante, podeFinalizar, onGerarRelatorio }: { secoes: { id: string; label: string }[]; enabledMap: Record<string, boolean>; variante: 'lateral' | 'mobile'; podeFinalizar: boolean; onGerarRelatorio: () => void }) => {
  const [active, setActive] = useState(secoes[0].id);
  useEffect(() => {
    const container = findScrollParent(document.getElementById(secoes[0].id));
    const target: HTMLElement | Window = container || window;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const refTop = (container ? container.getBoundingClientRect().top : 0) + 140;
      let current = secoes[0].id;
      for (const s of secoes) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= refTop) current = s.id;
      }
      setActive(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute); };
    compute();
    target.addEventListener('scroll', onScroll, { passive: true } as any);
    window.addEventListener('resize', onScroll);
    return () => { target.removeEventListener('scroll', onScroll as any); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [secoes]);

  // Rola o contêiner scrollável até a seção — scrollIntoView não move esse contêiner aninhado de
  // forma confiável, então calculamos o offset e usamos scrollTo.
  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const p = findScrollParent(el);
    if (p) {
      const top = el.getBoundingClientRect().top - p.getBoundingClientRect().top + p.scrollTop - 16;
      p.scrollTo({ top, behavior: 'smooth' });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (variante === 'mobile') {
    return (
      <div className="lg:hidden print:hidden flex items-center gap-2 pb-3 mb-2">
        <nav className="flex gap-2 overflow-x-auto flex-1 min-w-0 -mx-2 px-2">
          {secoes.map((s, i) => {
            const en = enabledMap[s.id]; const isActive = active === s.id;
            return (
              <button key={s.id} type="button" disabled={!en} onClick={() => en && go(s.id)}
                className={`shrink-0 px-3 h-8 rounded-full text-[11px] font-semibold transition-colors border ${isActive ? 'bg-[color:var(--primary)] text-[#0b0e14] border-transparent' : en ? 'bg-surface-2 text-muted border-subtle' : 'bg-surface-2 text-faint/50 border-subtle cursor-not-allowed'}`}>
                {i + 1}. {s.label}
              </button>
            );
          })}
        </nav>
        <button type="button" onClick={onGerarRelatorio} disabled={!podeFinalizar}
          title={!podeFinalizar ? 'Preencha capital, estratégia e ao menos um aporte/alocação' : undefined}
          className="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-semibold bg-[color:var(--primary)] text-[#0b0e14] hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          Relatório <FileText size={13} />
        </button>
      </div>
    );
  }

  return (
    <nav className="hidden lg:flex print:hidden flex-col gap-1 sticky top-4 self-start">
      {secoes.map((s, i) => {
        const en = enabledMap[s.id]; const isActive = active === s.id;
        return (
          <button key={s.id} type="button" disabled={!en} onClick={() => en && go(s.id)}
            className={`text-left px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors flex items-center gap-2.5 ${isActive ? 'bg-[color:var(--primary-soft)] text-[color:var(--primary)]' : en ? 'text-muted hover:bg-surface-2' : 'text-faint/40 cursor-not-allowed'}`}>
            <span className={`h-5 w-5 shrink-0 rounded-md flex items-center justify-center text-[10px] font-bold ${isActive ? 'bg-[color:var(--primary)] text-[#0b0e14]' : 'bg-surface-2 text-faint'}`}>{i + 1}</span>
            {s.label}
          </button>
        );
      })}
      <div className="mt-3 pt-3 border-t border-subtle">
        <button type="button" onClick={onGerarRelatorio} disabled={!podeFinalizar}
          className="w-full flex items-center justify-center gap-2 px-3 h-9 rounded-lg text-[12px] font-semibold bg-[color:var(--primary)] text-[#0b0e14] hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          Gerar Relatório <FileText size={14} />
        </button>
        {!podeFinalizar && <p className="mt-2 text-[10px] font-semibold text-faint leading-snug">Preencha capital, estratégia e ao menos um aporte/alocação</p>}
      </div>
    </nav>
  );
};

const SelectorAtivo = ({ onSelect, placeholder, ativos }: any) => {
  const [inp, setInp] = useState(''); const [show, setShow] = useState(false);
  const fil = (ativos || []).filter((a: any) => a.nome?.toLowerCase().includes(inp.toLowerCase()));
  return (<div className="relative"><div className="relative group"><input type="text" placeholder={placeholder} value={inp} onChange={e => { setInp(e.target.value); setShow(true); }} onFocus={() => setShow(true)} className="w-full h-10 pl-10 pr-4 bg-surface-2 border border-subtle rounded-lg text-[12px] font-semibold text-main outline-none focus:bg-surface focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[rgba(16,185,129,0.2)] transition-all shadow-sm" /><Search size={14} className="absolute left-4 top-3 text-faint" /><button type="button" disabled={!inp} onClick={() => { onSelect(inp); setInp(''); setShow(false); }} className="absolute right-2 top-2 h-6 w-6 flex items-center justify-center bg-[color:var(--primary)] text-[#0b0e14] rounded-md hover:opacity-90 disabled:opacity-20 transition-all"><Plus size={12} /></button></div>{show && inp && (<div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-subtle rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">{fil.map((a: any) => (<button key={a.id} type="button" onClick={() => { onSelect(a.id); setInp(''); setShow(false); }} className="w-full p-3 text-left text-[12px] font-semibold text-main hover:bg-surface-2 flex justify-between items-center transition-colors">{a.nome}</button>))}</div>)}{show && <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />}</div>);
};

export default RebalanceamentoInvestimentos;
