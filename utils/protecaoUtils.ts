import { calcularCoberturaVida } from './calculosFinanceiros';

const FATORES_REGIME: Record<string, number> = {
  'Servidor Público': 3,
  'CLT': 6,
  'Autônomo/Liberal': 9,
  'Autônomo / Liberal': 9,
  'Empresário': 12,
};

export const getFatorRegime = (regime: string | undefined) => FATORES_REGIME[regime || ''] || 6;

export interface ScoreProtecaoInput {
  clienteId: string;
  /** Linha de clientes_seguros do cliente, se existir. */
  dadosClienteSeguro?: any;
  /** clientes.reserva_recomendada — usado quando reserva_modo !== 'automatico'. */
  reservaRecomendada: number;
  /** Listas completas (de todos os clientes) — filtradas internamente por clienteId. */
  dependentes: any[];
  planosSaude: any[];
  segurosVida: any[];
  ativos: any[];
  /** Taxa real mensal já calculada a partir de parametros_calculo. */
  taxaRealMensal: number;
}

const pesoStatus = (status: 'protegido' | 'parcial' | 'desprotegido') =>
  status === 'protegido' ? 100 : status === 'parcial' ? 50 : 0;

/**
 * Calcula a pontuação de proteção (0-100) de UM cliente: média dos 3 pilares objetivos
 * (Reserva de Emergência, Plano de Saúde, Seguros de Vida — "Extras" não entra, pois não
 * tem critério objetivo). Replica fielmente a lógica de status dos acordeões da aba Proteção
 * (AcordeoReservaEmergencia, AcordeoPlanoSaude, AcordeoSeguros).
 */
export function calcularScoreProtecaoCliente(input: ScoreProtecaoInput): number {
  const { clienteId, dadosClienteSeguro: dados, reservaRecomendada, dependentes, planosSaude, segurosVida, ativos } = input;

  // ── Pilar 1: Reserva de Emergência ──
  const saldoReserva = (ativos || [])
    .filter((a: any) => a.cliente_id === clienteId)
    .reduce((acc: number, a: any) => {
      const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'reserva');
      return acc + (link ? (a.valor_atual || 0) * (link.percentual / 100) : 0);
    }, 0);

  let reservaIdeal = reservaRecomendada || 0;
  if (dados?.reserva_modo === 'automatico') {
    let gastos = dados.despesas_obrigatorias || 0;
    if (dados.reserva_incluir_nao_obrigatorias) gastos += dados.despesas_nao_obrigatorias || 0;
    if (dados.reserva_incluir_financiamentos) gastos += dados.financiamentos || 0;
    if (dados.reserva_incluir_dividas) gastos += dados.dividas_mensais || 0;
    const fatorCliente = getFatorRegime(dados.regime_contratacao_cliente);
    const fator = dados.casado_cliente
      ? (fatorCliente + getFatorRegime(dados.regime_contratacao_conjuge)) / 2
      : fatorCliente;
    reservaIdeal = gastos * fator;
  }
  const pctReserva = reservaIdeal > 0 ? (saldoReserva / reservaIdeal) * 100 : 0;
  const statusReserva = saldoReserva <= 0 ? 'desprotegido' : pctReserva >= 100 ? 'protegido' : pctReserva >= 25 ? 'parcial' : 'desprotegido';

  // ── Pilar 2: Plano de Saúde ──
  const dependentesCliente = (dependentes || []).filter((d: any) => d.cliente_id === clienteId);
  const membros = [
    'cliente',
    ...(dados?.casado_cliente ? ['conjuge'] : []),
    ...dependentesCliente.filter((d: any) => d.nome_dependente?.trim()).map((d: any) => d.nome_dependente),
  ];
  const membrosComPlano = new Set((planosSaude || []).filter((p: any) => p.cliente_id === clienteId).map((p: any) => p.membro));
  const todosProtegidos = membros.every(m => membrosComPlano.has(m));
  const algumProtegido = membros.some(m => membrosComPlano.has(m));
  const statusPlanoSaude = todosProtegidos ? 'protegido' : algumProtegido ? 'parcial' : 'desprotegido';

  // ── Pilar 3: Seguros de Vida ──
  const segurosClienteVida = (segurosVida || []).filter((s: any) => s.cliente_id === clienteId);
  // Fallback recalculado precisa espelhar a EtapaPadraoVida: base de despesas conforme os toggles
  // cobertura_incluir_* e taxa real ANUAL em percentual (não a mensal, que zerava o crescimento).
  const totalDespesasCobertura =
    ((dados?.cobertura_incluir_obrigatorias ?? true) ? (dados?.despesas_obrigatorias || 0) : 0) +
    ((dados?.cobertura_incluir_nao_obrigatorias ?? false) ? (dados?.despesas_nao_obrigatorias || 0) : 0) +
    ((dados?.cobertura_incluir_financiamentos ?? true) ? (dados?.financiamentos || 0) : 0) +
    ((dados?.cobertura_incluir_dividas ?? false) ? (dados?.dividas_mensais || 0) : 0) +
    ((dados?.cobertura_incluir_projetos ?? false) ? (dados?.projetos_financeiros || 0) : 0);
  const coberturaWizard = calcularCoberturaVida(
    dados?.renda_cliente || 0, dados?.renda_conjuge || 0, totalDespesasCobertura,
    dados?.periodo_cobertura_anos || 10, dados?.taxa_real_anual ?? 4
  );
  const idealCliente = dados?.cobertura_cliente || coberturaWizard.coberturaCliente;
  const idealConjuge = dados?.cobertura_conjuge || coberturaWizard.coberturaConjuge;
  // Comparado contra o ideal de Padrão de Vida — soma as coberturas desse grupo
  // (Doenças Graves, Invalidez, Cirurgia, DIT), não a de Sucessão (Morte/Funeral).
  const somaPadraoVida = (s: any) => (s.cobertura_doencas_graves || 0) + (s.cobertura_invalidez || 0) + (s.cobertura_cirurgia || 0) + (s.dit || 0);
  const realCliente = segurosClienteVida.filter((s: any) => s.membro === 'cliente').reduce((a: number, s: any) => a + somaPadraoVida(s), 0);
  const realConjuge = segurosClienteVida.filter((s: any) => s.membro === 'conjuge').reduce((a: number, s: any) => a + somaPadraoVida(s), 0);
  const clienteOk = realCliente >= idealCliente && realCliente > 0;
  const conjugeOk = !dados?.casado_cliente || (realConjuge >= idealConjuge && realConjuge > 0);
  const statusSeguros = segurosClienteVida.length === 0 ? 'desprotegido' : (clienteOk && conjugeOk) ? 'protegido' : 'parcial';

  return (pesoStatus(statusReserva) + pesoStatus(statusPlanoSaude) + pesoStatus(statusSeguros)) / 3;
}
