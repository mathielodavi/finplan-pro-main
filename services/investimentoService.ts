
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
}

export interface HistoricoPatrimonio {
  id?: string;
  cliente_id: string;
  data: string;
  valor_independencia: number;
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
    const { data, error } = await supabase.from('historico_patrimonio').select('*').eq('cliente_id', clienteId).order('data', { ascending: true });
    if (error) throw error;
    return data as HistoricoPatrimonio[];
  },

  async registrarSaldoMensal(snapshot: Partial<HistoricoPatrimonio>) {
    const { data, error } = await supabase.from('historico_patrimonio').insert([snapshot]).select().single();
    if (error) throw error;
    return data;
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
    
    return distribuicaoClasses.map(classeDist => {
      const ativosTese = recomendados.filter(r => {
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
