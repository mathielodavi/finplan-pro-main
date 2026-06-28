import { supabase } from './supabaseClient';
import { toLocalDateString } from '../utils/formatadores';

export interface Parcela {
  id: string;
  contrato_id: string;
  cliente_id: string;
  valor_previsto: number;
  valor_pago?: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  clientes?: { nome: string };
  contratos?: {
    descricao: string;
    tipo: string;
    repasse_percentual: number;
    prazo_recebimento_dias: number;
  };
}

export const financeiroService = {
  async listarRecebiveis(mes: number, ano: number, apenasAbertos: boolean = false, status?: string, tipo?: string) {
    const dataRef = new Date(ano, mes, 0, 23, 59, 59).toISOString();
    const inicioMes = new Date(ano, mes - 1, 1).toISOString();

    let query = supabase
      .from('financeiro_parcelas')
      .select(`
        *,
        clientes (nome),
        contratos (descricao, tipo, repasse_percentual, prazo_recebimento_dias)
      `)
      .neq('status', 'cancelado');

    if (status === 'pendente') {
      query = query.in('status', ['pendente', 'atrasado']);
    } else if (status === 'pago') {
      query = query.eq('status', 'pago');
    }

    if (tipo && tipo !== 'todos') {
      query = query.eq('contratos.tipo', tipo);
    }

    if (apenasAbertos) {
      query = query.lte('data_vencimento', dataRef);
    } else {
      query = query
        .gte('data_vencimento', inicioMes)
        .lte('data_vencimento', dataRef);
    }

    const { data, error } = await query.order('data_vencimento', { ascending: true });

    if (error) throw error;

    let result = data as unknown as Parcela[];
    if (tipo && tipo !== 'todos') {
      result = result.filter(p => p.contratos?.tipo === tipo);
    }

    return result;
  },

  async obterParcelasPorContrato(contratoId: string) {
    const { data, error } = await supabase
      .from('financeiro_parcelas')
      .select('*')
      .eq('contrato_id', contratoId)
      .order('data_vencimento', { ascending: true });

    if (error) throw error;
    return data as Parcela[];
  },

  async registrarPagamento(id: string, valor: number, data: string) {
    const { data: parcela, error } = await supabase
      .from('financeiro_parcelas')
      .update({
        valor_pago: valor,
        data_pagamento: data,
        status: 'pago'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const contratoId = parcela.contrato_id;

    // Verifica se o contrato é ilimitado e precisa de extensão de parcelas
    await this.verificarExtensaoContratoIlimitado(contratoId);

    const { count } = await supabase
      .from('financeiro_parcelas')
      .select('*', { count: 'exact', head: true })
      .eq('contrato_id', contratoId)
      .in('status', ['pendente', 'atrasado']);

    if (count === 0) {
      const { data: con } = await supabase.from('contratos').select('padrao_id, tipo').eq('id', contratoId).single();
      if (con?.tipo === 'extra' && con?.padrao_id) {
        const { data: pad } = await supabase.from('padroes_contrato_extra_fases').select('id').eq('padrao_contrato_extra_id', con.padrao_id).is('mes_fim', null).maybeSingle();
        if (!pad) {
          // Apenas contratos extras com escopo fechado sem renovação automática devem ser concluídos aqui
          await supabase.from('contratos').update({ status: 'concluido' }).eq('id', contratoId);
        }
      }
    }

    return parcela;
  },

  async verificarExtensaoContratoIlimitado(contratoId: string) {
    const { data: contrato } = await supabase
      .from('contratos')
      .select('id, cliente_id, padrao_id, status, tipo')
      .eq('id', contratoId)
      .single();

    if (!contrato || contrato.status !== 'ativo' || contrato.tipo !== 'extra' || !contrato.padrao_id) return;

    // Busca se o padrão é recorrente. Se for temporário, não estendemos parcelas.
    const { data: padrao } = await supabase
      .from('padroes_contrato_extra')
      .select('recorrente')
      .eq('id', contrato.padrao_id)
      .single();

    if (!padrao || !padrao.recorrente) return;

    // Busca se existe fase nula (ilimitada)
    const { data: faseIlimitada } = await supabase
      .from('padroes_contrato_extra_fases')
      .select('id')
      .eq('padrao_contrato_extra_id', contrato.padrao_id)
      .is('mes_fim', null)
      .maybeSingle();

    if (!faseIlimitada) return;

    // Busca todas as parcelas atuais do contrato (exceto as canceladas)
    const { data: todasParcelas } = await supabase
      .from('financeiro_parcelas')
      .select('status, data_vencimento, valor_previsto')
      .eq('contrato_id', contratoId)
      .neq('status', 'cancelado')
      .order('data_vencimento', { ascending: false });

    if (!todasParcelas || todasParcelas.length === 0) return;

    const pagas = todasParcelas.filter(p => p.status === 'pago').length;
    const pendentes = todasParcelas.filter(p => p.status === 'pendente' || p.status === 'atrasado').length;

    // GATILHO: Se o consultor pagou ao menos 12 parcelas e restam 12 ou menos para o fim do lote atual
    if (pagas >= 12 && pendentes <= 12) {
      const ultimaParcela = todasParcelas[0];
      const novas = [];
      const [year, month, day] = ultimaParcela.data_vencimento.split('-').map(Number);

      for (let i = 1; i <= 12; i++) {
        const dataVenc = new Date(year, month - 1, day, 12, 0, 0);
        dataVenc.setMonth(dataVenc.getMonth() + i);

        novas.push({
          contrato_id: contratoId,
          cliente_id: contrato.cliente_id,
          valor_previsto: ultimaParcela.valor_previsto,
          data_vencimento: toLocalDateString(dataVenc),
          status: 'pendente'
        });
      }

      await supabase.from('financeiro_parcelas').insert(novas);
    }
  },

  async cancelarParcelasFuturas(contratoId: string, dataCancelamento: string, prazoRecebimento: number) {
    const { data: parcelasNoBanco } = await supabase
      .from('financeiro_parcelas')
      .select('id, data_vencimento, status')
      .eq('contrato_id', contratoId);

    if (parcelasNoBanco && parcelasNoBanco.length > 0) {
      const parcelasInvalidas = parcelasNoBanco.filter(p => {
        const ano = p.data_vencimento.split('-')[0];
        return ano.length < 4 || parseInt(ano) < 1000;
      });

      if (parcelasInvalidas.length > 0) {
        throw new Error(`Não é possível cancelar: Detectamos parcelas com datas inválidas.`);
      }
    }

    const [year, month, day] = dataCancelamento.split('-').map(Number);
    const dLimiteValida = new Date(year, month - 1, day, 12, 0, 0);
    dLimiteValida.setDate(dLimiteValida.getDate() + (prazoRecebimento || 0));
    const dataLimiteStr = dLimiteValida.toISOString().split('T')[0];

    const { error: errorCancel } = await supabase
      .from('financeiro_parcelas')
      .update({ status: 'cancelado' })
      .eq('contrato_id', contratoId)
      .gt('data_vencimento', dataLimiteStr)
      .neq('status', 'pago');

    if (errorCancel) throw errorCancel;

    await supabase
      .from('financeiro_parcelas')
      .update({ status: 'pendente' })
      .eq('contrato_id', contratoId)
      .lte('data_vencimento', dataLimiteStr)
      .eq('status', 'cancelado');
  },

  async sincronizarContratosPorPadrao(padraoId: string, novosDados: any) {
    const { data: contratos } = await supabase
      .from('contratos')
      .select('id')
      .eq('padrao_id', padraoId)
      .neq('status', 'cancelado')
      .neq('status', 'concluido');

    if (!contratos) return;

    for (const contrato of contratos) {
      const prazoD = novosDados.prazo_recebimento_dias || novosDados.prazo_recebimento_parcelado_dias;

      await supabase
        .from('contratos')
        .update({
          repasse_percentual: novosDados.percentual_repasse,
          prazo_recebimento_dias: prazoD,
          prazo_meses: novosDados.prazo_meses,
          valor: novosDados.valor_fixo ? novosDados.valor * (novosDados.prazo_meses || 1) : undefined
        })
        .eq('id', contrato.id);
    }
  },

  async getResumoMes(mes: number, ano: number) {
    const dataRef = new Date(ano, mes, 0, 23, 59, 59).toISOString();
    const inicioMes = new Date(ano, mes - 1, 1).toISOString();

    const { data: parcelas, error } = await supabase
      .from('financeiro_parcelas')
      .select('*, contratos(repasse_percentual)')
      .gte('data_vencimento', inicioMes)
      .lte('data_vencimento', dataRef)
      .neq('status', 'cancelado');

    if (error) throw error;

    return {
      previsto: (parcelas || []).reduce((acc, p) => acc + (p.valor_previsto * ((p.contratos?.repasse_percentual || 100) / 100)), 0),
      realizado: (parcelas || []).reduce((acc, p) => acc + ((p.valor_pago || 0) * ((p.contratos?.repasse_percentual || 100) / 100)), 0),
      countAtrasado: (parcelas || []).filter(p => p.status === 'atrasado').length
    };
  }
};