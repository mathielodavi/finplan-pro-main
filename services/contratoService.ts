
import { supabase } from './supabaseClient';
import { Contrato } from '../types/contrato';
import { toLocalDateString } from '../utils/formatadores';
import { financeiroService } from './financeiroService';

const gerarParcelasFinanceiras = async (contrato: Contrato, valorRestante: number, numPagas: number = 0) => {
  if (contrato.status === 'cancelado') return;

  let padraoExtra = null;
  if (contrato.tipo === 'extra' && contrato.padrao_id) {
    const { data: pData } = await supabase
      .from('padroes_contrato_extra')
      .select('*, fases:padroes_contrato_extra_fases(*)')
      .eq('id', contrato.padrao_id)
      .maybeSingle();
    padraoExtra = pData;
  }

  const [year, month, day] = contrato.data_inicio.split('-').map(Number);
  const baseDate = new Date(year, month - 1, day, 12, 0, 0);
  const novasParcelas = [];

  const isIlimitado = padraoExtra?.fases?.some((f: any) => f.mes_fim === null);

  if (padraoExtra && padraoExtra.fases && padraoExtra.fases.length > 0) {
    // CORREÇÃO CRÍTICA: O contrato.valor armazena o TOTAL PROJETADO (Mensalidades + Bônus).
    // Para recuperar o Ticket base sem inflar, precisamos considerar o peso do bônus no divisor.
    // Fórmula: Total = (Meses * Ticket) + (Ticket * (TaxaBonus / 100))
    // Logo: Ticket = Total / (Meses + (TaxaBonus / 100))

    const pesoBonus = (padraoExtra.tem_bonus && padraoExtra.taxa_bonus > 0)
      ? (padraoExtra.taxa_bonus / 100)
      : 0;

    const divisorReal = (contrato.prazo_meses || 1) + pesoBonus;
    const ticketMensal = contrato.valor / divisorReal;

    // 1. Processar Bônus se houver e não houver parcelas pagas (lote inicial)
    if (padraoExtra.tem_bonus && padraoExtra.taxa_bonus > 0 && numPagas === 0) {
      const dataBonus = new Date(baseDate);
      dataBonus.setDate(baseDate.getDate() + (padraoExtra.prazo_bonus_dias || 0));

      const valorBonusPrevisto = ticketMensal * (padraoExtra.taxa_bonus / 100);

      novasParcelas.push({
        contrato_id: contrato.id,
        cliente_id: contrato.cliente_id,
        valor_previsto: valorBonusPrevisto,
        data_vencimento: toLocalDateString(dataBonus),
        status: 'pendente'
      });
    }

    // 2. Processar Parcelas Mensais
    const numParcelasTotal = (padraoExtra.recorrente && isIlimitado) ? 24 : contrato.prazo_meses;
    const fases = [...(padraoExtra.fases || [])].sort((a, b) => a.ordem - b.ordem);

    let mesGlobal = 0;
    fases.forEach(fase => {
      const mesesNestaFase = fase.mes_fim === null ? numParcelasTotal : (fase.mes_fim || 1);
      for (let i = 1; i <= mesesNestaFase; i++) {
        mesGlobal++;
        if (mesGlobal <= numPagas) continue;
        if (mesGlobal > numParcelasTotal) break;

        const vencimento = new Date(baseDate);
        vencimento.setDate(baseDate.getDate() + (contrato.prazo_recebimento_dias || 0));
        vencimento.setMonth(vencimento.getMonth() + (mesGlobal - 1));

        const valorAjustadoFase = ticketMensal * (fase.percentual_repasse / 100);

        novasParcelas.push({
          contrato_id: contrato.id,
          cliente_id: contrato.cliente_id,
          valor_previsto: valorAjustadoFase,
          data_vencimento: toLocalDateString(vencimento),
          status: 'pendente'
        });
      }
    });
  } else {
    // Lógica padrão para Planejamento
    const numParcelasTotal = contrato.forma_pagamento === 'vista' ? 1 : contrato.prazo_meses;
    const valorParcela = valorRestante / (numParcelasTotal || 1);

    for (let i = 0; i < numParcelasTotal; i++) {
      const vencimento = new Date(baseDate);
      vencimento.setDate(baseDate.getDate() + (contrato.prazo_recebimento_dias || 0));
      vencimento.setMonth(vencimento.getMonth() + i);

      novasParcelas.push({
        contrato_id: contrato.id,
        cliente_id: contrato.cliente_id,
        valor_previsto: valorParcela,
        data_vencimento: toLocalDateString(vencimento),
        status: 'pendente'
      });
    }
  }

  if (novasParcelas.length > 0) {
    const { error } = await supabase.from('financeiro_parcelas').insert(novasParcelas);
    if (error) throw error;
  }
};

