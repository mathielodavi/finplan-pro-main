
import { supabase } from './supabaseClient';
import { calcularTermometro } from '../utils/termometroUtils';
import { dividasService } from './dividasService';
import { protecaoService } from './protecaoService';

export const dashboardService = {
  async getSummaryKPIs() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    // Buscamos todos os dados necessários
    const { data: allClientes } = await supabase.from('clientes').select('id, nome, patrimonio_total, status, telefone, email, em_agenda_externa');
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

    // KPI: Patrimônio sob Gestão — apenas clientes ativos
    const aum = clientes
      .filter(c => c.status === 'Ativo')
      .reduce((acc, c) => acc + (Number(c.patrimonio_total) || 0), 0);

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
    const clientesPorStatus: Record<string, { id: string; nome: string }[]> = { ENGAJADO: [], RECUPERAR: [], GHOSTING: [], 'SEM TERMÔMETRO': [] };

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
      clientesPorStatus[statusUpper]?.push({ id: cli.id, nome: cli.nome });
    });

    return Object.entries(stats).map(([name, value]) => ({ name, value, clientes: clientesPorStatus[name] || [] }));
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
  },

  /**
   * Contratos de planejamento VENCIDOS e ainda pendentes de resolução: data_fim no
   * passado, sem um contrato de planejamento mais recente que já os tenha superado
   * (renovação), sem decisão explícita registrada (`resolvido_renovacao`) e — para
   * contratos já classificados historicamente (`tipo_encerramento`, via backfill ou
   * uso normal do app) — apenas se o vencimento ainda está dentro da janela de
   * decisão (JANELA_VENCIDOS_DIAS). Isso evita que TODO o histórico de distratos
   * antigos reapareça como "pendente": só os vencimentos recentes, ainda sem uma
   * decisão real do consultor, entram na lista.
   *
   * Não filtramos por `clientes.status === 'Ativo'`: pela regra vigente (sem cron),
   * o cliente já vira Inativo assim que deixa de ter contrato de planejamento ativo
   * — ou seja, TODO contrato vencido sem renovação já corresponde a um cliente
   * Inativo. Alimenta o filtro "Vencidos" da Renovação, onde o usuário confirma a
   * não renovação (encerra) ou renova (novo contrato).
   */
  async getContratosVencidos() {
    const JANELA_VENCIDOS_DIAS = 30;
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

    const lista = contratos || [];

    return lista
      .filter(c => !(c as any).resolvido_renovacao) // decisão já registrada via o fluxo de Renovação → fora
      .map(c => {
        const [y, m, d] = c.data_fim.split('-').map(Number);
        const dataExp = new Date(y, m - 1, d, 12, 0, 0);
        const diffDays = Math.ceil((dataExp.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        return { ...c, dataFimCalculada: dataExp.toISOString(), diffDays };
      })
      .filter(c => c.diffDays < 0)
      // Já classificado historicamente (backfill/app) e fora da janela de decisão → histórico, não "pendente"
      .filter(c => !(c as any).tipo_encerramento || Math.abs(c.diffDays) <= JANELA_VENCIDOS_DIAS)
      // Já renovado: cliente possui outro contrato de planejamento ativo, ou um
      // contrato mais novo com início após este vencimento.
      .filter(c => !lista.some(o =>
        o.cliente_id === c.cliente_id && o.id !== c.id &&
        (o.status === 'ativo' || new Date(o.data_inicio) > new Date(c.data_fim))
      ))
      .sort((a, b) => a.diffDays - b.diffDays);
  },

  /**
   * Calcula métricas MENSAIS de movimentação da base de clientes (últimos 7 meses).
   *
   * Retorna por mês:
   * - ativos: clientes com ao menos 1 contrato de planejamento vigente naquele mês
   * - novos: clientes cujo primeiro contrato de planejamento iniciou naquele mês
   * - renovacoes: clientes que iniciaram novo contrato após um anterior concluído/cancelado
   * - distratos: contratos de planejamento cancelados no mês (por atualizado_em)
   * - churnMensal: distratos do mês / ativos do mês anterior × 100
   * - churnPrecoce: % acumulado de clientes com cancelamento precoce sobre toda a base
   * - churnPrecoce12m: % acumulado em janela móvel de 12 meses
   */
  async getChurnHistory() {
    const { data: allContratos } = await supabase.from('contratos').select('*, clientes(nome)');
    const contratosPlan = (allContratos || []).filter((c: any) => c.tipo === 'planejamento');

    const hoje = new Date();
    const result: any[] = [];
    let ativosDoMesAnterior = 0;
    let ativosAnterioresSet = new Set<string>();

    const getClientDetails = (id: string) => {
      const c = contratosPlan.find(x => x.cliente_id === id);
      return { id, nome: c?.clientes?.nome || 'Cliente não identificado' };
    };

    /**
     * Tipo de encerramento (distrato) do cliente até o fim de um mês: usa o
     * contrato de planejamento encerrado mais recente. Prioriza o campo explícito
     * tipo_encerramento; se ausente, deriva de status/datas.
     */
    const getTipoEncerramento = (clienteId: string, fimMes: Date): 'nao_renovacao' | 'cancelamento_antecipado' => {
      const encerrados = contratosComFim
        .filter(c => c.cliente_id === clienteId
          && (c.status === 'concluido' || c.status === 'cancelado')
          && c._dataFimEfetiva && c._dataFimEfetiva <= fimMes)
        .sort((a, b) => (b._dataFimEfetiva as Date).getTime() - (a._dataFimEfetiva as Date).getTime());
      const ultimo: any = encerrados[0];
      if (!ultimo) return 'nao_renovacao';
      if (ultimo.tipo_encerramento === 'cancelamento_antecipado' || ultimo.tipo_encerramento === 'nao_renovacao') {
        return ultimo.tipo_encerramento;
      }
      return ultimo.status === 'cancelado' ? 'cancelamento_antecipado' : 'nao_renovacao';
    };

    // Pré-calcular data_fim efetiva para cada contrato (data_fim ou data_inicio + prazo_meses)
    const contratosComFim = contratosPlan.map(c => {
      let dataFimEfetiva = c.data_fim ? new Date(c.data_fim) : null;
      if (!dataFimEfetiva && c.prazo_meses && c.data_inicio) {
        const d = new Date(c.data_inicio);
        d.setMonth(d.getMonth() + c.prazo_meses);
        dataFimEfetiva = d;
      }
      return { ...c, _dataFimEfetiva: dataFimEfetiva };
    });

    const todosClienteIds = [...new Set(contratosPlan.map(c => c.cliente_id))];

    for (let i = 7; i >= 0; i--) {
      const mesRef = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mesLabel = mesRef.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).toUpperCase();
      const inicioMes = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
      const fimMes = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0, 23, 59, 59);

      // ── 1. NOVOS CLIENTES: primeiro contrato iniciou neste mês ──
      let novosClientes = 0;
      const listaNovos: any[] = [];
      todosClienteIds.forEach(clienteId => {
        const contratosCliente = contratosPlan.filter(c => c.cliente_id === clienteId);
        const primeiroContrato = [...contratosCliente]
          .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())[0];
        const dataPrimeiro = new Date(primeiroContrato.data_inicio);
        if (dataPrimeiro >= inicioMes && dataPrimeiro <= fimMes) {
          novosClientes++;
          listaNovos.push(getClientDetails(clienteId));
        }
      });

      // ── 2. RENOVAÇÕES: contratos subsequentes iniciados neste mês ──
      let renovacoes = 0;
      const listaRenovacoes: any[] = [];
      todosClienteIds.forEach(clienteId => {
        const contratosCliente = contratosPlan
          .filter(c => c.cliente_id === clienteId)
          .sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

        contratosCliente.forEach((c, idx) => {
          if (idx === 0) return;
          // Resgates (renovação tardia) são contabilizados na categoria própria, não aqui.
          if (c.is_resgate) return;
          const dataInicio = new Date(c.data_inicio);
          if (dataInicio >= inicioMes && dataInicio <= fimMes) {
            // Evitar duplicidade caso haja mais de um contrato no mesmo mês
            if (!listaRenovacoes.some(x => x.id === clienteId)) {
              renovacoes++;
              listaRenovacoes.push(getClientDetails(clienteId));
            }
          }
        });
      });

      // ── 2b. RESGATES: contratos marcados como renovação tardia iniciados neste mês ──
      let resgates = 0;
      const listaResgates: any[] = [];
      todosClienteIds.forEach(clienteId => {
        const contratosCliente = contratosPlan.filter(c => c.cliente_id === clienteId && c.is_resgate);
        contratosCliente.forEach(c => {
          const dataInicio = new Date(c.data_inicio);
          if (dataInicio >= inicioMes && dataInicio <= fimMes) {
            if (!listaResgates.some(x => x.id === clienteId)) {
              resgates++;
              listaResgates.push(getClientDetails(clienteId));
            }
          }
        });
      });

      // ── 3. ATIVOS (Snapshot Fim do Mês) ──
      const contratosVigentesNoFimDoMes = contratosComFim.filter(c => {
        const dataInicio = new Date(c.data_inicio);
        if (dataInicio > fimMes) return false;

        if (c.status === 'ativo') return true;

        if (c.status === 'cancelado') {
          if (c.atualizado_em) {
            const dataCanc = new Date(c.atualizado_em);
            return dataCanc >= fimMes; // Só é ativo se foi cancelado DEPOIS do fim do mês
          }
          return false;
        }

        if (c._dataFimEfetiva && c._dataFimEfetiva >= fimMes) return true;

        return false;
      });
      const clientesAtivosNoFimDoMes = new Set(contratosVigentesNoFimDoMes.map(c => c.cliente_id));
      const totalAtivos = clientesAtivosNoFimDoMes.size;

      // ── 4. DISTRATOS: Calculado matematicamente ──
      // Quem estava ativo mês passado (ou entrou este mês) e NÃO está ativo no fim deste mês
      const baseParaDistratos = new Set([
        ...Array.from(ativosAnterioresSet),
        ...listaNovos.map(c => c.id),
        ...listaRenovacoes.map(c => c.id)
      ]);
      
      const listaDistratos: any[] = [];
      baseParaDistratos.forEach(id => {
        if (!clientesAtivosNoFimDoMes.has(id)) {
          listaDistratos.push({ ...getClientDetails(id), tipo_encerramento: getTipoEncerramento(id, fimMes) });
        }
      });
      const distratos = listaDistratos.length;

      // ── 5. CHURN MENSAL: distratos / ativos do mês anterior ──
      const churnMensal = ativosDoMesAnterior > 0
        ? (distratos / ativosDoMesAnterior) * 100 : 0;

      // ── 6. CHURN PRECOCE ACUMULADO: clientes sem ativo cujo último foi cancelado ──
      const contratosPlanAteMes = contratosPlan.filter(c =>
        new Date(c.data_inicio) <= fimMes
      );
      const clienteIdsAteMes = [...new Set(contratosPlanAteMes.map(c => c.cliente_id))];
      const baseTotalClientes = clienteIdsAteMes.length;

      let clientesChurnPrecoce = 0;
      clienteIdsAteMes.forEach(clienteId => {
        const contratosCliente = contratosPlanAteMes.filter(c => c.cliente_id === clienteId);
        const temAtivo = contratosCliente.some(c => c.status === 'ativo');
        if (temAtivo) return;

        const ultimoContrato = [...contratosCliente]
          .sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime())[0];

        if (ultimoContrato.status === 'cancelado') {
          clientesChurnPrecoce++;
        }
      });
      const churnPrecoce = baseTotalClientes > 0
        ? (clientesChurnPrecoce / baseTotalClientes) * 100 : 0;

      // ── 7. CHURN PRECOCE 12m: janela móvel ──
      const inicio12m = new Date(mesRef.getFullYear(), mesRef.getMonth() - 11, 1);
      const contratosJanela12m = contratosPlan.filter(c =>
        new Date(c.data_inicio) >= inicio12m && new Date(c.data_inicio) <= fimMes
      );
      const clienteIds12m = [...new Set(contratosJanela12m.map(c => c.cliente_id))];
      let clientesChurnPrecoce12m = 0;

      clienteIds12m.forEach(clienteId => {
        const contratosCliente = contratosJanela12m.filter(c => c.cliente_id === clienteId);
        const temAtivo = contratosCliente.some(c => c.status === 'ativo');
        if (temAtivo) return;

        const ultimoContrato = [...contratosCliente]
          .sort((a, b) => new Date(b.data_inicio).getTime() - new Date(a.data_inicio).getTime())[0];

        if (ultimoContrato.status === 'cancelado') {
          clientesChurnPrecoce12m++;
        }
      });
      const churnPrecoce12m = clienteIds12m.length > 0
        ? (clientesChurnPrecoce12m / clienteIds12m.length) * 100 : 0;

      // Só adicionamos ao resultado os últimos 7 meses
      if (i < 7) {
        result.push({
          mes: mesLabel,
          ativos: totalAtivos,
          novos: novosClientes,
          renovacoes,
          resgates,
          distratos,
          churnMensal: Math.round(churnMensal * 10) / 10,
          churnPrecoce: Math.round(churnPrecoce * 10) / 10,
          churnPrecoce12m: Math.round(churnPrecoce12m * 10) / 10,
          clientesNovos: listaNovos,
          clientesRenovacoes: listaRenovacoes,
          clientesResgates: listaResgates,
          clientesDistratos: listaDistratos
        });
      }

      ativosDoMesAnterior = totalAtivos;
      ativosAnterioresSet = clientesAtivosNoFimDoMes;
    }

    return result;
  },

  /**
   * Calcula métricas de LTV agregadas e por cliente.
   * LTV = saldo líquido contratual (parcelas × repasse) por cliente, considerando todo o
   * valor contratual (histórico realizado + projeção futura completa, sem teto). Apenas
   * clientes ATIVOS entram no cálculo, em linha com os demais KPIs da Visão Geral.
   */
  async getLTVMetrics() {
    const { data: allContratos } = await supabase.from('contratos').select('id, cliente_id, tipo, repasse_percentual, prazo_meses, data_inicio');
    const { data: allClientes } = await supabase.from('clientes').select('id, nome, status');
    const { data: allParcelas } = await supabase
      .from('financeiro_parcelas')
      .select('contrato_id, cliente_id, valor_previsto, valor_pago, status, data_vencimento')
      .neq('status', 'cancelado');

    const contratos = allContratos || [];
    const clientes = allClientes || [];
    const parcelas = allParcelas || [];

    // Mapa de repasse por contrato
    const contratoMap = new Map<string, { cliente_id: string; tipo: string; repasse: number; prazo_meses: number; data_inicio: string }>();
    contratos.forEach(c => {
      if (c.tipo !== 'planejamento' && c.tipo !== 'extra') return;
      contratoMap.set(c.id, {
        cliente_id: c.cliente_id,
        tipo: c.tipo,
        repasse: c.repasse_percentual || 100,
        prazo_meses: c.prazo_meses || 1,
        data_inicio: c.data_inicio
      });
    });

    // Agrupar por cliente
    const clienteMap = new Map<string, { nome: string; status: string; receitaLiquida: number; meses: number; contratos: number; primeiroContrato: Date | null }>();

    // Apenas clientes ativos entram no LTV (consistente com os demais KPIs da Visão Geral).
    // Clientes fora do mapa têm suas parcelas/contratos ignorados naturalmente abaixo.
    clientes
      .filter(cli => cli.status === 'Ativo')
      .forEach(cli => {
        clienteMap.set(cli.id, { nome: cli.nome, status: cli.status, receitaLiquida: 0, meses: 0, contratos: 0, primeiroContrato: null });
      });

    // Contabilizar contratos (apenas contagem e primeiro contrato — "meses" passa a vir das parcelas)
    contratos.forEach(c => {
      if (c.tipo !== 'planejamento' && c.tipo !== 'extra') return;
      const entry = clienteMap.get(c.cliente_id);
      if (!entry) return;

      entry.contratos += 1;

      const dataInicio = new Date(c.data_inicio);
      if (!entry.primeiroContrato || dataInicio < entry.primeiroContrato) {
        entry.primeiroContrato = dataInicio;
      }
    });

    // Calcular receita líquida via parcelas — histórico realizado + futuro contratual completo
    parcelas.forEach(p => {
      const contrato = contratoMap.get(p.contrato_id);
      if (!contrato) return;

      const entry = clienteMap.get(p.cliente_id || contrato.cliente_id);
      if (!entry) return;

      const repasse = contrato.repasse / 100;

      if (p.status === 'pago') {
        // Parcela paga: usar valor_pago real
        entry.receitaLiquida += (Number(p.valor_pago) || 0) * repasse;
      } else {
        // Parcela pendente/atrasada: usar valor_previsto como projeção
        entry.receitaLiquida += (Number(p.valor_previsto) || 0) * repasse;
      }
      entry.meses += 1;
    });

    // Filtrar apenas clientes com ao menos 1 contrato
    const clientesComContrato = Array.from(clienteMap.entries())
      .filter(([_, v]) => v.contratos > 0)
      .map(([id, v]) => ({
        id,
        nome: v.nome,
        status: v.status,
        ltv: v.receitaLiquida,
        mesesRelacionamento: v.meses,
        contratos: v.contratos,
        ticketMedioMensal: v.meses > 0 ? v.receitaLiquida / v.meses : 0,
        primeiroContrato: v.primeiroContrato
      }));

    const ltvTotal = clientesComContrato.reduce((acc, c) => acc + c.ltv, 0);
    const ltvMedio = clientesComContrato.length > 0 ? ltvTotal / clientesComContrato.length : 0;

    // Top 5 clientes por LTV
    const top5 = [...clientesComContrato].sort((a, b) => b.ltv - a.ltv).slice(0, 5);

    // Tempo médio de relacionamento em meses
    const tempoMedio = clientesComContrato.length > 0
      ? clientesComContrato.reduce((acc, c) => acc + c.mesesRelacionamento, 0) / clientesComContrato.length
      : 0;

    // Ticket médio mensal global
    const totalMeses = clientesComContrato.reduce((acc, c) => acc + c.mesesRelacionamento, 0);
    const ticketMedioGlobal = totalMeses > 0 ? ltvTotal / totalMeses : 0;

    return {
      ltvMedio,
      ltvTotal,
      totalClientes: clientesComContrato.length,
      tempoMedio,
      ticketMedioGlobal,
      top5
    };
  },

  /**
   * Endividamento total da base: soma do saldo devedor (créditos + consórcios) de todos os
   * clientes. Fonte única da fórmula: dividasService.getSaldoDevedorPorCliente().
   */
  async getEndividamentoTotal() {
    const { data: allClientes } = await supabase.from('clientes').select('id, status');
    const idsAtivos = new Set((allClientes || []).filter(c => c.status === 'Ativo').map(c => c.id));

    const saldos = await dividasService.getSaldoDevedorPorCliente();
    return Array.from(saldos.entries())
      .filter(([clienteId]) => idsAtivos.has(clienteId))
      .reduce((acc, [, v]) => acc + v, 0);
  },

  /**
   * % da base com proteção: média, entre clientes ativos com planejamento, da pontuação de
   * proteção (0-100) de cada cliente. Fonte única da fórmula:
   * protecaoService.getScoresPorCliente() (também usada pela coluna "Proteção" da listagem
   * de clientes).
   */
  async getCoberturaProtecao() {
    const { data: allClientes } = await supabase.from('clientes').select('id, status');
    const { data: allContratos } = await supabase.from('contratos').select('cliente_id, tipo');

    const idsComPlanejamento = new Set((allContratos || []).filter(c => c.tipo === 'planejamento').map(c => c.cliente_id));
    const clientesAlvo = (allClientes || []).filter(c => c.status === 'Ativo' && idsComPlanejamento.has(c.id));

    if (clientesAlvo.length === 0) return 0;

    const scores = await protecaoService.getScoresPorCliente();
    const valores = clientesAlvo.map(c => scores.get(c.id) ?? 0);

    return valores.reduce((acc, s) => acc + s, 0) / valores.length;
  },

  /**
   * Concentração de clientes por estado (UF), separando ativos de inativos.
   * Usado pelo mapa de bolhas em Atendimento.
   */
  async getDistribuicaoGeografica() {
    const { data: clientes } = await supabase.from('clientes').select('id, nome, estado, status').not('estado', 'is', null);

    const porEstado = new Map<string, { ativos: number; inativos: number; clientes: { id: string; nome: string; status: string }[] }>();
    (clientes || []).forEach((c: any) => {
      if (!c.estado) return;
      const entry = porEstado.get(c.estado) || { ativos: 0, inativos: 0, clientes: [] };
      if (c.status === 'Ativo') entry.ativos += 1;
      else entry.inativos += 1;
      entry.clientes.push({ id: c.id, nome: c.nome, status: c.status === 'Ativo' ? 'Ativo' : 'Inativo' });
      porEstado.set(c.estado, entry);
    });

    return Array.from(porEstado.entries()).map(([estado, v]) => ({
      estado,
      ativos: v.ativos,
      inativos: v.inativos,
      total: v.ativos + v.inativos,
      clientes: v.clientes,
    }));
  },

  /**
   * Contagem de CLIENTES por origem (total, ativos e inativos). "Ativos" = clientes
   * com status 'Ativo'; "inativos" = demais status (Inativo/Sem Contrato). Conta cada
   * cliente uma única vez — reconcilia com a base de clientes (diferente de contar
   * contratos, em que um cliente com vários contratos era contado várias vezes).
   * Só entram clientes que têm (ou já tiveram) contrato de PLANEJAMENTO — ativo ou
   * inativo, tanto faz o status do contrato — pois é essa frente que a origem mede.
   * Clientes que só têm contrato(s) do tipo "extra" não entram nesta contagem.
   * Usado pelo gráfico de barras da Visão Geral.
   */
  async getClientesPorOrigem() {
    const [{ data: clientes }, { data: origens }, { data: contratos }] = await Promise.all([
      supabase.from('clientes').select('id, nome, origem_id, status, etiquetas_tags'),
      supabase.from('origens').select('id, nome'),
      supabase.from('contratos').select('cliente_id, tipo'),
    ]);

    const origemNome = new Map((origens || []).map((o: any) => [o.id, o.nome]));
    const clientesComPlanejamento = new Set(
      (contratos || []).filter((c: any) => c.tipo === 'planejamento').map((c: any) => c.cliente_id)
    );

    const porOrigem = new Map<string, { total: number; ativos: number; inativos: number; clientes: any[] }>();
    (clientes || []).forEach((c: any) => {
      if (!clientesComPlanejamento.has(c.id)) return;
      const nome = (c.origem_id && origemNome.get(c.origem_id)) || 'Sem origem';
      const entry = porOrigem.get(nome) || { total: 0, ativos: 0, inativos: 0, clientes: [] };
      entry.total += 1;
      if (c.status === 'Ativo') entry.ativos += 1;
      else entry.inativos += 1;
      entry.clientes.push({ id: c.id, nome: c.nome, status: c.status, etiquetas_tags: c.etiquetas_tags || [] });
      porOrigem.set(nome, entry);
    });

    return Array.from(porOrigem.entries())
      .map(([origem, v]) => ({ origem, ...v }))
      .sort((a, b) => b.total - a.total);
  }
};
