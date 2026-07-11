
import React, { useState, useEffect, useMemo } from 'react';
import { investimentoService } from '../../services/investimentoService';
import { configService } from '../../services/configuracoesService';
import { carteiraRecomendadaService } from '../../services/carteiraRecomendadaService';
import { cambioService, MOEDAS_SUPORTADAS, MoedaCodigo } from '../../services/cambioService';
import { formatarMoeda, formatarCNPJ } from '../../utils/formatadores';
import Modal from '../Modal';
import SidePanel from '../UI/SidePanel';
import Badge from '../UI/Badge';
import Accordion from '../UI/Accordion';
import ImportacaoAtivos from './ImportacaoAtivos';
import { Edit3, Trash2, ArrowUpRight, ArrowDownRight, Filter, FileSpreadsheet, Plus, ChevronRight, Target, ShieldCheck, PieChart, AlertCircle, Info, CheckCircle2, XCircle, MinusCircle, Bird } from 'lucide-react';
import { DESTINOS_VENDA } from '../../utils/destinosVenda';

const CarteiraInvestimentos = ({ clienteId, cliente, ativos, onRefresh }: any) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImport, setModalImport] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filtroDesvio, setFiltroDesvio] = useState(false);
  const [filtroForaTese, setFiltroForaTese] = useState(false);
  const [filtroObjetivo, setFiltroObjetivo] = useState('todos');
  const [classesNormalizadas, setClassesNormalizadas] = useState<string[]>([]);
  const [projetosCliente, setProjetosCliente] = useState<any[]>([]);
  const [carteiraRec, setCarteiraRec] = useState<any[]>([]);
  const [teses, setTeses] = useState<any[]>([]);
  // Cotação da moeda estrangeira selecionada no form de ativo (busca automática — ver useEffect abaixo)
  const [cotacaoInfo, setCotacaoInfo] = useState<{ moeda: MoedaCodigo; valor: number } | null>(null);
  const [buscandoCotacao, setBuscandoCotacao] = useState(false);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [modelos, projetos, rec, teseData] = await Promise.all([
          configService.getAssetAllocations(),
          investimentoService.getProjetos(clienteId),
          carteiraRecomendadaService.listarAtivos(),
          configService.getEstrategias()
        ]);
        const classesRaw = modelos.flatMap(m => m.classes?.map((c: any) => c.nome) || []);
        const unique = Array.from(new Set(classesRaw)).filter(Boolean).sort();
        setClassesNormalizadas(unique.length > 0 ? unique.map(c => String(c)) : ['Renda Fixa', 'Ações', 'FIIs', 'Internacional']);
        setProjetosCliente(projetos || []);
        setCarteiraRec(rec || []);
        setTeses(teseData || []);
      } catch (err) { console.error(err); }
    };
    fetchMetadata();
  }, [clienteId]);

  // Busca automática da cotação quando o ativo em edição é declarado em moeda estrangeira —
  // mesmo padrão de "consulta silenciosa" do cotacaoService/selicService: nunca bloqueia o form,
  // só preenche o valor convertido quando a cotação chega.
  useEffect(() => {
    const moeda = editing?.moeda_origem as string | undefined;
    if (!modalOpen || !moeda || moeda === 'BRL') { setCotacaoInfo(null); return; }
    let cancelado = false;
    setBuscandoCotacao(true);
    const moedaCod = moeda as MoedaCodigo;
    cambioService.getCotacao(moedaCod)
      .then(valor => { if (!cancelado) setCotacaoInfo({ moeda: moedaCod, valor }); })
      .finally(() => { if (!cancelado) setBuscandoCotacao(false); });
    return () => { cancelado = true; };
  }, [modalOpen, editing?.moeda_origem]);

  // Reaplica a conversão quando a cotação chega ou quando o usuário altera o valor na moeda
  // de origem — o "Saldo atual líquido (R$)" segue editável manualmente por cima disso.
  const aplicarConversao = (valorOriginal: number, cotacao: number) => {
    setEditing((prev: any) => ({
      ...prev,
      valor_original: valorOriginal,
      valor_atual: Math.round(valorOriginal * cotacao * 100) / 100,
      cotacao_conversao: cotacao,
    }));
  };

  // Se o usuário já tinha digitado o valor na moeda de origem antes da cotação chegar, converte
  // assim que ela ficar disponível (sem exigir uma segunda interação).
  useEffect(() => {
    if (!cotacaoInfo || cotacaoInfo.moeda !== editing?.moeda_origem) return;
    if (!editing?.valor_original) return;
    aplicarConversao(Number(editing.valor_original), cotacaoInfo.valor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotacaoInfo]);

  const stats = useMemo(() => {
    const totalCustodia = ativos.reduce((acc: number, cur: any) => acc + (cur.valor_atual || 0), 0);
    const patrimonioIndependencia = ativos.reduce((acc: number, a: any) => {
      const linkIndep = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'independencia');
      const perc = linkIndep ? (linkIndep.percentual / 100) : 0;
      return acc + (a.valor_atual * perc);
    }, 0);

    const teseCliente = teses.find(t => t.id === cliente?.tese_investimento_id);
    const faixas = teseCliente?.faixas || [];
    const faixaAtual = faixas.find((f: any) => patrimonioIndependencia >= f.intervalo_minimo && (f.intervalo_maximo === null || patrimonioIndependencia < f.intervalo_maximo));
    const proximaFaixa = faixas.find((f: any) => f.intervalo_minimo > patrimonioIndependencia);
    const dentroToleranciaUpgrade = proximaFaixa ? ((proximaFaixa.intervalo_minimo - patrimonioIndependencia) / proximaFaixa.intervalo_minimo) <= 0.05 : false;

    const totaisPorClasseIndep = ativos.reduce((acc: any, cur: any) => {
      const linkIndep = (cur.distribuicao_objetivos || []).find((o: any) => o.tipo === 'independencia');
      if (linkIndep && linkIndep.percentual > 0) {
        const classe = cur.tipo_ativo || 'OUTROS';
        const valorIndep = cur.valor_atual * (linkIndep.percentual / 100);
        acc[classe] = (acc[classe] || 0) + valorIndep;
      }
      return acc;
    }, {});

    const ativosProcessados = ativos.map((a: any) => {
      const linkIndep = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'independencia');
      const temIndependencia = linkIndep && linkIndep.percentual > 0;
      const totalClasseIndep = totaisPorClasseIndep[a.tipo_ativo || 'OUTROS'] || 0;
      const valorParaIndep = temIndependencia ? (a.valor_atual * (linkIndep.percentual / 100)) : 0;
      const pesoNaClasse = (totalClasseIndep > 0 && temIndependencia) ? (valorParaIndep / totalClasseIndep) * 100 : 0;

      const matchesRec = carteiraRec.filter(r => (r.ticker && a.ticker && r.ticker === a.ticker) || (r.cnpj && a.cnpj && r.cnpj === a.cnpj) || (r.nome_ativo === a.nome));
      let statusControle = 'Não recomendado';
      let metaAlvo = 0;
      let desvio = 0;

      if (matchesRec.length > 0) {
        const naTese = matchesRec.filter(r => r.estrategia_id === cliente?.tese_investimento_id);
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

    const desviosCriticos = ativosProcessados.filter((a: any) => a.temIndependencia && Math.abs(a.desvio) > 5).length;
    return { totalCustodia, patrimonioIndependencia, ativosProcessados, desviosCriticos };
  }, [ativos, carteiraRec, teses, cliente]);

  const ativosExibidos = stats.ativosProcessados
    .filter((a: any) => !filtroDesvio || (a.temIndependencia && Math.abs(a.desvio) > 2))
    .filter((a: any) => !filtroForaTese || a.statusControle === 'Não recomendado' || a.statusControle === 'Fora da faixa');

  const ativosFiltrados = useMemo(() => {
    if (filtroObjetivo === 'todos') return ativosExibidos;

    return ativosExibidos.map((a: any) => {
      const dist = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === filtroObjetivo);
      if (!dist || dist.percentual <= 0) return null;
      return {
        ...a,
        valor_atual: a.valor_atual * (dist.percentual / 100),
      };
    }).filter(Boolean);
  }, [ativosExibidos, filtroObjetivo]);

  const ativosPorClasse = useMemo(() => {
    const grupos: Record<string, any[]> = {};
    ativosFiltrados.forEach((a: any) => {
      const classe = a.tipo_ativo || 'OUTROS';
      if (!grupos[classe]) grupos[classe] = [];
      grupos[classe].push(a);
    });
    Object.values(grupos).forEach(lista => lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR')));
    return grupos;
  }, [ativosFiltrados]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalPerc = (editing.distribuicao_objetivos || []).reduce((acc: number, cur: any) => acc + Number(cur.percentual), 0);
    if (Math.abs(totalPerc - 100) > 0.1) return alert("A soma das distribuições por objetivo deve ser exatamente 100%.");

    // aporte_periodo é transiente (não é coluna de ativos) — declarado pelo consultor só para
    // alimentar o histórico mensal de patrimônio/rentabilidade deste ativo especificamente.
    const { pesoNaClasse, desvio, temIndependencia, statusControle, metaAlvo, aporte_periodo, ...payloadParaBanco } = editing;
    const aporteRealizado = Number(aporte_periodo) || 0;
    try {
      await investimentoService.salvarAtivo({ ...payloadParaBanco, cliente_id: clienteId });
      // Atualiza o snapshot mensal do patrimônio (upsert mensal) — o aporte declarado neste ativo
      // acumula com o de outras edições do mesmo mês, sem depender de uma edição única.
      await investimentoService.snapshotPatrimonioIndependencia(clienteId, aporteRealizado).catch(() => {});
      setModalOpen(false);
      onRefresh();
    } catch (err) { alert("Falha ao sincronizar dados."); }
  };

  const addObjetivoRow = () => {
    const d = [...(editing.distribuicao_objetivos || [])];
    d.push({ tipo: 'independencia', percentual: 0 });
    setEditing({ ...editing, distribuicao_objetivos: d });
  };

  const updateObjetivoRow = (idx: number, field: string, val: any) => {
    const d = [...(editing.distribuicao_objetivos || [])];
    d[idx] = { ...d[idx], [field]: val };
    setEditing({ ...editing, distribuicao_objetivos: d });
  };

  const removeObjetivoRow = (idx: number) => {
    const d = editing.distribuicao_objetivos.filter((_: any, i: number) => i !== idx);
    setEditing({ ...editing, distribuicao_objetivos: d });
  };

  const fLabel = "block text-[11px] font-semibold text-muted mb-1.5";
  const fInput = "w-full px-3 h-9 bg-surface-2 border border-subtle rounded-lg font-semibold text-[13px] text-main outline-none focus:border-primary transition-colors";
  const fSection = "text-[11px] font-semibold text-faint uppercase tracking-wider";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 bg-surface py-2.5 px-4 rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex-wrap">
        {/* Indicadores */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-faint uppercase tracking-wider mb-0.5">Independência</span>
            <p className="text-[14px] font-bold text-main tracking-tight leading-none">{formatarMoeda(stats.patrimonioIndependencia)}</p>
          </div>
          <div className="flex flex-col border-l border-subtle pl-4">
            <span className="text-[11px] font-semibold text-faint uppercase tracking-wider mb-0.5">Custódia Total</span>
            <p className="text-[14px] font-bold text-muted tracking-tight leading-none">{formatarMoeda(stats.totalCustodia)}</p>
          </div>
        </div>

        {/* Separador flexível */}
        <div className="flex-1" />

        {/* Filtros e Ações */}
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-2 p-1 rounded-lg">
            {['todos', 'reserva', 'projeto', 'independencia'].map(obj => (
              <button
                key={obj}
                onClick={() => setFiltroObjetivo(obj)}
                className={`px-2.5 h-7 flex items-center justify-center rounded-md text-[11px] font-semibold transition-all ${filtroObjetivo === obj ? 'bg-surface text-[color:var(--primary)] shadow-sm' : 'text-faint hover:text-muted'}`}
              >
                {obj === 'todos' ? 'Todos' : obj === 'independencia' ? 'Indep.' : obj}
              </button>
            ))}
          </div>
          <button onClick={() => setFiltroDesvio(!filtroDesvio)} title="Filtrar por desvio de meta" className={`h-9 w-9 flex items-center justify-center rounded-lg border ${filtroDesvio ? 'bg-[color:var(--primary)] text-[#0b0e14] border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'bg-surface-2 text-faint border-subtle hover:bg-surface-2'}`}><Filter size={15} /></button>
          <button onClick={() => setFiltroForaTese(!filtroForaTese)} title="Mostrar apenas não recomendados / fora da faixa" className={`h-9 w-9 flex items-center justify-center rounded-lg border ${filtroForaTese ? 'text-white border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'bg-surface-2 text-faint border-subtle hover:bg-surface-2'}`} style={filtroForaTese ? { backgroundColor: 'var(--danger)' } : undefined}><XCircle size={15} /></button>
          <button onClick={() => setModalImport(true)} className="h-9 w-9 flex items-center justify-center bg-surface-2 text-faint hover:text-muted rounded-lg border border-subtle hover:bg-surface-2"><FileSpreadsheet size={15} /></button>
          <button onClick={() => { setEditing({ nome: '', ticker: '', origem: 'bolsa', status: 'Manter', valor_atual: 0, moeda_origem: 'BRL', tipo_ativo: classesNormalizadas[0], distribuicao_objetivos: [{ tipo: 'independencia', percentual: 100 }] }); setModalOpen(true); }} className="h-9 px-3 bg-[color:var(--primary)] text-[#0b0e14] rounded-lg font-semibold text-[12px] flex items-center gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:opacity-90 transition-all"><Plus size={14} /> Ativo</button>
        </div>
      </div>


      <div className="space-y-4">
        {Object.entries(ativosPorClasse).sort().map(([classe, ativosClasse]) => (
          <Accordion
            key={classe}
            title={classe}
            subtitle={`${ativosClasse.length} ativos • ${formatarMoeda(ativosClasse.reduce((acc, a) => acc + a.valor_atual, 0))}`}
            defaultOpen={true}
          >
            <div className="bg-surface rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden mt-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left table-fixed min-w-[760px]">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[16%]" />
                    <col className="w-[13%]" />
                    <col className="w-[12%]" />
                    <col className="w-[11%]" />
                    <col className="w-[14%]" />
                    <col className="w-[8%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-surface-2 border-b border-subtle">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase text-faint tracking-wider">Ativo</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase text-faint tracking-wider text-center">Controle</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase text-faint tracking-wider text-center">Status</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase text-faint tracking-wider text-center">Aloc. Classe</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase text-faint tracking-wider text-center">Desvio Meta</th>
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase text-faint tracking-wider text-right">Saldo {filtroObjetivo !== 'todos' ? 'Objetivo' : 'Total'}</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-subtle text-sm">
                    {ativosClasse.map((a: any) => (
                      <tr key={a.id} className="hover:bg-surface-2/50 transition-colors group">
                        <td className="px-4 py-3"><p className="font-bold text-main uppercase text-[12px] tracking-tight truncate">{a.nome}{a.moeda_origem && a.moeda_origem !== 'BRL' && <span className="ml-1.5 text-[9px] font-semibold text-faint normal-case align-middle">({a.moeda_origem})</span>}</p><span className="text-[10px] font-bold text-[color:var(--info)] uppercase">{a.origem === 'fundo' ? formatarCNPJ(a.cnpj || '') : a.origem === 'previdencia_privada' ? `${formatarCNPJ(a.cnpj || '')} · ${a.tipo_previdencia || 'PREV.'}` : (a.ticker || a.tipo_especifico || 'CUSTÓDIA')}</span></td>
                        <td className="px-4 py-3 text-center"><div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase tracking-wider ${a.statusControle === 'Ok' ? 'text-[color:var(--primary)] bg-[rgba(16,185,129,0.12)] border-[rgba(16,185,129,0.25)]' : a.statusControle === 'Fora da estratégia' ? 'text-[color:var(--danger)] bg-[rgba(248,113,113,0.12)] border-[rgba(248,113,113,0.25)]' : a.statusControle === 'Fora da faixa' ? 'text-[color:var(--warning)] bg-[rgba(251,191,36,0.12)] border-[rgba(251,191,36,0.25)]' : 'bg-surface-2 text-faint border-subtle'}`}>{a.statusControle === 'Ok' ? <CheckCircle2 size={10} /> : a.statusControle === 'Não recomendado' ? <MinusCircle size={10} /> : <XCircle size={10} />}<span className="truncate">{a.statusControle}</span></div></td>
                        <td className="px-4 py-3 text-center"><Badge variant={a.status === 'Vender' ? 'danger' : 'success'} size="sm">{a.status === 'Vender' ? `Vender → ${DESTINOS_VENDA.find(d => d.key === a.destino_venda)?.label || 'Livre'}` : 'Manter'}</Badge></td>
                        <td className="px-4 py-3 text-center"><span className={`text-[12px] font-bold tracking-tight ${a.temIndependencia ? 'text-main' : 'text-faint'}`}>{a.pesoNaClasse.toFixed(1)}%</span></td>
                        <td className="px-4 py-3 text-center">{a.temIndependencia && a.metaAlvo > 0 ? (<div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${Math.abs(a.desvio) <= 2 ? 'bg-surface-2 text-faint border-subtle' : a.desvio > 2 ? 'text-[color:var(--danger)] bg-[rgba(248,113,113,0.12)] border-[rgba(248,113,113,0.25)]' : 'text-[color:var(--primary)] bg-[rgba(16,185,129,0.12)] border-[rgba(16,185,129,0.25)]'}`}>{a.desvio > 2 ? <ArrowUpRight size={10} /> : a.desvio < -2 ? <ArrowDownRight size={10} /> : null}<span className="text-[10px] font-bold uppercase tracking-wider">{Math.abs(a.desvio) <= 2 ? 'OK' : `${a.desvio > 0 ? '+' : ''}${a.desvio.toFixed(1)}%`}</span></div>) : (<div className="h-0.5 w-3 bg-surface-3 rounded-full mx-auto" />)}</td>
                        <td className="px-4 py-3 text-right font-bold text-main tracking-tighter text-[13px]">{formatarMoeda(a.valor_atual)}</td>
                        <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => { setEditing(a); setModalOpen(true); }} className="p-1.5 text-faint hover:text-[color:var(--info)] rounded-lg transition-colors"><Edit3 size={14} /></button><button onClick={() => { if (window.confirm('Excluir ativo?')) { investimentoService.deletarAtivo(a.id).then(onRefresh); } }} className="p-1.5 text-faint hover:text-[color:var(--danger)] rounded-lg transition-colors"><Trash2 size={14} /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Accordion>
        ))}
      </div>

      <SidePanel
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Parâmetros da Posição"
        subtitle="Cadastro e distribuição do ativo"
        widthClass="max-w-lg"
        footer={
          <div className="flex gap-3">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors">Descartar</button>
            <button type="submit" form="form-ativo" className="flex-[2] h-9 bg-[color:var(--primary)] text-[#0b0e14] font-semibold text-[12px] rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
              Confirmar ativo <CheckCircle2 size={14} />
            </button>
          </div>
        }
      >
        <form id="form-ativo" onSubmit={handleSave} className="space-y-6">
          {/* ── Dados do ativo ── */}
          <section className="space-y-4">
            <h4 className={fSection}>Dados do ativo</h4>
            <div>
              <label className={fLabel}>Nome comercial</label>
              <input type="text" required value={editing?.nome || ''} onChange={e => setEditing({ ...editing, nome: e.target.value })} className={fInput} placeholder="Ex: Itaú Unibanco PN" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={fLabel}>Status estratégico</label>
                <select
                  value={editing?.status || 'Manter'}
                  onChange={e => setEditing({ ...editing, status: e.target.value, destino_venda: e.target.value === 'Manter' ? null : editing?.destino_venda })}
                  className={fInput}
                >
                  <option value="Manter">Manter em carteira</option>
                  <option value="Vender">Sinalizar venda</option>
                </select>
              </div>
              <div>
                <label className={fLabel}>Classe de ativo</label>
                <select value={editing?.tipo_ativo || ''} onChange={e => setEditing({ ...editing, tipo_ativo: e.target.value })} className={fInput}>
                  {classesNormalizadas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {editing?.status === 'Vender' && (
              <div>
                <label className={fLabel}>Destino do produto da venda</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {DESTINOS_VENDA.map(d => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => setEditing({ ...editing, destino_venda: d.key })}
                      className={`px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider transition-colors ${(editing?.destino_venda || 'livre') === d.key ? d.color : 'bg-surface-2 text-faint border-subtle hover:border-strong'}`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-faint mt-1.5">Usado para pré-preencher a etapa de Desinvestimento no Aporte Mensal — "Livre" entra como capital adicional sem destino fixo.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={fLabel}>Origem</label>
                <select value={editing?.origem || 'bolsa'} onChange={e => setEditing({ ...editing, origem: e.target.value, ticker: '', cnpj: '', tipo_especifico: '', tipo_previdencia: '', regime_tributario: '' })} className={fInput}>
                  <option value="bolsa">Bolsa (Ticker)</option>
                  <option value="fundo">Fundo (CNPJ)</option>
                  <option value="bancario">Bancário (Título)</option>
                  <option value="previdencia_privada">Previdência Privada (CNPJ)</option>
                </select>
              </div>
              <div>
                {editing?.origem === 'bolsa' && <><label className={fLabel}>Ticker</label><input type="text" value={editing?.ticker || ''} onChange={e => setEditing({ ...editing, ticker: e.target.value.toUpperCase() })} className={fInput} /></>}
                {editing?.origem === 'fundo' && <><label className={fLabel}>CNPJ</label><input type="text" value={editing?.cnpj || ''} onChange={e => setEditing({ ...editing, cnpj: formatarCNPJ(e.target.value) })} className={fInput} /></>}
                {editing?.origem === 'bancario' && <><label className={fLabel}>Tipo</label><select value={editing?.tipo_especifico || ''} onChange={e => setEditing({ ...editing, tipo_especifico: e.target.value })} className={fInput}><option value="">Selecione...</option><option value="CDB">CDB</option><option value="Tesouro">Tesouro Direto</option><option value="Poupança">Poupança</option><option value="LCI/LCA">LCI/LCA</option><option value="Outros">Outros</option></select></>}
                {editing?.origem === 'previdencia_privada' && <><label className={fLabel}>CNPJ</label><input type="text" value={editing?.cnpj || ''} onChange={e => setEditing({ ...editing, cnpj: formatarCNPJ(e.target.value) })} className={fInput} /></>}
              </div>
            </div>
            {editing?.origem === 'previdencia_privada' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={fLabel}>Tipo</label>
                  <select value={editing?.tipo_previdencia || ''} onChange={e => setEditing({ ...editing, tipo_previdencia: e.target.value })} className={fInput}>
                    <option value="">Selecione...</option>
                    <option value="PGBL">PGBL</option>
                    <option value="VGBL">VGBL</option>
                  </select>
                </div>
                <div>
                  <label className={fLabel}>Tributação</label>
                  <select value={editing?.regime_tributario || ''} onChange={e => setEditing({ ...editing, regime_tributario: e.target.value })} className={fInput}>
                    <option value="">Selecione...</option>
                    <option value="regressiva">Regressiva</option>
                    <option value="progressiva">Progressiva</option>
                  </select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={fLabel}>Moeda de origem</label>
                <select
                  value={editing?.moeda_origem || 'BRL'}
                  onChange={e => {
                    const moeda = e.target.value;
                    if (moeda === 'BRL') { setEditing({ ...editing, moeda_origem: 'BRL', valor_original: null, cotacao_conversao: null }); }
                    else setEditing({ ...editing, moeda_origem: moeda });
                  }}
                  className={fInput}
                >
                  <option value="BRL">Real (BRL)</option>
                  {MOEDAS_SUPORTADAS.map(m => <option key={m.codigo} value={m.codigo}>{m.nome} ({m.codigo})</option>)}
                </select>
              </div>
              {editing?.moeda_origem && editing.moeda_origem !== 'BRL' && (
                <div>
                  <label className={fLabel}>Valor na moeda de origem</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editing?.valor_original ?? ''}
                    onChange={e => {
                      const valor = parseFloat(e.target.value) || 0;
                      if (cotacaoInfo && cotacaoInfo.moeda === editing.moeda_origem) aplicarConversao(valor, cotacaoInfo.valor);
                      else setEditing({ ...editing, valor_original: valor });
                    }}
                    className={fInput}
                  />
                </div>
              )}
            </div>
            {editing?.moeda_origem && editing.moeda_origem !== 'BRL' && (
              <p className="text-[10px] text-faint -mt-1">
                {buscandoCotacao && !cotacaoInfo ? 'Buscando cotação...' : cotacaoInfo && cotacaoInfo.moeda === editing.moeda_origem
                  ? `1 ${cotacaoInfo.moeda} = ${formatarMoeda(cotacaoInfo.valor)} · conversão aplicada automaticamente ao saldo abaixo (pode ajustar manualmente)`
                  : 'Cotação indisponível — informe o saldo em reais manualmente.'}
              </p>
            )}
            <div>
              <label className={fLabel}>Saldo atual líquido (R$)</label>
              <input type="number" step="0.01" required value={editing?.valor_atual || ''} onChange={e => setEditing({ ...editing, valor_atual: parseFloat(e.target.value) || 0 })} className={fInput} />
            </div>
            <div>
              <label className={fLabel}>Aporte ou retirada neste ativo este mês (opcional)</label>
              <input
                type="number"
                step="0.01"
                value={editing?.aporte_periodo ?? ''}
                onChange={e => setEditing({ ...editing, aporte_periodo: e.target.value })}
                className={fInput}
                placeholder="0,00"
              />
              <p className="text-[10px] text-faint mt-1.5">
                Se parte da mudança de saldo veio de dinheiro que você colocou ou tirou (não de valorização/desvalorização de mercado), informe aqui — evita que a rentabilidade da carteira confunda aporte com retorno. Use negativo para retirada.
              </p>
            </div>
          </section>

          {/* ── Distribuição por objetivo ── */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <h4 className={fSection}>Distribuição por objetivo</h4>
              <button type="button" onClick={addObjetivoRow} className="flex items-center gap-1 text-[12px] font-semibold text-[color:var(--primary)] hover:underline">
                <Plus size={13} /> Adicionar destino
              </button>
            </div>
            <p className="text-[10px] text-faint mb-3">Defina para onde o saldo deste ativo aponta — a soma das participações deve ser 100%.</p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {(editing?.distribuicao_objetivos || []).map((obj: any, idx: number) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center bg-surface-2 border border-subtle rounded-lg p-2">
                  <select value={obj.tipo} onChange={e => updateObjetivoRow(idx, 'tipo', e.target.value)} className="flex-1 w-full bg-surface border border-subtle rounded-lg h-9 px-2.5 text-[12px] font-medium text-main outline-none focus:border-primary transition-colors">
                    <option value="independencia">Independência Financeira</option>
                    <option value="reserva">Reserva de Emergência</option>
                    <option value="projeto">Projeto Específico</option>
                  </select>
                  {obj.tipo === 'projeto' && (
                    <select value={obj.projeto_id || ''} onChange={e => updateObjetivoRow(idx, 'projeto_id', e.target.value)} className="flex-1 w-full bg-surface border border-subtle rounded-lg h-9 px-2.5 text-[12px] font-medium text-main outline-none focus:border-primary transition-colors">
                      <option value="">Qual projeto?</option>
                      {projetosCliente.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  )}
                  <div className="relative w-full sm:w-24 shrink-0">
                    <input type="number" value={obj.percentual} onChange={e => updateObjetivoRow(idx, 'percentual', e.target.value)} className="w-full bg-surface border border-subtle rounded-lg h-9 pl-2.5 pr-6 text-[12px] font-semibold text-main text-center outline-none focus:border-primary transition-colors" />
                    <span className="absolute right-2.5 top-2.5 text-[10px] text-faint font-semibold">%</span>
                  </div>
                  <button type="button" onClick={() => removeObjetivoRow(idx)} className="p-1.5 text-faint hover:text-[color:var(--danger)] rounded-lg transition-colors shrink-0 self-end sm:self-auto"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>

            <div className="pt-3 mt-3 border-t border-subtle flex justify-between items-center">
              <span className="text-[11px] text-faint">Soma das participações</span>
              {(() => {
                const soma = (editing?.distribuicao_objetivos || []).reduce((acc: number, cur: any) => acc + Number(cur.percentual), 0);
                const ok = Math.abs(soma - 100) < 0.1;
                return (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ color: ok ? 'var(--primary)' : 'var(--danger)' }}>
                    <span className="text-[12px] font-semibold">{soma}%</span>
                    {ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  </div>
                );
              })()}
            </div>
          </section>
        </form>
      </SidePanel>

      <Modal isOpen={modalImport} onClose={() => setModalImport(false)} title="Importação Estratégica"><ImportacaoAtivos clienteId={clienteId} onSuccess={() => { setModalImport(false); onRefresh(); }} /></Modal>
    </div>
  );
};

export default CarteiraInvestimentos;
