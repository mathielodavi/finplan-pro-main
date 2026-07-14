import { supabase } from './supabaseClient';

export interface EpisodioInadimplencia {
  id: string;
  contrato_id: string;
  cliente_id: string;
  data_inicio: string;
  data_fim: string | null;
  motivo: string | null;
  criado_em?: string;
}

/** Resumo de inadimplência de um cliente — alimenta a KPI do prontuário e da listagem. */
export interface ResumoInadimplencia {
  /** Existe ao menos um contrato com episódio aberto (pausado) agora. */
  inadimplenteAgora: boolean;
  /** Nº total de episódios (abertos + fechados) — mede recorrência. */
  episodios: number;
  /** Tempo médio (dias) dos episódios já fechados. Null se nunca fechou um. */
  diasMedios: number | null;
  /** Dias corridos do episódio aberto mais antigo. 0 se não está inadimplente. */
  diasAtuais: number;
}

const diffDias = (inicio: string, fim: string): number => {
  const a = new Date(inicio + 'T00:00:00');
  const b = new Date(fim + 'T00:00:00');
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
};

const hojeStr = () => new Date().toISOString().split('T')[0];

/** Soma `dias` a uma data 'YYYY-MM-DD' preservando o formato. */
const somarDias = (dataStr: string, dias: number): string => {
  const d = new Date(dataStr + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
};

export const inadimplenciaService = {
  /**
   * Pausa um contrato por inadimplência a partir de `dataInicio`:
   * - abre um episódio (a unique index garante no máximo um aberto por contrato);
   * - marca `contratos.pausado_em`;
   * - tira do radar de recebíveis as parcelas pendentes com vencimento >= dataInicio
   *   (status 'pausado'), preservando as já pagas/canceladas.
   */
  async pausarContrato(contratoId: string, dataInicio: string, motivo?: string) {
    const { data: contrato, error: errC } = await supabase
      .from('contratos').select('id, cliente_id, consultor_id, empresa_id, pausado_em').eq('id', contratoId).single();
    if (errC) throw errC;
    if (contrato.pausado_em) throw new Error('Este contrato já está pausado por inadimplência.');

    const { error: errEp } = await supabase.from('inadimplencia_episodios').insert([{
      contrato_id: contratoId,
      cliente_id: contrato.cliente_id,
      data_inicio: dataInicio,
      motivo: motivo || null,
      consultor_id: contrato.consultor_id ?? null,
      empresa_id: contrato.empresa_id ?? null,
    }]);
    if (errEp) throw errEp;

    const { error: errUp } = await supabase.from('contratos').update({ pausado_em: dataInicio }).eq('id', contratoId);
    if (errUp) throw errUp;

    // Congela recebíveis: parcelas pendentes vencendo a partir da pausa saem do radar.
    const { error: errPar } = await supabase.from('financeiro_parcelas')
      .update({ status: 'pausado' })
      .eq('contrato_id', contratoId)
      .eq('status', 'pendente')
      .gte('data_vencimento', dataInicio);
    if (errPar) throw errPar;
  },

  /**
   * Regulariza um contrato pausado em `dataFim`:
   * - fecha o episódio aberto;
   * - desloca (empurra) os vencimentos das parcelas 'pausado' pelo nº de dias pausados e as
   *   devolve a 'pendente';
   * - acumula `contratos.dias_prorrogados` e limpa `pausado_em`.
   */
  async regularizarContrato(contratoId: string, dataFim: string) {
    const { data: episodio, error: errEp } = await supabase
      .from('inadimplencia_episodios')
      .select('id, data_inicio')
      .eq('contrato_id', contratoId)
      .is('data_fim', null)
      .maybeSingle();
    if (errEp) throw errEp;
    if (!episodio) throw new Error('Não há inadimplência aberta para este contrato.');

    const diasPausados = diffDias(episodio.data_inicio, dataFim);

    // Fecha o episódio.
    const { error: errClose } = await supabase.from('inadimplencia_episodios')
      .update({ data_fim: dataFim }).eq('id', episodio.id);
    if (errClose) throw errClose;

    // Desloca as parcelas pausadas e as reativa.
    if (diasPausados > 0) {
      const { data: pausadas } = await supabase.from('financeiro_parcelas')
        .select('id, data_vencimento').eq('contrato_id', contratoId).eq('status', 'pausado');
      for (const p of pausadas || []) {
        await supabase.from('financeiro_parcelas')
          .update({ data_vencimento: somarDias(p.data_vencimento, diasPausados), status: 'pendente' })
          .eq('id', p.id);
      }
    } else {
      await supabase.from('financeiro_parcelas')
        .update({ status: 'pendente' }).eq('contrato_id', contratoId).eq('status', 'pausado');
    }

    // Acumula prorrogação na vigência e limpa o espelho de pausa.
    const { data: contrato } = await supabase.from('contratos').select('dias_prorrogados').eq('id', contratoId).single();
    await supabase.from('contratos')
      .update({ pausado_em: null, dias_prorrogados: (contrato?.dias_prorrogados || 0) + diasPausados })
      .eq('id', contratoId);
  },

  /** Estado atual de inadimplência de um cliente (para banners de congelamento de atendimento). */
  async getEstadoCliente(clienteId: string): Promise<{ inadimplenteAgora: boolean; desde: string | null }> {
    const { data, error } = await supabase
      .from('inadimplencia_episodios')
      .select('data_inicio')
      .eq('cliente_id', clienteId)
      .is('data_fim', null)
      .order('data_inicio', { ascending: true })
      .limit(1);
    if (error) throw error;
    const aberto = data && data.length > 0 ? data[0] : null;
    return { inadimplenteAgora: !!aberto, desde: aberto?.data_inicio ?? null };
  },

  /** Episódios de um cliente (histórico do prontuário), mais recentes primeiro. */
  async getEpisodios(clienteId: string): Promise<EpisodioInadimplencia[]> {
    const { data, error } = await supabase
      .from('inadimplencia_episodios')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('data_inicio', { ascending: false });
    if (error) throw error;
    return (data || []) as EpisodioInadimplencia[];
  },

  /**
   * Resumo por cliente (recorrência, tempo médio, estado atual) para a listagem de clientes —
   * mesmo padrão de `dividasService.getSaldoDevedorPorCliente` / `protecaoService.getScoresPorCliente`.
   */
  async getResumoPorCliente(): Promise<Map<string, ResumoInadimplencia>> {
    const { data, error } = await supabase
      .from('inadimplencia_episodios')
      .select('cliente_id, data_inicio, data_fim');
    if (error) throw error;

    const hoje = hojeStr();
    const acc = new Map<string, { total: number; somaFechados: number; nFechados: number; abertoDesde: string | null }>();

    (data || []).forEach((e: any) => {
      const cur = acc.get(e.cliente_id) || { total: 0, somaFechados: 0, nFechados: 0, abertoDesde: null };
      cur.total += 1;
      if (e.data_fim) {
        cur.somaFechados += diffDias(e.data_inicio, e.data_fim);
        cur.nFechados += 1;
      } else {
        // guarda o início do episódio aberto mais antigo
        if (!cur.abertoDesde || e.data_inicio < cur.abertoDesde) cur.abertoDesde = e.data_inicio;
      }
      acc.set(e.cliente_id, cur);
    });

    const resumo = new Map<string, ResumoInadimplencia>();
    acc.forEach((v, clienteId) => {
      resumo.set(clienteId, {
        inadimplenteAgora: v.abertoDesde !== null,
        episodios: v.total,
        diasMedios: v.nFechados > 0 ? Math.round(v.somaFechados / v.nFechados) : null,
        diasAtuais: v.abertoDesde ? diffDias(v.abertoDesde, hoje) : 0,
      });
    });
    return resumo;
  },
};
