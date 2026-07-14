
import { supabase } from './supabaseClient';
import { normalizarTexto } from '../utils/formatadores';

export interface PremissasIndependencia {
  id?: string;
  cliente_id: string;
  renda_alvo: number;
  taxa_real_anual: number;
  patrimonio_inicial: number;
  aporte_mensal: number;
  prazo_anos: number;
  data_inicio: string;
  /** Renda mensal esperada de outras fontes na aposentadoria (INSS, aluguéis...). Abate a renda alvo. */
  outras_fontes_renda: number;
  /** Taxa de rentabilização (% a.a.) na fase de consumo, específica deste cliente. Null = usa o padrão do escritório (Configurações > Investimentos). */
  taxa_pos_aposentadoria: number | null;
}

export interface HistoricoPatrimonio {
  id?: string;
  cliente_id: string;
  data_historico: string;
  valor_patrimonio: number;
  valor_aporte?: number;
}

const nomesCoincidem = (nomeAtivo: string, nomeClasse: string): boolean => {
  if (!nomeAtivo || !nomeClasse) return false;
  return normalizarTexto(nomeAtivo) === normalizarTexto(nomeClasse);
};

export const investimentoService = {
  async getAtivos(clienteId: string) {
    let query = supabase.from('ativos').select('*');
    if (clienteId) query = query.eq('cliente_id', clienteId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * Busca ativos de clientes por nome, ticker, CNPJ ou nome da instituição financeira
   * (via banco_corretora_id). Usada pela Consulta de Carteira para identificar quais
   * clientes possuem um ativo específico. Evita `.or()` com string interpolada (o termo
   * de busca pode conter vírgula/parênteses, que corrompem a sintaxe do filtro PostgREST) —
   * roda os filtros em paralelo e mescla por id.
   */
  async buscarAtivosPorTermo(termo: string) {
    const t = termo.trim();
    if (!t) return [];
    const like = `%${t}%`;
    const selectComCliente = '*, clientes(id, nome, status), bancos_corretoras(nome)';

    const [porNome, porTicker, porCnpj, bancosMatch] = await Promise.all([
      supabase.from('ativos').select(selectComCliente).ilike('nome', like),
      supabase.from('ativos').select(selectComCliente).ilike('ticker', like),
      supabase.from('ativos').select(selectComCliente).ilike('cnpj', like),
      supabase.from('bancos_corretoras').select('id').ilike('nome', like),
    ]);

    if (porNome.error) throw porNome.error;
    if (porTicker.error) throw porTicker.error;
    if (porCnpj.error) throw porCnpj.error;
    if (bancosMatch.error) throw bancosMatch.error;

    let porBanco: any[] = [];
    const bancoIds = (bancosMatch.data || []).map((b: any) => b.id);
    if (bancoIds.length > 0) {
      const { data, error } = await supabase.from('ativos').select(selectComCliente).in('banco_corretora_id', bancoIds);
      if (error) throw error;
      porBanco = data || [];
    }

    const mapa = new Map<string, any>();
    [...(porNome.data || []), ...(porTicker.data || []), ...(porCnpj.data || []), ...porBanco].forEach(a => mapa.set(a.id, a));
    return Array.from(mapa.values());
  },

  async getProjetos(clienteId: string) {
    const { data, error } = await supabase.from('projetos').select('*').eq('cliente_id', clienteId).order('data_alvo', { ascending: true });
    if (error) throw error;
    return data;
  },

  async salvarAtivo(ativo: any) {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { 
      ...ativo, 
      status: ativo.status || 'Manter',
      consultor_id: user?.id, 
      empresa_id: user?.user_metadata?.empresa_id || user?.id 
    };
    const { data, error } = ativo.id 
      ? await supabase.from('ativos').update(payload).eq('id', ativo.id).select()
      : await supabase.from('ativos').insert([payload]).select();
    if (error) throw error;
    return data;
  },

  async deletarAtivo(id: string) {
    const { error } = await supabase.from('ativos').delete().eq('id', id);
    if (error) throw error;
  },

  async salvarProjeto(projeto: any) {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...projeto, consultor_id: user?.id, empresa_id: user?.user_metadata?.empresa_id || user?.id };
    const { data, error } = projeto.id 
      ? await supabase.from('projetos').update(payload).eq('id', projeto.id).select()
      : await supabase.from('projetos').insert([payload]).select();
    if (error) throw error;
    return data;
  },

  async deletarProjeto(id: string) {
    const { error } = await supabase.from('projetos').delete().eq('id', id);
    if (error) throw error;
  },

  async getPremissasIndependencia(clienteId: string) {
    const { data, error } = await supabase.from('premissas_independencia').select('*').eq('cliente_id', clienteId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async salvarPremissasIndependencia(premissas: PremissasIndependencia) {
    const { id, ...payload } = premissas;
    const { data, error } = await supabase.from('premissas_independencia').upsert([payload], { onConflict: 'cliente_id' }).select().single();
    if (error) throw error;
    return data;
  },

  async getHistoricoMensal(clienteId: string) {
    const { data, error } = await supabase.from('historico_patrimonio').select('*').eq('cliente_id', clienteId).order('data_historico', { ascending: true });
    if (error) throw error;
    return data as HistoricoPatrimonio[];
  },

  async registrarSaldoMensal(snapshot: Partial<HistoricoPatrimonio>) {
    const { data, error } = await supabase.from('historico_patrimonio').insert([snapshot]).select().single();
    if (error) throw error;
    return data;
  },

  /** Edita um lançamento existente de historico_patrimonio (Histórico de Aportes). */
  async atualizarHistoricoMensal(id: string, patch: Partial<HistoricoPatrimonio>) {
    const { data, error } = await supabase.from('historico_patrimonio').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  /** Remove um lançamento de historico_patrimonio (Histórico de Aportes). */
  async excluirHistoricoMensal(id: string) {
    const { error } = await supabase.from('historico_patrimonio').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Snapshot automático do patrimônio financeiro TOTAL do cliente (soma de todos os ativos, em
   * todos os objetivos — reserva + projetos + independência) com UPSERT MENSAL: se já houver um
   * ponto no mês corrente para o cliente, atualiza-o (e ACUMULA o aporte do período); senão
   * insere. Disparado ao salvar a carteira e ao finalizar o wizard de aporte (que informa o valor
   * efetivamente aportado).
   *
   * Até jul/2026, este snapshot registrava apenas a fatia vinculada ao objetivo
   * 'independencia'. Linhas de historico_patrimonio salvas antes dessa mudança continuam
   * representando o valor antigo (mais estreito) — não há como recalcular retroativamente sem o
   * detalhamento de ativos daquela época. A partir de agora, todo novo snapshot é o patrimônio
   * total, base usada tanto no gráfico de independência quanto na tabela de rentabilidade mensal.
   */
  async snapshotPatrimonioIndependencia(clienteId: string, aporteRealizado: number = 0) {
    const ativos = await this.getAtivos(clienteId);
    const valorIndependencia = (ativos || []).reduce((acc: number, a: any) => acc + (a.valor_atual || 0), 0);

    const agora = new Date();
    const hojeStr = agora.toISOString().split('T')[0];
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString().split('T')[0];
    const inicioProximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1).toISOString().split('T')[0];

    // Procura um registro já existente no mês corrente
    const { data: existentes } = await supabase
      .from('historico_patrimonio')
      .select('id, valor_aporte')
      .eq('cliente_id', clienteId)
      .gte('data_historico', inicioMes)
      .lt('data_historico', inicioProximoMes)
      .limit(1);

    if (existentes && existentes.length > 0) {
      const aporteAcumulado = (Number(existentes[0].valor_aporte) || 0) + aporteRealizado;
      const { error } = await supabase
        .from('historico_patrimonio')
        .update({ valor_patrimonio: valorIndependencia, data_historico: hojeStr, valor_aporte: aporteAcumulado })
        .eq('id', existentes[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('historico_patrimonio')
        .insert([{ cliente_id: clienteId, data_historico: hojeStr, valor_patrimonio: valorIndependencia, valor_aporte: aporteRealizado }]);
      if (error) throw error;
    }
    return valorIndependencia;
  },

  async salvarHistoricoRebalanceamento(clienteId: string, estrategiaId: string, valorAporte: number, itens: any[]) {
    const { data: { user } } = await supabase.auth.getUser();
    const empresaId = user?.user_metadata?.empresa_id || user?.id;

    // 1. Criar o cabeçalho
    const { data: header, error: hError } = await supabase
      .from('historico_rebalanceamento')
      .insert([{
        cliente_id: clienteId,
        consultor_id: user?.id,
        empresa_id: empresaId,
        estrategia_id: estrategiaId || null,
        valor_aporte: valorAporte,
        tipo_distribuicao: 'Rebate Ótimo'
      }])
      .select()
      .single();

    if (hError) throw hError;

    // 2. Criar os itens vinculados
    const itensPayload = itens.map(it => ({
      rebalanceamento_id: header.id,
      ativo_id: it.ativo_id || null, // O banco requer UUID ou null
      ativo_nome_avulso: it.nome,
      valor_anterior: it.valor_anterior || 0,
      valor_distribuido: it.valor_distribuido || it.valor_efetivo || 0,
      valor_novo: it.valor_novo || 0
    }));

    const { error: iError } = await supabase.from('historico_rebalanceamento_itens').insert(itensPayload);
    if (iError) throw iError;

    return header;
  },

  async getUltimoRebalanceamento(clienteId: string) {
    const { data: header, error } = await supabase
      .from('historico_rebalanceamento')
      .select(`*, itens:historico_rebalanceamento_itens(*)`)
      .eq('cliente_id', clienteId)
      .order('data_rebalanceamento', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return header;
  },

  calcularRebateOtimo(ativos: any[], aporte: number, reservaRecomendada: number = 0, projetos: any[] = [], classesMeta: any[] = [], vendasPorObjetivo?: { reserva: number, projetos: number, independencia: number }) {
    const resumo = { reserva: 0, projetos: 0, independencia: 0, travas: [] as string[] };
    const totalReservaAtual = (ativos || []).reduce((acc, a) => {
      const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'reserva');
      return acc + (link ? a.valor_atual * (link.percentual / 100) : 0);
    }, 0);
    const percCobReserva = reservaRecomendada > 0 ? (totalReservaAtual / reservaRecomendada) : 1;

    let percAporteReserva = 0;
    if (percCobReserva >= 1) percAporteReserva = 0;
    else if (percCobReserva <= 0.20) percAporteReserva = 0.75;
    else if (percCobReserva <= 0.50) percAporteReserva = 0.50;
    else percAporteReserva = 0.25;

    resumo.reserva = (aporte * percAporteReserva) + (vendasPorObjetivo?.reserva || 0);
    let aporteRestante = aporte - (aporte * percAporteReserva);

    if (percCobReserva > 0.20) {
      let necProjetos = 0;
      const hoje = new Date();
      projetos.forEach(p => {
        const acumulado = (ativos || []).reduce((acc, a) => {
          const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'projeto' && o.projeto_id === p.id);
          return acc + (link ? a.valor_atual * (link.percentual / 100) : 0);
        }, 0);
        const meses = Math.max(1, (new Date(p.data_alvo).getFullYear() - hoje.getFullYear()) * 12 + (new Date(p.data_alvo).getMonth() - hoje.getMonth()));
        necProjetos += Math.max(0, p.valor_alvo - acumulado) / meses;
      });
      const aporteNovoProjetos = Math.min(aporteRestante, necProjetos, aporte * 0.99);
      resumo.projetos = aporteNovoProjetos + (vendasPorObjetivo?.projetos || 0);
      aporteRestante -= aporteNovoProjetos;
    } else {
      resumo.projetos = (vendasPorObjetivo?.projetos || 0);
    }
    resumo.independencia = Math.max(0, aporteRestante) + (vendasPorObjetivo?.independencia || 0);
    
    const ativosIndep = (ativos || []).filter(a => (a.distribuicao_objetivos || []).some((o: any) => o.tipo === 'independencia'));
    const totalIndepAtual = ativosIndep.reduce((acc, a) => {
      const link = a.distribuicao_objetivos.find((o: any) => o.tipo === 'independencia');
      return acc + (a.valor_atual * (link.percentual / 100));
    }, 0);

    const totalIndepProjetado = totalIndepAtual + resumo.independencia;

    const distribuicaoIndependencia = classesMeta.map(classe => {
      const assetsInClass = ativosIndep.filter(a => nomesCoincidem(a.tipo_ativo || '', classe.nome));
      const saldoAtualClasse = assetsInClass.reduce((acc, a) => {
        const link = a.distribuicao_objetivos.find((o: any) => o.tipo === 'independencia');
        return acc + (a.valor_atual * (link.percentual / 100));
      }, 0);
      const gapNecessidade = Math.max(0, (totalIndepProjetado * (classe.percentual / 100)) - saldoAtualClasse);
      return { classe: classe.nome, saldo_atual: saldoAtualClasse, alvo_perc: classe.percentual, rebate_individual: gapNecessidade, acao: gapNecessidade > 0.01 ? 'APORTAR' : 'MANTER' };
    });

    const necTotalGaps = distribuicaoIndependencia.reduce((acc, c) => acc + c.rebate_individual, 0);
    const rateio = (necTotalGaps > 0 && resumo.independencia < necTotalGaps) ? resumo.independencia / necTotalGaps : 1;

    return { resumo, totalIndepProjetado, distribuicaoIndependencia: distribuicaoIndependencia.map(c => ({ ...c, aporte_sugerido: c.rebate_individual * rateio })) };
  },

  calcularDistribuicaoDetalhadaAtivos(ativosCliente: any[], recomendados: any[], distribuicaoClasses: any[], config: any, patrimonioTotal: number, overrides?: any) {
    const ativosIndep = (ativosCliente || []).filter(a => (a.distribuicao_objetivos || []).some((o: any) => o.tipo === 'independencia'));

    // O cliente já possui ESTA variação específica (por ticker/cnpj) — nome_ativo não desambigua
    // porque é compartilhado por todas as variações do mesmo ativo (ex.: ETF FIXA11/IDKA11).
    const possuiVariacao = (rec: any) => ativosIndep.some(ac =>
      (rec.ticker && ac.ticker === rec.ticker) || (rec.cnpj && ac.cnpj === rec.cnpj)
    );

    return distribuicaoClasses.map(classeDist => {
      const candidatos = recomendados.filter(r => {
        const matchClasse = normalizarTexto(r.asset_classe_nome) === normalizarTexto(classeDist.classe);
        const matchTese = r.estrategia_id === config.teseId;
        const matchFaixa = r.faixa_id === config.faixaId;
        let matchBanco = true;
        if (r.instituicoes && config.bancos.length > 0) {
          const bancosAtivo = r.instituicoes.split(',').map((b: string) => normalizarTexto(b.trim()));
          matchBanco = bancosAtivo.some((b: string) => config.bancos.map((cb:any) => normalizarTexto(cb)).includes(b));
        }
        return matchClasse && matchTese && matchFaixa && matchBanco;
      });

      // Ativos com variações (mesmo nome_ativo, tickers/cnpjs diferentes): se o cliente já possui
      // alguma variação na carteira, só ELA é oferecida para alocação (as demais somem da simulação).
      // Sem posse de nenhuma variação, o único validador continua sendo a posse de conta na instituição.
      const gruposPorNome = new Map<string, any[]>();
      candidatos.forEach(r => {
        const k = normalizarTexto(r.nome_ativo);
        if (!gruposPorNome.has(k)) gruposPorNome.set(k, []);
        gruposPorNome.get(k)!.push(r);
      });
      const ativosTese = Array.from(gruposPorNome.values()).flatMap(variacoesGrupo => {
        if (variacoesGrupo.length <= 1) return variacoesGrupo;
        const possuidas = variacoesGrupo.filter(possuiVariacao);
        return possuidas.length > 0 ? possuidas : variacoesGrupo;
      });

      const processadosPre = ativosTese.map(rec => {
        const ovr = overrides?.[rec.id];
        const ativoNoCliente = ativosIndep.find(ac => (ac.ticker && ac.ticker === rec.ticker) || (ac.cnpj && ac.cnpj === rec.cnpj) || (ac.nome === rec.nome_ativo));
        const saldoIndep = ativoNoCliente ? (ativoNoCliente.valor_atual * (ativoNoCliente.distribuicao_objetivos.find((o: any) => o.tipo === 'independencia').percentual / 100)) : 0;
        const partReal = patrimonioTotal > 0 ? (saldoIndep / patrimonioTotal * 100) : 0;
        
        const somaAlocTese = ativosTese.reduce((acc, r) => acc + (r.alocacao || 0), 0);
        const metaIndiv = somaAlocTese > 0 ? (classeDist.alvo_perc * (rec.alocacao / somaAlocTese)) : 0;

        const acao = ovr?.status_manual !== undefined 
          ? (ovr.status_manual ? 'COMPRAR' : 'MANTER') 
          : (classeDist.acao === 'APORTAR' && partReal < metaIndiv ? 'COMPRAR' : 'MANTER');

        return { rec, saldoIndep, partReal, metaIndiv, acao, ovr, id: rec.id, id_banco_original: ativoNoCliente?.id };
      });

      const compradores = processadosPre.filter(p => p.acao === 'COMPRAR');
      const somaAlocCompradores = compradores.reduce((acc, p) => acc + (p.rec.alocacao || 0), 0);

      const ativosFinais = processadosPre.map(p => {
        let aporteSugerido = 0;
        if (p.acao === 'COMPRAR' && somaAlocCompradores > 0) {
          aporteSugerido = (p.rec.alocacao / somaAlocCompradores) * classeDist.aporte_sugerido;
        }

        return { 
          id: p.rec.id, 
          id_banco_original: p.id_banco_original,
          nome: p.rec.nome_ativo, 
          ticker: p.rec.ticker, 
          cnpj: p.rec.cnpj, 
          tipo: p.rec.tipo, 
          origem_ativo: p.rec.origem_ativo,
          variacoes_fundo: p.rec.variacoes_fundo,
          saldo_atual: p.saldoIndep, 
          alocacao_atual: p.partReal,
          alocacao_atualizada: p.metaIndiv, 
          preco_mercado: p.ovr?.preco_mercado || 0, 
          acao: p.acao, 
          aporte_sugerido: aporteSugerido, 
          cotas: p.ovr?.preco_mercado > 0 ? Math.floor((p.ovr?.aporte_efetivo || aporteSugerido) / p.ovr.preco_mercado) : 0 
        };
      });

      return { ...classeDist, valor_aporte_classe: classeDist.aporte_sugerido, ativos: ativosFinais };
    });
  },

  async processarAporteFinal(clienteId: string, ativosAtuais: any[], reservaAlloc: any[], projetosAlloc: any[], independenciaAlloc: any[], projetosList: any[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");
    const targetId = user?.user_metadata?.empresa_id || user?.id;

    const hoje = new Date();
    const necIndiv = (projetosList || []).map(p => {
      const acumulado = (ativosAtuais || []).reduce((acc, a) => {
        const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'projeto' && o.projeto_id === p.id);
        return acc + (link ? a.valor_atual * (link.percentual / 100) : 0);
      }, 0);
      const meses = Math.max(1, (new Date(p.data_alvo).getFullYear() - hoje.getFullYear()) * 12 + (new Date(p.data_alvo).getMonth() - hoje.getMonth()));
      return { id: p.id, nec: Math.max(0.01, (p.valor_alvo - acumulado) / meses) };
    });
    const necTotal = necIndiv.reduce((acc, x) => acc + x.nec, 0);
    const propProjetos = necIndiv.map(x => ({ projeto_id: x.id, percentual: necTotal > 0 ? (x.nec / necTotal) * 100 : (projetosList.length > 0 ? 100 / projetosList.length : 0) }));

    const upsertAporte = async (nome: string, valor: number, objetivos: any[], identifiers: any) => {
      if (valor <= 0.01) return;
      const match = (ativosAtuais || []).find(a => 
        (identifiers.ticker && a.ticker === identifiers.ticker) || 
        (identifiers.cnpj && a.cnpj === identifiers.cnpj) || 
        (normalizarTexto(a.nome) === normalizarTexto(nome))
      );

      if (match) {
        const { error } = await supabase.from('ativos').update({ valor_atual: (match.valor_atual || 0) + valor }).eq('id', match.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ativos').insert([{ 
          cliente_id: clienteId, 
          consultor_id: user.id, 
          empresa_id: targetId, 
          nome, 
          valor_atual: valor, 
          ticker: identifiers.ticker, 
          cnpj: identifiers.cnpj, 
          tipo_ativo: identifiers.tipo || 'Outros', 
          distribuicao_objetivos: objetivos, 
          status: 'Manter'
        }]);
        if (error) throw error;
      }
    };

    for (const r of (reservaAlloc || [])) await upsertAporte(r.nome, r.valor, [{ tipo: 'reserva', percentual: 100 }], { ticker: r.ticker, tipo: 'Reserva' });
    for (const p of (projetosAlloc || [])) await upsertAporte(p.nome, p.valor, propProjetos.map(pr => ({ tipo: 'projeto', projeto_id: pr.projeto_id, percentual: pr.percentual })), { ticker: p.ticker, tipo: 'Projetos' });
    for (const i of (independenciaAlloc || [])) await upsertAporte(i.nome, i.valor_efetivo, [{ tipo: 'independencia', percentual: 100 }], { ticker: i.ticker, cnpj: i.cnpj, tipo: i.tipo });

    return true;
  }
};