export const obterTodosContratos = async () => {
  const { data, error } = await supabase.from('contratos').select('id, cliente_id, tipo, status');
  if (error) throw error;
  return data as Partial<Contrato>[];
};

export const obterContratosPorCliente = async (clienteId: string) => {
  const { data, error } = await supabase.from('contratos').select('*').eq('cliente_id', clienteId).order('data_inicio', { ascending: false });
  if (error) throw error;
  return data as Contrato[];
};

export const criarContrato = async (contrato: Partial<Contrato>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não identificado');

  const payload = {
    ...contrato,
    consultor_id: user.id,
    empresa_id: user.user_metadata?.empresa_id || user.id
  };

  const { data, error } = await supabase.from('contratos').insert([payload]).select().single();
  if (error) throw error;

  const novoContrato = data as Contrato;
  await gerarParcelasFinanceiras(novoContrato, novoContrato.valor, 0);

  // Atualização automática de status do cliente associado ao planejamento
  if (novoContrato.tipo === 'planejamento') {
    if (novoContrato.status === 'ativo') {
      await supabase.from('clientes').update({ status: 'Ativo' }).eq('id', novoContrato.cliente_id);
    } else if (novoContrato.status === 'cancelado') {
      await supabase.from('clientes').update({ status: 'Inativo' }).eq('id', novoContrato.cliente_id);
    }
  }

  return novoContrato;
};

export const atualizarContrato = async (id: string, dados: Partial<Contrato>) => {
  const { data: contratoAntigo } = await supabase.from('contratos').select('*').eq('id', id).single();
  if (!contratoAntigo) throw new Error("Contrato não encontrado.");

  const mudouFinanceiro =
    (dados.valor !== undefined && dados.valor !== contratoAntigo.valor) ||
    (dados.prazo_meses !== undefined && dados.prazo_meses !== contratoAntigo.prazo_meses) ||
    (dados.data_inicio !== undefined && dados.data_inicio !== contratoAntigo.data_inicio) ||
    (dados.forma_pagamento !== undefined && dados.forma_pagamento !== contratoAntigo.forma_pagamento) ||
    (dados.prazo_recebimento_dias !== undefined && dados.prazo_recebimento_dias !== contratoAntigo.prazo_recebimento_dias) ||
    (dados.status !== undefined && dados.status !== contratoAntigo.status);

  const { data, error } = await supabase.from('contratos').update(dados).eq('id', id).select().single();
  if (error) throw error;

  const contratoAtualizado = data as Contrato;

  if (contratoAtualizado.status === 'cancelado') {
    const dataRefCancelamento = contratoAtualizado.data_fim || new Date().toISOString().split('T')[0];
    await financeiroService.cancelarParcelasFuturas(contratoAtualizado.id, dataRefCancelamento, contratoAtualizado.prazo_recebimento_dias || 30);
  } else if (mudouFinanceiro) {
    const { data: parcelasPagas } = await supabase.from('financeiro_parcelas').select('valor_pago').eq('contrato_id', id).eq('status', 'pago');
    const jaPagoTotal = parcelasPagas?.reduce((acc, p) => acc + (p.valor_pago || 0), 0) || 0;
    const pagasCount = parcelasPagas?.length || 0;
    const novoValorRestante = Math.max(0, contratoAtualizado.valor - jaPagoTotal);

    await supabase.from('financeiro_parcelas').delete().eq('contrato_id', id).neq('status', 'pago');
    if (novoValorRestante > 0.01) {
      await gerarParcelasFinanceiras(contratoAtualizado, novoValorRestante, pagasCount);
    }
  }

  // Atualização automática de status do cliente associado ao planejamento
  if (contratoAtualizado.tipo === 'planejamento') {
    if (contratoAtualizado.status === 'ativo') {
      await supabase.from('clientes').update({ status: 'Ativo' }).eq('id', contratoAtualizado.cliente_id);
    } else if (contratoAtualizado.status === 'cancelado' || contratoAtualizado.status === 'concluido') {
      // Considerando que concluído sem renovação também deixa o cliente inativo
      // A verificação diária também cuidará de status ativo/inativo pela data fim
      await supabase.from('clientes').update({ status: 'Inativo' }).eq('id', contratoAtualizado.cliente_id);
    }
  }

  return contratoAtualizado;
};

export const deletarContrato = async (id: string) => {
  const { error } = await supabase.from('contratos').delete().eq('id', id);
  if (error) throw error;
};
