import { PremissasIndependencia, HistoricoPatrimonio } from '../services/investimentoService';

export interface PontoProjecao {
  label: string;
  /** Linha teórica (plano). */
  plano: number;
  /** Patrimônio real (histórico) ou projeção forward a partir de hoje. */
  real: number | null;
  /** Meta de capital de liberdade (constante). */
  target: number;
}

export interface ResultadoProjecao {
  patrimonioNecessario: number;
  chartData: PontoProjecao[];
  dataAlvo: Date;
}

export interface ConsumoPatrimonio {
  /** Idade atual do cliente, em anos (null se não cadastrada — desativa a fase de consumo). */
  idadeAtual: number | null;
  /** Fator de rentabilização anual (%) aplicado ao patrimônio durante a fase de consumo, definido em Configurações. */
  taxaRentabilizacaoAnual: number;
}

/**
 * Simula mês a mês a trajetória de um patrimônio: acumula (aporte + rentabilidade) até atingir
 * o patrimônio necessário para a independência e, a partir daí, passa a consumir (renda alvo
 * mensal descontada, rentabilizada à taxa de consumo) — permanecendo em modo consumo mesmo que
 * o saldo caia novamente abaixo do necessário.
 */
function simularTrajetoria(
  valorInicial: number,
  mesesTotal: number,
  patrimonioNecessario: number,
  taxaAcumulacaoMensal: number,
  aporteMensal: number,
  taxaConsumoMensal: number,
  rendaAlvoMensal: number
): number[] {
  const serie: number[] = [valorInicial];
  let valor = valorInicial;
  let consumindo = valor >= patrimonioNecessario;
  for (let m = 1; m <= mesesTotal; m++) {
    if (!consumindo) {
      valor = valor * (1 + taxaAcumulacaoMensal) + aporteMensal;
      if (valor >= patrimonioNecessario) consumindo = true;
    } else {
      valor = Math.max(0, valor * (1 + taxaConsumoMensal) - rendaAlvoMensal);
    }
    serie.push(valor);
  }
  return serie;
}

/**
 * Projeção da curva de independência financeira.
 * Trabalha com: patrimônio inicial (premissas), aporte mensal projetado, taxa real e o
 * patrimônio mensal real (snapshots do histórico). Extraído de IndependenciaInvestimentos
 * para ser reutilizado no Resumo Geral de Patrimônio.
 *
 * Quando `consumo.idadeAtual` é informado, a projeção (plano e real) se estende além do prazo
 * de acumulação: ao atingir o patrimônio necessário, passa a simular o consumo mensal (renda
 * alvo) rentabilizado pelo fator definido em Configurações, até os 90 anos do cliente.
 *
 * @param patrimonioAtual Patrimônio de independência atual (saldo vinculado ao objetivo).
 */
export function projetarIndependencia(
  params: PremissasIndependencia,
  patrimonioAtual: number,
  historico: HistoricoPatrimonio[],
  consumo?: ConsumoPatrimonio
): ResultadoProjecao {
  const taxaMensal = Math.pow(1 + params.taxa_real_anual / 100, 1 / 12) - 1;
  const patrimonioNecessario = (params.renda_alvo * 12) / (params.taxa_real_anual / 100 || 1);

  const dataInicio = new Date(params.data_inicio);
  const totalMesesPlano = params.prazo_anos * 12;
  const hoje = new Date();

  const idadeAtual = consumo?.idadeAtual ?? null;
  const mesesAteIdade90 = idadeAtual !== null ? Math.max(0, (90 - idadeAtual) * 12) : null;
  const mesesHorizonte = mesesAteIdade90 !== null ? Math.max(totalMesesPlano, mesesAteIdade90) : totalMesesPlano;
  const taxaConsumoMensal = consumo ? Math.pow(1 + consumo.taxaRentabilizacaoAnual / 100, 1 / 12) - 1 : taxaMensal;

  const seriePlano = simularTrajetoria(params.patrimonio_inicial, mesesHorizonte, patrimonioNecessario, taxaMensal, params.aporte_mensal, taxaConsumoMensal, params.renda_alvo);
  const serieRealForward = simularTrajetoria(patrimonioAtual, mesesHorizonte, patrimonioNecessario, taxaMensal, params.aporte_mensal, taxaConsumoMensal, params.renda_alvo);

  const chartData: PontoProjecao[] = [];

  const mapHistorico = new Map<string, number>(
    (historico || []).map(h => [
      new Date(h.data_historico).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase(),
      Number(h.valor_patrimonio),
    ])
  );

  for (let i = 0; i <= mesesHorizonte; i += 6) {
    const dataPonto = new Date(dataInicio);
    dataPonto.setMonth(dataInicio.getMonth() + i);
    const label = dataPonto.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase();

    // 1. Linha teórica (plano): acumula e, ao atingir o necessário, passa a consumir
    const valorPlano = seriePlano[i];

    // 2. Linha real (histórico até hoje, projeção daí em diante a partir do patrimônio atual)
    let valorReal: number | null = mapHistorico.get(label) ?? null;
    if (valorReal === null && dataPonto >= hoje) {
      const mesesForward = Math.max(0, (dataPonto.getFullYear() - hoje.getFullYear()) * 12 + (dataPonto.getMonth() - hoje.getMonth()));
      valorReal = serieRealForward[Math.min(mesesForward, serieRealForward.length - 1)];
    }

    chartData.push({
      label,
      plano: Math.round(valorPlano),
      real: (valorReal !== null && !isNaN(valorReal)) ? Math.round(valorReal) : null,
      target: Math.round(patrimonioNecessario),
    });
  }

  const dataAlvo = new Date(dataInicio);
  dataAlvo.setFullYear(dataInicio.getFullYear() + params.prazo_anos);

  return { patrimonioNecessario, chartData, dataAlvo };
}

