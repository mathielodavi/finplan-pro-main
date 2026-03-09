
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { formatarMoeda } from '../../utils/formatadores';
import { investimentoService, PremissasIndependencia, HistoricoPatrimonio } from '../../services/investimentoService';
import { Bird, Calculator, TrendingUp, Percent, Save, Activity, CheckCircle2 } from 'lucide-react';

interface IndependenciaProps {
  clienteId: string;
  patrimonioAtual: number;
}

const IndependenciaInvestimentos: React.FC<IndependenciaProps> = ({ clienteId, patrimonioAtual }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snapLoading, setSnapLoading] = useState(false);
  const [historico, setHistorico] = useState<HistoricoPatrimonio[]>([]);

  const [params, setParams] = useState<PremissasIndependencia>({
    cliente_id: clienteId,
    renda_alvo: 10000,
    taxa_real_anual: 6,
    patrimonio_inicial: 0,
    aporte_mensal: 2000,
    prazo_anos: 20,
    data_inicio: new Date().toISOString().split('T')[0]
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [premissasData, historicoData] = await Promise.all([
        investimentoService.getPremissasIndependencia(clienteId),
        investimentoService.getHistoricoMensal(clienteId)
      ]);

      if (premissasData) {
        setParams({
          ...premissasData,
          renda_alvo: Number(premissasData.renda_alvo),
          taxa_real_anual: Number(premissasData.taxa_real_anual),
          patrimonio_inicial: Number(premissasData.patrimonio_inicial),
          aporte_mensal: Number(premissasData.aporte_mensal),
          prazo_anos: Number(premissasData.prazo_anos)
        });
      }
      setHistorico(historicoData || []);
    } catch (err) {
      console.error("Erro ao carregar dados de independência:", err);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSavePremissas = async () => {
    setSaving(true);
    try {
      await investimentoService.salvarPremissasIndependencia(params);
    } catch (err) {
      alert("Erro ao salvar parâmetros.");
    } finally {
      setSaving(false);
    }
  };

  const handleSnapshot = async () => {
    setSnapLoading(true);
    try {
      await investimentoService.registrarSaldoMensal({
        cliente_id: clienteId,
        data: new Date().toISOString(),
        valor_independencia: patrimonioAtual
      });
      loadAll(); // Atualiza gráfico
    } catch (err) {
      alert("Erro ao registrar snapshot mensal.");
    } finally {
      setSnapLoading(false);
    }
  };

  const calc = useMemo(() => {
    const taxaMensal = Math.pow(1 + params.taxa_real_anual / 100, 1 / 12) - 1;
    const patrimonioNecessario = (params.renda_alvo * 12) / (params.taxa_real_anual / 100 || 1);

    const dataInicio = new Date(params.data_inicio);
    const totalMesesPlano = params.prazo_anos * 12;
    const hoje = new Date();

    const chartData = [];

    // FIX: Explicitly typing the Map to ensure 'get' returns 'number | undefined' instead of 'unknown'
    const mapHistorico = new Map<string, number>(
      historico.map(h => [
        new Date(h.data).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase(),
        Number(h.valor_independencia)
      ])
    );

    for (let i = 0; i <= totalMesesPlano; i += 6) {
      const dataPonto = new Date(dataInicio);
      dataPonto.setMonth(dataInicio.getMonth() + i);
      const label = dataPonto.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();

      // 1. Linha Teórica - FIX: Handle taxaMensal = 0 to avoid division by zero
      const valorPlano = params.patrimonio_inicial * Math.pow(1 + taxaMensal, i) +
        (taxaMensal > 0
          ? params.aporte_mensal * ((Math.pow(1 + taxaMensal, i) - 1) / taxaMensal)
          : params.aporte_mensal * i);

      // 2. Linha Real (Pontos históricos + Projeção a partir de Hoje)
      let valorReal: number | null = mapHistorico.get(label) ?? null;

      // Se estamos no futuro (> hoje), projetamos a partir do patrimonioAtual
      if (valorReal === null && dataPonto >= hoje) {
        const mesesForward = (dataPonto.getFullYear() - hoje.getFullYear()) * 12 + (dataPonto.getMonth() - hoje.getMonth());
        // FIX: Handle taxaMensal = 0 for future projections
        valorReal = patrimonioAtual * Math.pow(1 + taxaMensal, mesesForward) +
          (taxaMensal > 0
            ? params.aporte_mensal * ((Math.pow(1 + taxaMensal, mesesForward) - 1) / taxaMensal)
            : params.aporte_mensal * mesesForward);
      }

      chartData.push({
        label,
        plano: Math.round(valorPlano),
        // FIX: Narrow valorReal to 'number' explicitly before passing to Math.round to fix the 'unknown' error
        real: (valorReal !== null && !isNaN(valorReal)) ? Math.round(valorReal) : null,
        target: Math.round(patrimonioNecessario)
      });
    }

    const dataAlvo = new Date(dataInicio);
    dataAlvo.setFullYear(dataInicio.getFullYear() + params.prazo_anos);

    return { patrimonioNecessario, chartData, dataAlvo };
  }, [params, patrimonioAtual, historico]);

  const handleMoeda = (field: keyof PremissasIndependencia, val: string) => {
    const numeric = parseInt(val.replace(/\D/g, "")) / 100;
    setParams(prev => ({ ...prev, [field]: numeric || 0 }));
  };

  if (loading) return (
    <div className="py-24 flex flex-col items-center justify-center gap-6">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      <p className="text-slate-300 font-bold uppercase tracking-widest text-[10px]">Restaurando Planejamento...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* HEADER ESTRATÉGICO */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
            <Bird size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-none">Independência Financeira</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-widest">Estratégia de Acúmulo e Renda Real</p>
          </div>
        </div>

        <div className="flex gap-10 items-center divide-x divide-slate-100">
          <div className="text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Capital de Liberdade</span>
            <p className="text-xl font-black text-slate-900">{formatarMoeda(calc.patrimonioNecessario)}</p>
          </div>
          <div className="pl-10 text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Horizonte Alvo</span>
            <p className="text-xl font-black text-emerald-600">{calc.dataAlvo.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).toUpperCase()}</p>
          </div>
          <div className="pl-6 flex flex-col gap-2">
            <button
              onClick={handleSavePremissas}
              disabled={saving}
              className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50"
              title="Salvar Premissas"
            >
              {saving ? <div className="h-4 w-4 border-2 border-white/20 border-t-white animate-spin rounded-full" /> : <Save size={18} />}
            </button>
            <button
              onClick={handleSnapshot}
              disabled={snapLoading}
              className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100 disabled:opacity-50"
              title="Registrar Saldo do Mês (Snapshot)"
            >
              {snapLoading ? <div className="h-4 w-4 border-2 border-emerald-200 border-t-emerald-600 animate-spin rounded-full" /> : <Activity size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* PAINEL DE CONTROLES SLIM */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-2 md:grid-cols-6 gap-6 items-end">
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Renda Alvo/Mês</label>
          <input type="text" value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(params.renda_alvo)} onChange={e => handleMoeda('renda_alvo', e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs text-slate-700 outline-none" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Capital Inicial</label>
          <input type="text" value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(params.patrimonio_inicial)} onChange={e => handleMoeda('patrimonio_inicial', e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs text-slate-700 outline-none" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Aporte Sugerido</label>
          <input type="text" value={new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(params.aporte_mensal)} onChange={e => handleMoeda('aporte_mensal', e.target.value)} className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl font-black text-xs text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Taxa Real (%)</label>
          <div className="relative">
            <input type="number" step="0.1" value={params.taxa_real_anual} onChange={e => setParams({ ...params, taxa_real_anual: parseFloat(e.target.value) || 0 })} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs text-slate-700 outline-none" />
            <Percent size={10} className="absolute right-4 top-4 text-slate-300" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Prazo (Anos)</label>
          <input type="number" value={params.prazo_anos} onChange={e => setParams({ ...params, prazo_anos: parseInt(e.target.value) || 0 })} className="w-full p-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-black text-xs text-slate-700 outline-none" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Início</label>
          <input type="date" value={params.data_inicio} onChange={e => setParams({ ...params, data_inicio: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl font-black text-[10px] text-slate-400 outline-none" />
        </div>
      </div>

      {/* ÁREA DO GRÁFICO */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-[550px] flex flex-col relative overflow-hidden group">
        <div className="flex justify-between items-center mb-12 relative z-10">
          <div className="flex items-center gap-3">
            <TrendingUp size={20} className="text-emerald-500" />
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Curva de Liberdade Financeira</h4>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-4 rounded-full bg-slate-200" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Planejado</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-4 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">Real + Projetado</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={calc.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fontWeight: 900, fill: '#cbd5e1' }}
                dy={15}
              />
              <YAxis hide domain={[0, 'dataMax + 200000']} />
              <Tooltip
                contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '20px' }}
                formatter={(v: any) => [formatarMoeda(v), 'Patrimônio']}
              />
              <ReferenceLine y={calc.patrimonioNecessario} stroke="#f1f5f9" strokeDasharray="5 5" label={{ position: 'right', value: 'META', fill: '#cbd5e1', fontSize: 10, fontWeight: 900 }} />

              <Line type="monotone" dataKey="plano" stroke="#e2e8f0" strokeWidth={4} dot={false} animationDuration={2000} />
              <Line type="monotone" dataKey="real" stroke="#4f46e5" strokeWidth={6} dot={false} animationDuration={2500} connectNulls={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-10 pt-10 border-t border-slate-50 flex flex-wrap justify-center gap-12">
          <div className="flex items-center gap-3">
            <Calculator size={14} className="text-slate-300" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Saldo Atualmente Vinculado: <span className="text-emerald-600">{formatarMoeda(patrimonioAtual)}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Pontos Históricos: <span className="text-slate-900">{historico.length} snapshots</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndependenciaInvestimentos;
