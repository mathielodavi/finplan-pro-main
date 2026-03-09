
import React, { useState, useEffect, useMemo } from 'react';
import { investimentoService } from '../../services/investimentoService';
import { configService } from '../../services/configuracoesService';
import { carteiraRecomendadaService } from '../../services/carteiraRecomendadaService';
import { formatarMoeda, formatarCNPJ } from '../../utils/formatadores';
import Modal from '../Modal';
import Accordion from '../UI/Accordion';
import ImportacaoAtivos from './ImportacaoAtivos';
import { Edit3, Trash2, ArrowUpRight, ArrowDownRight, Filter, FileSpreadsheet, Plus, ChevronRight, Target, ShieldCheck, PieChart, AlertCircle, Info, CheckCircle2, XCircle, MinusCircle, Bird } from 'lucide-react';

const CarteiraInvestimentos = ({ clienteId, cliente, ativos, onRefresh }: any) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalImport, setModalImport] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filtroDesvio, setFiltroDesvio] = useState(false);
  const [filtroObjetivo, setFiltroObjetivo] = useState('todos');
  const [classesNormalizadas, setClassesNormalizadas] = useState<string[]>([]);
  const [projetosCliente, setProjetosCliente] = useState<any[]>([]);
  const [carteiraRec, setCarteiraRec] = useState<any[]>([]);
  const [teses, setTeses] = useState<any[]>([]);

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

  const ativosExibidos = filtroDesvio ? stats.ativosProcessados.filter((a: any) => a.temIndependencia && Math.abs(a.desvio) > 2) : stats.ativosProcessados;

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
    return grupos;
  }, [ativosFiltrados]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalPerc = (editing.distribuicao_objetivos || []).reduce((acc: number, cur: any) => acc + Number(cur.percentual), 0);
    if (Math.abs(totalPerc - 100) > 0.1) return alert("A soma das distribuições por objetivo deve ser exatamente 100%.");

    const { pesoNaClasse, desvio, temIndependencia, statusControle, metaAlvo, ...payloadParaBanco } = editing;
    try {
      await investimentoService.salvarAtivo({ ...payloadParaBanco, cliente_id: clienteId });
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

  const labelStyle = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1";
  const inputStyle = "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4 bg-white py-3 px-6 rounded-3xl border border-slate-100 shadow-sm flex-wrap">
        {/* Indicadores */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Independência</span>
            <p className="text-sm font-black text-slate-900 leading-none">{formatarMoeda(stats.patrimonioIndependencia)}</p>
          </div>
          <div className="flex flex-col border-l border-slate-100 pl-6">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Custódia Total</span>
            <p className="text-sm font-black text-slate-500 leading-tight">{formatarMoeda(stats.totalCustodia)}</p>
          </div>
        </div>

        {/* Separador flexível */}
        <div className="flex-1" />

        {/* Filtros e Ações */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {['todos', 'reserva', 'projeto', 'independencia'].map(obj => (
              <button
                key={obj}
                onClick={() => setFiltroObjetivo(obj)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filtroObjetivo === obj ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {obj === 'todos' ? 'Todos' : obj === 'independencia' ? 'Indep.' : obj}
              </button>
            ))}
          </div>
          <button onClick={() => setFiltroDesvio(!filtroDesvio)} className={`p-2.5 rounded-xl border ${filtroDesvio ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100'}`}><Filter size={16} /></button>
          <button onClick={() => setModalImport(true)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-100"><FileSpreadsheet size={16} /></button>
          <button onClick={() => { setEditing({ nome: '', ticker: '', origem: 'bolsa', status: 'Manter', valor_atual: 0, tipo_ativo: classesNormalizadas[0], distribuicao_objetivos: [{ tipo: 'independencia', percentual: 100 }] }); setModalOpen(true); }} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-md hover:bg-emerald-700 transition-all"><Plus size={14} /> Ativo</button>
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
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest">Ativo</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Controle</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Aloc. Classe</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-center">Desvio Meta</th>
                      <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 tracking-widest text-right">Saldo {filtroObjetivo !== 'todos' ? 'Objetivo' : 'Total'}</th>
                      <th className="px-6 py-4 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {ativosClasse.map((a: any) => (
                      <tr key={a.id} className="hover:bg-slate-50/30 transition-all group">
                        <td className="px-6 py-4"><p className="font-black text-slate-800 uppercase text-xs tracking-tight">{a.nome}</p><span className="text-[9px] font-bold text-indigo-500 uppercase">{a.origem === 'fundo' ? formatarCNPJ(a.cnpj || '') : (a.ticker || a.tipo_especifico || 'CUSTÓDIA')}</span></td>
                        <td className="px-6 py-4 text-center"><div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] font-black uppercase ${a.statusControle === 'Ok' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : a.statusControle === 'Fora da estratégia' ? 'bg-rose-50 text-rose-600 border-rose-100' : a.statusControle === 'Fora da faixa' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{a.statusControle === 'Ok' ? <CheckCircle2 size={10} /> : a.statusControle === 'Não recomendado' ? <MinusCircle size={10} /> : <XCircle size={10} />}{a.statusControle}</div></td>
                        <td className="px-6 py-4 text-center"><div className="flex flex-col items-center gap-1"><span className={`text-xs font-black ${a.temIndependencia ? 'text-slate-900' : 'text-slate-300'}`}>{a.pesoNaClasse.toFixed(1)}%</span></div></td>
                        <td className="px-6 py-4 text-center">{a.temIndependencia && a.metaAlvo > 0 ? (<div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border ${Math.abs(a.desvio) <= 2 ? 'bg-slate-50 text-slate-400 border-slate-100' : a.desvio > 2 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{a.desvio > 2 ? <ArrowUpRight size={12} /> : a.desvio < -2 ? <ArrowDownRight size={12} /> : null}<span className="text-[9px] font-black uppercase tracking-tighter">{Math.abs(a.desvio) <= 2 ? 'OK' : `${a.desvio > 0 ? '+' : ''}${a.desvio.toFixed(1)}%`}</span></div>) : (<div className="h-1 w-4 bg-slate-100 rounded-full mx-auto" />)}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">{formatarMoeda(a.valor_atual)}</td>
                        <td className="px-6 py-4 text-right"><div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => { setEditing(a); setModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"><Edit3 size={16} /></button><button onClick={() => { if (window.confirm('Excluir ativo?')) { investimentoService.deletarAtivo(a.id); onRefresh(); } }} className="p-2 text-slate-400 hover:text-rose-600 rounded-xl transition-all"><Trash2 size={16} /></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Accordion>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Parâmetros da Posição" size="wide">
        <form onSubmit={handleSave} className="space-y-10">
          <section className="bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="md:col-span-2"><label className={labelStyle}>Nome Comercial do Ativo</label><input type="text" required value={editing?.nome || ''} onChange={e => setEditing({ ...editing, nome: e.target.value })} className={inputStyle} placeholder="Ex: ITAÚ UNIBANCO PN" /></div>
              <div><label className={labelStyle}>Status Estratégico</label><select value={editing?.status || 'Manter'} onChange={e => setEditing({ ...editing, status: e.target.value })} className={inputStyle}><option value="Manter">Manter em Carteira</option><option value="Vender">Sinalizar Venda</option></select></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div><label className={labelStyle}>Origem</label><select value={editing?.origem || 'bolsa'} onChange={e => setEditing({ ...editing, origem: e.target.value, ticker: '', cnpj: '', tipo_especifico: '' })} className={inputStyle}><option value="bolsa">📈 Bolsa (Ticker)</option><option value="fundo">📁 Fundo (CNPJ)</option><option value="bancario">🏦 Bancário (Título)</option></select></div>
              <div className="md:col-span-1">{editing?.origem === 'bolsa' && <><label className={labelStyle}>Ticker</label><input type="text" value={editing?.ticker || ''} onChange={e => setEditing({ ...editing, ticker: e.target.value.toUpperCase() })} className={inputStyle} /></>}{editing?.origem === 'fundo' && <><label className={labelStyle}>CNPJ</label><input type="text" value={editing?.cnpj || ''} onChange={e => setEditing({ ...editing, cnpj: formatarCNPJ(e.target.value) })} className={inputStyle} /></>}{editing?.origem === 'bancario' && <><label className={labelStyle}>Tipo</label><select value={editing?.tipo_especifico || ''} onChange={e => setEditing({ ...editing, tipo_especifico: e.target.value })} className={inputStyle}><option value="">Selecione...</option><option value="CDB">CDB</option><option value="Tesouro">Tesouro Direto</option><option value="Poupança">Poupança</option><option value="LCI/LCA">LCI/LCA</option><option value="Outros">Outros</option></select></>}</div>
              <div><label className={labelStyle}>Classe de Ativo</label><select value={editing?.tipo_ativo || ''} onChange={e => setEditing({ ...editing, tipo_ativo: e.target.value })} className={inputStyle}>{classesNormalizadas.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className={labelStyle}>Saldo Atual Líquido (R$)</label><input type="number" step="0.01" required value={editing?.valor_atual || ''} onChange={e => setEditing({ ...editing, valor_atual: parseFloat(e.target.value) || 0 })} className={`${inputStyle} font-black text-indigo-600`} /></div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-3xl p-8 space-y-8 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-50 pb-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center"><Target size={20} /></div>
                <div><h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">Distribuição por Objetivo</h4><p className="text-[10px] text-slate-400 font-bold uppercase">Defina para onde o saldo deste ativo aponta</p></div>
              </div>
              <button type="button" onClick={addObjetivoRow} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest bg-indigo-50 px-6 py-3 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">+ Adicionar Destino</button>
            </div>

            <div className="space-y-4 max-h-64 overflow-y-auto pr-4 custom-scrollbar">
              {(editing?.distribuicao_objetivos || []).map((obj: any, idx: number) => (
                <div key={idx} className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 p-5 rounded-2xl border border-slate-100 group transition-all hover:border-indigo-200">
                  <div className="flex-1 w-full"><select value={obj.tipo} onChange={e => updateObjetivoRow(idx, 'tipo', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-tight outline-none shadow-sm"><option value="independencia">🕊️ Independência Financeira</option><option value="reserva">🛡️ Reserva de Emergência</option><option value="projeto">🎯 Projeto Específico</option></select></div>
                  {obj.tipo === 'projeto' && (<div className="flex-1 w-full animate-in fade-in"><select value={obj.projeto_id || ''} onChange={e => updateObjetivoRow(idx, 'projeto_id', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-tight outline-none shadow-sm"><option value="">Qual projeto?</option>{projetosCliente.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>)}
                  <div className="relative w-full sm:w-32"><input type="number" value={obj.percentual} onChange={e => updateObjetivoRow(idx, 'percentual', e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-black text-center outline-none shadow-sm" /><span className="absolute right-4 top-3 text-[10px] text-slate-300 font-black">%</span></div>
                  <button type="button" onClick={() => removeObjetivoRow(idx)} className="p-3 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">✕</button>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-slate-50 flex justify-between items-center px-4">
              <div className="flex items-center gap-2"><Info size={14} className="text-slate-300" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Soma das Participações:</span></div>
              <div className={`flex items-center gap-2 px-6 py-2 rounded-xl border ${Math.abs((editing?.distribuicao_objetivos || []).reduce((acc: number, cur: any) => acc + Number(cur.percentual), 0) - 100) < 0.1 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}><span className="text-sm font-black">{(editing?.distribuicao_objetivos || []).reduce((acc: number, cur: any) => acc + Number(cur.percentual), 0)}%</span>{Math.abs((editing?.distribuicao_objetivos || []).reduce((acc: number, cur: any) => acc + Number(cur.percentual), 0) - 100) < 0.1 ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}</div>
            </div>
          </section>

          <div className="flex gap-4 pt-6 border-t border-slate-100">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-5 font-black text-slate-400 uppercase text-xs tracking-widest">Descartar</button>
            <button type="submit" className="flex-1 py-5 font-black text-white uppercase text-xs bg-slate-900 rounded-[1.5rem] shadow-2xl hover:bg-slate-800 transition-all tracking-[0.2em]">Confirmar Ativo</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modalImport} onClose={() => setModalImport(false)} title="Importação Estratégica"><ImportacaoAtivos clienteId={clienteId} onSuccess={() => { setModalImport(false); onRefresh(); }} /></Modal>
    </div>
  );
};

export default CarteiraInvestimentos;