export interface ResultadoPrazo {
  /** Prazo planejado no momento do cadastro das premissas, em meses. */
  prazoInicialMeses: number;
  /** Prazo recalculado a partir do patrimônio atual, aportes e rentabilidade realizados. Null se não atingível. */
  prazoAtualizadoMeses: number | null;
  /** Rentabilidade real anualizada apurada do histórico (null se não houver dados suficientes). */
  rentabilidadeRealAnual: number | null;
  /** Aporte mensal médio realizado, apurado do histórico (fallback: aporte mensal projetado). */
  aporteMedioRealizado: number;
}

/**
 * Compara o prazo planejado inicialmente com o prazo recalculado a partir da evolução real
 * do patrimônio (rentabilidade e aportes apurados do histórico mensal).
 */
export function calcularPrazoERentabilidade(
  params: PremissasIndependencia,
  patrimonioAtual: number,
  historico: HistoricoPatrimonio[]
): ResultadoPrazo {
  const prazoInicialMeses = Math.round(params.prazo_anos * 12);
  const patrimonioNecessario = (params.renda_alvo * 12) / (params.taxa_real_anual / 100 || 1);

  const pontos = [...(historico || [])].sort((a, b) => new Date(a.data_historico).getTime() - new Date(b.data_historico).getTime());

  // Rentabilidade mensal realizada: variação não explicada pelos aportes, entre pontos consecutivos
  const taxasMensais: number[] = [];
  for (let i = 1; i < pontos.length; i++) {
    const anterior = Number(pontos[i - 1].valor_patrimonio) || 0;
    const atual = Number(pontos[i].valor_patrimonio) || 0;
    const aporte = Number(pontos[i].valor_aporte) || 0;
    if (anterior > 0) {
      const rendimento = atual - anterior - aporte;
      const taxa = rendimento / anterior;
      if (isFinite(taxa)) taxasMensais.push(taxa);
    }
  }
  const taxaMensalRealMedia = taxasMensais.length > 0
    ? taxasMensais.reduce((acc, t) => acc + t, 0) / taxasMensais.length
    : null;
  const rentabilidadeRealAnual = taxaMensalRealMedia !== null
    ? (Math.pow(1 + taxaMensalRealMedia, 12) - 1) * 100
    : null;

  // Aporte médio realizado (soma dos aportes / nº de pontos mensais registrados)
  const somaAportes = pontos.reduce((acc, h) => acc + (Number(h.valor_aporte) || 0), 0);
  const aporteMedioRealizado = pontos.length > 0 ? somaAportes / pontos.length : params.aporte_mensal;

  // Prazo atualizado: usa taxa real apurada (se houver) e o aporte médio realizado (se houver)
  const taxaMensalUsada = taxaMensalRealMedia ?? (Math.pow(1 + params.taxa_real_anual / 100, 1 / 12) - 1);
  const aporteUsado = aporteMedioRealizado > 0 ? aporteMedioRealizado : params.aporte_mensal;

  let prazoAtualizadoMeses: number | null = null;
  if (patrimonioAtual >= patrimonioNecessario) {
    prazoAtualizadoMeses = 0;
  } else if (taxaMensalUsada > 0.00001) {
    const numerador = patrimonioNecessario * taxaMensalUsada + aporteUsado;
    const denominador = patrimonioAtual * taxaMensalUsada + aporteUsado;
    if (denominador > 0 && numerador > 0) {
      const razao = numerador / denominador;
      prazoAtualizadoMeses = razao > 1 ? Math.ceil(Math.log(razao) / Math.log(1 + taxaMensalUsada)) : 0;
    }
  } else if (aporteUsado > 0) {
    prazoAtualizadoMeses = Math.ceil((patrimonioNecessario - patrimonioAtual) / aporteUsado);
  }

  return { prazoInicialMeses, prazoAtualizadoMeses, rentabilidadeRealAnual, aporteMedioRealizado };
}
