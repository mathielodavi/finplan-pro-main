
import { supabase } from './supabaseClient';
import { calcularTermometro } from '../utils/termometroUtils';

export const dashboardService = {
  async getSummaryKPIs() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    // Buscamos todos os dados necessários
    const { data: allClientes } = await supabase.from('clientes').select('id, nome, patrimonio_total, status');
    const { data: allContratos } = await supabase.from('contratos').select('*');
    const { data: reunioes } = await supabase.from('reunioes').select('*');

    const clientes = allClientes || [];
    const contratos = allContratos || [];

    // --- REGRAS DE NEGÓCIO ---

    // 1. Identificar clientes que possuem ao menos um contrato de planejamento (Base de Referência)
    const idsComPlanejamento = new Set(
      contratos.filter(c => c.tipo === 'planejamento').map(c => c.cliente_id)
    );

    const clientesBasePlanejamento = clientes.filter(c => idsComPlanejamento.has(c.id));

    // KPI: Base Total (Total de clientes com contrato de planejamento, independente de status)
    const totalClientesPlan = clientesBasePlanejamento.length;

    // KPI: Planejamento Ativo (Total de clientes únicos com contratos de planejamento ativos)
    const clientesComPlanAtivo = new Set(contratos.filter(c => c.tipo === 'planejamento' && c.status === 'ativo').map(c => c.cliente_id));
    const ativosPlanejamentoCount = clientesComPlanAtivo.size;

    // KPI: Churn Rate (Clientes inativos cujo último contrato foi cancelado)
    const clientesEmChurn = clientesBasePlanejamento.filter(c => {
      if (c.status === 'Ativo') return false;

      const cliContratosPlan = contratos
        .filter(cont => cont.cliente_id === c.id && cont.tipo === 'planejamento')
        .sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime());

      if (cliContratosPlan.length === 0) return false;

      const ultimoContrato = cliContratosPlan[0];
      return ultimoContrato.status === 'cancelado';
    });

    const churn = totalClientesPlan > 0 ? (clientesEmChurn.length / totalClientesPlan) * 100 : 0;

    // "Hoje" no fuso de Brasília (Início do dia) para cálculos de reuniões
    const agora = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const hojeStr = formatter.format(agora);
    const hoje = new Date(`${hojeStr}T00:00:00-03:00`);

    // KPI: Fila Check-in (Ignorar inativos e sem planejamento)
    const pendentesReuniao = clientesBasePlanejamento
      .filter(c => c.status === 'Ativo')
      .filter(c => {
        const cliReunioes = reunioes?.filter(r => r.cliente_id === c.id) || [];
        const temFutura = cliReunioes.some(r => r.status === 'agendada' && new Date(r.data_reuniao) >= agora);
        const temRealizada = cliReunioes.some(r => r.status === 'realizada');
        return !temFutura || !temRealizada;
      });

    // --- KPIs FINANCEIROS (Mantidos) ---

    const seisMesesAtras = new Date(hoje);
    seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

    const contratosRecentes = contratos.filter(c => {
      const [y, m, d] = c.data_inicio.split('-').map(Number);
      const dataInicio = new Date(y, m - 1, d, 12, 0, 0);
      return dataInicio >= seisMesesAtras && dataInicio <= hoje;
    });

    const sumValorR = contratosRecentes.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    const sumMesesR = contratosRecentes.reduce((acc, c) => acc + (Number(c.prazo_meses) || 1), 0);
    const ticketMedio6m = sumMesesR > 0 ? sumValorR / sumMesesR : 0;

    const sumValorG = contratos.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    const sumMesesG = contratos.reduce((acc, c) => acc + (Number(c.prazo_meses) || 1), 0);
    const ticketMedioGeral = sumValorG / (sumMesesG || 1);

    const aum = clientes.reduce((acc, c) => acc + (Number(c.patrimonio_total) || 0), 0);

    return {
      totalClientes: totalClientesPlan,
      ativosPlanejamento: ativosPlanejamentoCount,
      churn,
      ticketMedio: ticketMedioGeral,
      ticketMedio6m,
      pendentesReuniao: pendentesReuniao.length,
      aum,
      reunioes: reunioes || [],
      clientes: clientes,
      // Passamos a lista filtrada para o front montar a agenda
      contratosAtivosPlan: clientesBasePlanejamento.filter(c => c.status === 'Ativo')
    };
  },

  async getTermometroStats() {
    const { data: clientesAll } = await supabase.from('clientes').select('id, nome, status');
    const { data: contratos } = await supabase.from('contratos').select('cliente_id, tipo');
    const { data: reunioes, error: re } = await supabase.from('reunioes').select('*').order('data_reuniao', { ascending: false });
    if (re) console.error("ERRO REUNIOES Supabase:", re);

    const stats = { ENGAJADO: 0, RECUPERAR: 0, GHOSTING: 0, 'SEM TERMÔMETRO': 0 };

    // Regra: Ignorar inativos e clientes sem planejamento
    const idsComPlanejamento = new Set(contratos?.filter(c => c.tipo === 'planejamento').map(c => c.cliente_id));
    const clientesFiltrados = (clientesAll || []).filter(c => c.status === 'Ativo' && idsComPlanejamento.has(c.id));

    clientesFiltrados.forEach(cli => {
      const cliReunioes = reunioes?.filter(r => r.cliente_id === cli.id) || [];
      const ultima = cliReunioes.find(r => r.status === 'realizada')?.data_reuniao || null;
      const proxima = cliReunioes.find(r => r.status === 'agendada')?.data_reuniao || null;
      const t = calcularTermometro(ultima, proxima);
      const statusUpper = t.status.toUpperCase();
      stats[statusUpper as keyof typeof stats] = (stats[statusUpper as keyof typeof stats] || 0) + 1;
    });

    return Object.entries(stats).map(([name, value]) => ({ name, value }));
  },

  async getIncomeProjection() {
    const hoje = new Date();
    const projections = [];

    for (let i = 0; i < 6; i++) {
      const targetMonth = hoje.getMonth() + i;
      const targetYear = hoje.getFullYear();

      const lastDayDate = new Date(targetYear, targetMonth + 1, 0);
      const firstDay = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01T00:00:00.000Z`;
      const lastDay = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}T23:59:59.999Z`;

      const { data: parcelas, error } = await supabase
        .from('financeiro_parcelas')
        .select(`
          valor_previsto,
          contratos!inner (tipo, repasse_percentual)
        `)
        .gte('data_vencimento', firstDay)
        .lte('data_vencimento', lastDay)
        .neq('status', 'cancelado')
        .in('contratos.tipo', ['planejamento', 'extra']);

      if (error) console.error("ERRO PARCELAS Supabase:", error);

      let planejamento = 0;
      let extra = 0;
      let total = 0;

      parcelas?.forEach(p => {
        const repasse = (p.contratos as any)?.repasse_percentual || 100;
        const valorLiquido = p.valor_previsto * (repasse / 100);
        total += valorLiquido;
        if ((p.contratos as any).tipo === 'planejamento') {
          planejamento += valorLiquido;
        } else {
          extra += valorLiquido;
        }
      });

      const dateLabel = new Date(targetYear, targetMonth, 1);
      projections.push({
        mes: dateLabel.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).toUpperCase(),
        valor: total,
        planejamento,
        extra
      });
    }

    return projections;
  },

  async getUpcomingExpirations() {
    const agora = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const hojeStr = formatter.format(agora);
    const hoje = new Date(`${hojeStr}T00:00:00-03:00`);

    const { data: contratos } = await supabase
      .from('contratos')
      .select('*, clientes(nome, status)')
      .in('status', ['ativo', 'concluido'])
      .eq('tipo', 'planejamento')
      .not('data_fim', 'is', null)
      .order('data_fim', { ascending: true });

    // Regra: Apenas clientes ativos
    return (contratos || [])
      .filter(c => (c.clientes as any)?.status === 'Ativo')
      .map(c => {
        const [y, m, d] = c.data_fim.split('-').map(Number);
        const dataExp = new Date(y, m - 1, d, 12, 0, 0);

        const diffMs = dataExp.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        return {
          ...c,
          dataFimCalculada: dataExp.toISOString(),
          diffDays
        };
      })
      .filter(c => c.diffDays >= 0)
      .sort((a, b) => a.diffDays - b.diffDays);
  }
};
