
import { supabase } from './supabaseClient';
import { Contrato, TipoEncerramento } from '../types/contrato';
import { toLocalDateString } from '../utils/formatadores';
import { financeiroService } from './financeiroService';

/** Fim natural do contrato = data_inicio + prazo_meses. */
const fimNatural = (dataInicio: string, prazoMeses: number): Date => {
  const [y, m, d] = dataInicio.split('-').map(Number);
  const dt = new Date(y, (m - 1) + (prazoMeses || 0), d, 12, 0, 0);
  return dt;
};

/** Encerramento efetivo de um contrato encerrado (data_fim, ou atualização, ou fim natural). */
const fimEfetivo = (c: Partial<Contrato>): Date => {
  if (c.data_fim) {
    const [y, m, d] = c.data_fim.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  if (c.atualizado_em) return new Date(c.atualizado_em);
  return fimNatural(c.data_inicio!, c.prazo_meses || 0);
};

/**
 * Classifica o encerramento de um contrato de planejamento:
 * - cancelado antes do fim natural → 'cancelamento_antecipado'
 * - concluído, ou cancelado já no/após o fim natural → 'nao_renovacao'
 */
const classificarEncerramento = (c: Partial<Contrato>): TipoEncerramento => {
  if (c.status === 'cancelado') {
    const efetivo = c.data_fim
      ? fimEfetivo(c)
      : new Date();
    const natural = fimNatural(c.data_inicio!, c.prazo_meses || 0);
    // Tolerância de 1 dia para evitar falso "antecipado" por arredondamento.
    if (efetivo.getTime() < natural.getTime() - 24 * 60 * 60 * 1000) {
      return 'cancelamento_antecipado';
    }
  }
  return 'nao_renovacao';
};

/**
 * Determina se um novo contrato de planejamento é um "resgate" (renovação tardia):
 * o cliente teve um contrato de planejamento anterior encerrado mais de 1 mês
 * antes do início deste novo contrato.
 */
const detectarResgate = async (clienteId: string, dataInicio: string): Promise<boolean> => {
  const { data: anteriores } = await supabase
    .from('contratos')
    .select('data_fim, atualizado_em, data_inicio, prazo_meses, status')
    .eq('cliente_id', clienteId)
    .eq('tipo', 'planejamento')
    .in('status', ['concluido', 'cancelado']);

  if (!anteriores || anteriores.length === 0) return false;

  const [y, m, d] = dataInicio.split('-').map(Number);
  const inicioNovo = new Date(y, m - 1, d, 12, 0, 0);
  const umMesAntes = new Date(inicioNovo);
  umMesAntes.setMonth(umMesAntes.getMonth() - 1);

  return anteriores.some((c: any) => fimEfetivo(c) < umMesAntes);
};

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
      if (i < numPagas) continue;

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

  const payload: Partial<Contrato> = {
    ...contrato,
    consultor_id: user.id,
    empresa_id: user.user_metadata?.empresa_id || user.id
  };

  // Resgate: novo contrato de planejamento reativando cliente >1 mês após distrato anterior.
  if (payload.tipo === 'planejamento' && payload.status === 'ativo' && payload.cliente_id && payload.data_inicio) {
    payload.is_resgate = await detectarResgate(payload.cliente_id, payload.data_inicio);
  }
  // Se já é criado encerrado (cancelado), classifica o encerramento.
  if (payload.tipo === 'planejamento' && payload.status === 'cancelado' && !payload.tipo_encerramento) {
    payload.tipo_encerramento = classificarEncerramento(payload);
  }

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

  // Classificação de encerramento (distratos) ao transicionar para cancelado/concluído.
  const merged = { ...contratoAntigo, ...dados } as Contrato;
  if (merged.tipo === 'planejamento') {
    const encerrando = (dados.status === 'cancelado' || dados.status === 'concluido');
    if (encerrando && dados.tipo_encerramento === undefined) {
      dados.tipo_encerramento = classificarEncerramento(merged);
    }
    // Reativação: volta a ativo → limpa a classificação de encerramento.
    if (dados.status === 'ativo') {
      dados.tipo_encerramento = null;
    }
  }

  const { data, error } = await supabase.from('contratos').update(dados).eq('id', id).select().single();
  if (error) throw error;

  const contratoAtualizado = data as Contrato;

  if (contratoAtualizado.status === 'cancelado') {
    const dataRefCancelamento = contratoAtualizado.data_fim || new Date().toISOString().split('T')[0];
    await financeiroService.cancelarParcelasFuturas(
      contratoAtualizado.id,
      dataRefCancelamento,
      contratoAtualizado.prazo_recebimento_dias || 30,
      contratoAtualizado.data_inadimplencia
    );
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

/**
 * Encerra administrativamente um contrato de planejamento (marca como 'concluido'
 * e classifica o tipo de encerramento) SEM tocar em financeiro_parcelas.
 *
 * Usado pelo fluxo de Renovação da Visão Geral: um contrato vencido só está sendo
 * formalizado como encerrado (renovado ou não) — as parcelas já geradas (pagas,
 * pendentes ou atrasadas) permanecem intactas para conciliação financeira e não
 * devem ser apagadas/recriadas, ao contrário do que `atualizarContrato` faz ao
 * detectar mudança de status.
 */
export const encerrarContratoPlanejamento = async (id: string, tipoEncerramento: TipoEncerramento | null) => {
  const { data, error } = await supabase
    .from('contratos')
    .update({ status: 'concluido', tipo_encerramento: tipoEncerramento, resolvido_renovacao: true })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  const contrato = data as Contrato;
  if (contrato.tipo === 'planejamento') {
    // Só inativa o cliente se não houver outro contrato de planejamento ativo
    // (ex.: no fluxo de renovação, o novo contrato já está ativo neste ponto).
    const { data: outrosAtivos } = await supabase
      .from('contratos')
      .select('id')
      .eq('cliente_id', contrato.cliente_id)
      .eq('tipo', 'planejamento')
      .eq('status', 'ativo')
      .neq('id', id)
      .limit(1);
    if (!outrosAtivos || outrosAtivos.length === 0) {
      await supabase.from('clientes').update({ status: 'Inativo' }).eq('id', contrato.cliente_id);
    }
  }
  return contrato;
};

export const deletarContrato = async (id: string) => {
  const { error } = await supabase.from('contratos').delete().eq('id', id);
  if (error) throw error;
};
