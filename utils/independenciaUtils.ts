import { PremissasIndependencia, HistoricoPatrimonio } from '../services/investimentoService';

export interface PontoProjecao {
  /** Índice absoluto do mês desde data_inicio — eixo X numérico. */
  mes: number;
  /** Data do ponto (para tooltip "Set/2026"). */
  data: Date;
  /** Idade do cliente neste ponto (anos, com fração). Null sem data de nascimento. */
  idade: number | null;
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
  /** Renda mensal líquida usada na meta e no consumo: max(0, renda_alvo - outras_fontes_renda). */
  rendaLiquidaMensal: number;
  chartData: PontoProjecao[];
  dataAlvo: Date;
  /** Índice (mês desde data_inicio) correspondente a hoje — marcador "Hoje" e janelas de zoom. */
  mesesAteHoje: number;
  /** Data em que a trajetória PLANEJADA (linha "plano") atinge o patrimônio necessário. Null se não atingir dentro do horizonte simulado. */
  dataIndependenciaPlano: Date | null;
  mesIndependenciaPlano: number | null;
  /** Data em que a trajetória REAL (histórico + projeção forward) atinge o patrimônio necessário. Null se não atingir dentro do horizonte simulado. */
  dataIndependenciaReal: Date | null;
  mesIndependenciaReal: number | null;
  /** Valor do patrimônio no momento da independência de cada série (posiciona os marcadores no gráfico — com o limiar dinâmico, o cruzamento não acontece exatamente sobre a linha da meta planejada). */
  valorIndependenciaPlano: number | null;
  valorIndependenciaReal: number | null;
}

export interface ConsumoPatrimonio {
  /** Idade atual do cliente, em anos (null se não cadastrada — desativa a fase de consumo). */
  idadeAtual: number | null;
  /** Fator de rentabilização anual (%) aplicado ao patrimônio durante a fase de consumo — específico do cliente (premissas) ou padrão do escritório (Configurações). */
  taxaRentabilizacaoAnual: number;
}

/** Saque programado de um Objetivo (Reserva/Projeto) na sua data-alvo. */
export interface EventoSaque {
  /** Índice do mês, absoluto desde `data_inicio` das premissas (mesma base do eixo X do gráfico). */
  mes: number;
  /** Valor a subtrair do patrimônio total nesse mês (valor_alvo planejado do objetivo). */
  valor: number;
}

export interface OpcoesProjecao {
  /** Fase de consumo pós-independência (idade + taxa de rentabilização). */
  consumo?: ConsumoPatrimonio;
  /**
   * Parâmetros REALIZADOS (apurados do histórico via calcularPrazoERentabilidade), usados na
   * projeção forward da série "real" — é o que diferencia a visão atual do plano inicial.
   */
  realizado?: { rentabilidadeRealAnual: number | null; aporteMedioRealizado: number | null };
  /** true = não trava em 0 na fase de consumo (exibe o déficit como valor negativo). */
  permitirNegativos?: boolean;
  /**
   * Saques programados (Objetivos com data-alvo futura) — aplicados tanto na linha "plano"
   * quanto na projeção forward da linha "real", já que ambas representam o patrimônio TOTAL.
   * Eventos com data-alvo no passado (antes de hoje) são ignorados aqui: se já foram realizados,
   * o efeito deve estar refletido nos snapshots de Histórico de Aportes, não recriado por simulação.
   */
  eventosSaque?: EventoSaque[];
}

/** Trajetória mês a mês, mais o índice (mês) em que a fase de consumo se inicia. */
interface TrajetoriaSimulada {
  serie: number[];
  /** Índice (mês, relativo ao início desta série) em que `consumindo` passou a `true`. Null se nunca atingir dentro do horizonte simulado. */
  indiceIndependencia: number | null;
  /** Valor do patrimônio no mês em que a independência foi atingida (para posicionar o marcador no gráfico). Null se nunca atingir. */
  valorIndependencia: number | null;
}

/**
 * Simula mês a mês a trajetória de um patrimônio: acumula (aporte + rentabilidade) até atingir
 * o limiar de independência e, a partir daí, passa a consumir (renda alvo mensal descontada,
 * rentabilizada à taxa de consumo) — permanecendo em modo consumo mesmo que o saldo caia
 * novamente abaixo do limiar.
 *
 * `limiarIndependencia` é uma FUNÇÃO do mês, não um valor fixo: o capital exigido para se
 * aposentar depende de QUANDO a aposentadoria começa (aposentar mais cedo = mais anos de consumo
 * até os 90 = capital maior). Um limiar fixo calibrado para a data planejada dispararia o consumo
 * cedo demais quando o cliente está à frente do plano — e o patrimônio zeraria ANTES dos 90.
 *
 * `eventosSaque` (opcional): saques pontuais programados (índice de mês relativo ao início desta
 * própria série → valor a subtrair), aplicados no fim de cada mês — modela a realização de um
 * Objetivo (ex.: "Viagem Anual") na sua data-alvo, já que a curva representa o patrimônio
 * financeiro TOTAL do cliente (todos os objetivos), não só a fatia de independência. O saque do
 * mês é aplicado ANTES do teste do limiar, para um saque no próprio mês não disparar uma
 * independência que ele mesmo desfaz.
 */
function simularTrajetoria(
  valorInicial: number,
  mesesTotal: number,
  limiarIndependencia: (mes: number) => number,
  taxaAcumulacaoMensal: number,
  aporteMensal: number,
  taxaConsumoMensal: number,
  rendaAlvoMensal: number,
  permitirNegativos: boolean = false,
  eventosSaque?: Map<number, number>
): TrajetoriaSimulada {
  const serie: number[] = [valorInicial];
  let valor = valorInicial;
  let consumindo = valor >= limiarIndependencia(0);
  let indiceIndependencia: number | null = consumindo ? 0 : null;
  let valorIndependencia: number | null = consumindo ? valorInicial : null;
  for (let m = 1; m <= mesesTotal; m++) {
    if (!consumindo) {
      valor = valor * (1 + taxaAcumulacaoMensal) + aporteMensal;
    } else {
      const consumido = valor * (1 + taxaConsumoMensal) - rendaAlvoMensal;
      valor = permitirNegativos ? consumido : Math.max(0, consumido);
    }
    const saque = eventosSaque?.get(m);
    if (saque) {
      valor -= saque;
      if (!permitirNegativos) valor = Math.max(0, valor);
    }
    if (!consumindo && valor >= limiarIndependencia(m)) {
      consumindo = true;
      indiceIndependencia = m;
      valorIndependencia = valor;
    }
    serie.push(valor);
  }
  return { serie, indiceIndependencia, valorIndependencia };
}

/**
 * Capital de liberdade: valor presente de uma anuidade mensal (`rendaMensal`) que se esgota
 * exatamente ao fim de `mesesConsumo` períodos, descontada à taxa de consumo informada.
 * Sem esse horizonte (idade do cliente desconhecida — `mesesConsumo` null), cai para o modelo
 * de perpetuidade (renda*12/taxa) como fallback conservador, já que não há como simular quando
 * o consumo deveria zerar o patrimônio.
 *
 * IMPORTANTE: usar perpetuidade quando o horizonte É conhecido faz o patrimônio "estabilizar"
 * em vez de decrescer após a aposentadoria — a anuidade finita é o que garante o decréscimo até
 * zero no fim do horizonte de consumo (é a mesma matemática usada no simulador de referência).
 */
function calcularCapitalNecessario(rendaMensal: number, taxaAnual: number, mesesConsumo: number | null): number {
  if (mesesConsumo === null || mesesConsumo <= 0) {
    return (rendaMensal * 12) / (taxaAnual / 100 || 1);
  }
  const i = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  if (Math.abs(i) < 1e-9) return rendaMensal * mesesConsumo;
  return (rendaMensal * (1 - Math.pow(1 + i, -mesesConsumo))) / i;
}

/** Meses entre a idade atual e `idadeAlvo`. Null sem idade cadastrada. */
function calcularMesesAteIdade(idadeAtual: number | null, idadeAlvo: number): number | null {
  return idadeAtual !== null ? Math.max(0, (idadeAlvo - idadeAtual) * 12) : null;
}

/**
 * Projeção da curva de independência financeira.
 * Trabalha com: patrimônio inicial (premissas), aporte mensal projetado, taxa real e o
 * patrimônio mensal real (snapshots do histórico).
 *
 * Série "plano": trajetória ideal com as premissas originais (aporte projetado + taxa premissa).
 * Série "real": histórico até hoje; daí em diante, projeção forward a partir do patrimônio atual
 * usando os parâmetros REALIZADOS (`opcoes.realizado`) quando disponíveis — rentabilidade média
 * apurada e aporte médio efetivo — para comparar de fato planejado vs realizado.
 *
 * Quando `opcoes.consumo.idadeAtual` é informado, a projeção (plano e real) se estende até os
 * 100 anos do cliente: ao atingir o limiar de independência, passa a simular o consumo mensal
 * (renda líquida) rentabilizado pelo fator de consumo. O limiar é DINÂMICO (ver `limiarNoMes`):
 * cada série se aposenta no primeiro mês em que o patrimônio sustenta o consumo até os 90 anos
 * — quem está à frente do plano antecipa a independência SEM esgotar antes dos 90; quem está
 * atrás só "aposenta" quando de fato der. `patrimonioNecessario` (exibido como meta) continua
 * sendo o capital calibrado para a data planejada.
 *
 * @param patrimonioAtual Patrimônio financeiro atual do cliente (todos os objetivos).
 */
export function projetarIndependencia(
  params: PremissasIndependencia,
  patrimonioAtual: number,
  historico: HistoricoPatrimonio[],
  opcoes?: OpcoesProjecao
): ResultadoProjecao {
  const consumo = opcoes?.consumo;
  const permitirNegativos = opcoes?.permitirNegativos || false;

  const taxaMensal = Math.pow(1 + params.taxa_real_anual / 100, 1 / 12) - 1;
  // Renda líquida: outras fontes (INSS, aluguéis...) abatem a renda que o patrimônio precisa gerar.
  const rendaLiquidaMensal = Math.max(0, params.renda_alvo - (Number(params.outras_fontes_renda) || 0));

  const dataInicio = new Date(params.data_inicio);
  const totalMesesPlano = params.prazo_anos * 12;
  const hoje = new Date();
  // Precisa ser calculado antes das simulações (usado para deslocar os eventos de saque para o
  // referencial da série "real", que começa em hoje, não em data_inicio).
  const mesesAteHoje = Math.max(0, (hoje.getFullYear() - dataInicio.getFullYear()) * 12 + (hoje.getMonth() - dataInicio.getMonth()));

  const idadeAtual = consumo?.idadeAtual ?? null;
  // Horizonte de SIMULAÇÃO (gráfico): até os 100 anos — mais largo que os 90 usados para
  // dimensionar a meta, para poder mostrar um patrimônio que ultrapasse a meta além dos 90.
  const mesesAteIdade100 = calcularMesesAteIdade(idadeAtual, 100);
  const mesesHorizonte = mesesAteIdade100 !== null ? Math.max(totalMesesPlano, mesesAteIdade100) : totalMesesPlano;
  const taxaAlvoAnual = consumo ? consumo.taxaRentabilizacaoAnual : params.taxa_real_anual;
  const taxaConsumoMensal = consumo ? Math.pow(1 + consumo.taxaRentabilizacaoAnual / 100, 1 / 12) - 1 : taxaMensal;

  // Mês (absoluto, desde data_inicio) em que o cliente completa 90 anos — teto do consumo.
  const mesesAte90Abs = idadeAtual !== null ? mesesAteHoje + Math.round((90 - idadeAtual) * 12) : null;
  // Capital de liberdade EXIBIDO (meta do plano): dimensionado para aposentadoria na data
  // planejada, com consumo da renda líquida até os 90 anos.
  const mesesConsumoPlanejado = mesesAte90Abs !== null ? Math.max(1, mesesAte90Abs - totalMesesPlano) : null;
  const patrimonioNecessario = calcularCapitalNecessario(rendaLiquidaMensal, taxaAlvoAnual, mesesConsumoPlanejado);

  // Forward da série "real": parâmetros realizados quando o histórico permite apurá-los.
  const realizado = opcoes?.realizado;
  const taxaForwardMensal = (realizado?.rentabilidadeRealAnual !== null && realizado?.rentabilidadeRealAnual !== undefined)
    ? Math.pow(1 + realizado.rentabilidadeRealAnual / 100, 1 / 12) - 1
    : taxaMensal;
  const aporteForward = (realizado?.aporteMedioRealizado !== null && realizado?.aporteMedioRealizado !== undefined && realizado.aporteMedioRealizado > 0)
    ? realizado.aporteMedioRealizado
    : params.aporte_mensal;

  // Eventos de saque (Objetivos com data-alvo futura): mapa mes→valor, num referencial próprio
  // para cada série — "plano" conta a partir de data_inicio; "real forward" conta a partir de
  // hoje, então cada evento é deslocado por `mesesAteHoje` (eventos já passados não entram aqui).
  const mapEventosPlano = new Map<number, number>();
  const mapEventosReal = new Map<number, number>();
  (opcoes?.eventosSaque || []).forEach(e => {
    if (e.mes < 0 || e.mes > mesesHorizonte || !(e.valor > 0)) return;
    mapEventosPlano.set(e.mes, (mapEventosPlano.get(e.mes) || 0) + e.valor);
    const mesRelativoReal = e.mes - mesesAteHoje;
    if (mesRelativoReal >= 0) mapEventosReal.set(mesRelativoReal, (mapEventosReal.get(mesRelativoReal) || 0) + e.valor);
  });

  // Limiar DINÂMICO de independência: capital exigido caso a aposentadoria comece exatamente no
  // mês `mesAbs` — quanto mais cedo, maior (mais anos de consumo até os 90). É o que garante a
  // manutenção mínima do patrimônio até os 90 anos: com um limiar fixo (calibrado para a data
  // planejada), cruzar a meta antes da hora dispararia o consumo cedo demais e o patrimônio
  // zeraria antes dos 90. Saques programados posteriores ao mês também precisam estar cobertos
  // pelo capital (trazidos a valor presente pela taxa de consumo).
  const limiarNoMes = (mesAbs: number): number => {
    const base = mesesAte90Abs !== null
      ? calcularCapitalNecessario(rendaLiquidaMensal, taxaAlvoAnual, Math.max(1, mesesAte90Abs - mesAbs))
      : patrimonioNecessario;
    let pvSaquesFuturos = 0;
    mapEventosPlano.forEach((valor, mes) => {
      if (mes > mesAbs && (mesesAte90Abs === null || mes <= mesesAte90Abs)) {
        pvSaquesFuturos += valor / Math.pow(1 + taxaConsumoMensal, mes - mesAbs);
      }
    });
    return base + pvSaquesFuturos;
  };
  const limiarPlano = (mes: number) => limiarNoMes(mes);
  const limiarReal = (mes: number) => limiarNoMes(mesesAteHoje + mes); // série real começa em "hoje"

  const { serie: seriePlano, indiceIndependencia: indicePlano, valorIndependencia: valorIndependenciaPlano } = simularTrajetoria(params.patrimonio_inicial, mesesHorizonte, limiarPlano, taxaMensal, params.aporte_mensal, taxaConsumoMensal, rendaLiquidaMensal, permitirNegativos, mapEventosPlano);
  const { serie: serieRealForward, indiceIndependencia: indiceRealForward, valorIndependencia: valorIndependenciaReal } = simularTrajetoria(patrimonioAtual, mesesHorizonte, limiarReal, taxaForwardMensal, aporteForward, taxaConsumoMensal, rendaLiquidaMensal, permitirNegativos, mapEventosReal);

  // A série "real" só passa a existir a partir de hoje (antes disso é histórico real, não simulado),
  // então o índice de independência da série "real", que é relativo ao início do forward (hoje),
  // precisa ser deslocado pelo nº de meses entre o início do plano e hoje para virar um índice
  // absoluto (desde `dataInicio`) — mesma base de tempo usada no eixo X do gráfico.
  const indiceRealAbsoluto = indiceRealForward !== null ? mesesAteHoje + indiceRealForward : null;

  const mesParaData = (indice: number): Date => {
    const d = new Date(dataInicio);
    d.setMonth(dataInicio.getMonth() + indice);
    return d;
  };
  const dataIndependenciaPlano = indicePlano !== null ? mesParaData(indicePlano) : null;
  const dataIndependenciaReal = indiceRealAbsoluto !== null ? mesParaData(indiceRealAbsoluto) : null;

  const chartData: PontoProjecao[] = [];

  const mapHistorico = new Map<string, number>(
    (historico || []).map(h => [
      new Date(h.data_historico).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase(),
      Number(h.valor_patrimonio),
    ])
  );

  // Índice (mês desde data_inicio) de cada snapshot real registrado — garante que TODO ponto de
  // histórico apareça no gráfico, não só os que caem nos múltiplos de 6 meses da amostragem base.
  const indiceDoHistorico = (d: Date): number => Math.round((d.getFullYear() - dataInicio.getFullYear()) * 12 + (d.getMonth() - dataInicio.getMonth()));

  // Índices amostrados a cada 6 meses (para a suavidade da curva simulada), mais os índices
  // "notáveis" (independência plano/real, hoje) e TODOS os meses com snapshot real registrado.
  const indicesAmostra = new Set<number>();
  for (let i = 0; i <= mesesHorizonte; i += 6) indicesAmostra.add(i);
  if (indicePlano !== null) indicesAmostra.add(indicePlano);
  if (indiceRealAbsoluto !== null && indiceRealAbsoluto <= mesesHorizonte) indicesAmostra.add(indiceRealAbsoluto);
  if (mesesAteHoje <= mesesHorizonte) indicesAmostra.add(mesesAteHoje);
  (historico || []).forEach(h => {
    const idx = indiceDoHistorico(new Date(h.data_historico));
    if (idx >= 0 && idx <= mesesHorizonte) indicesAmostra.add(idx);
  });

  const indicesOrdenados = Array.from(indicesAmostra).sort((a, b) => a - b);

  for (const i of indicesOrdenados) {
    const dataPonto = mesParaData(i);
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
      mes: i,
      data: dataPonto,
      idade: idadeAtual !== null ? idadeAtual + (i - mesesAteHoje) / 12 : null,
      label,
      plano: Math.round(valorPlano),
      real: (valorReal !== null && !isNaN(valorReal)) ? Math.round(valorReal) : null,
      target: Math.round(patrimonioNecessario),
    });
  }

  const dataAlvo = new Date(dataInicio);
  dataAlvo.setFullYear(dataInicio.getFullYear() + params.prazo_anos);

  return {
    patrimonioNecessario,
    rendaLiquidaMensal,
    chartData,
    dataAlvo,
    mesesAteHoje,
    dataIndependenciaPlano,
    mesIndependenciaPlano: indicePlano,
    dataIndependenciaReal,
    mesIndependenciaReal: indiceRealAbsoluto !== null && indiceRealAbsoluto <= mesesHorizonte ? indiceRealAbsoluto : null,
    valorIndependenciaPlano,
    valorIndependenciaReal: indiceRealAbsoluto !== null && indiceRealAbsoluto <= mesesHorizonte ? valorIndependenciaReal : null,
  };
}

export interface ResultadoPrazo {
  /** Prazo planejado no momento do cadastro das premissas, em meses. */
  prazoInicialMeses: number;
  /** Rentabilidade real anualizada apurada do histórico (null se não houver dados suficientes). */
  rentabilidadeRealAnual: number | null;
  /** Aporte mensal médio realizado, apurado do histórico (fallback: aporte mensal projetado). */
  aporteMedioRealizado: number;
}

/**
 * Taxa de retorno realizada entre dois snapshots consecutivos: variação não explicada pelo aporte
 * do período, sobre o saldo anterior. É uma aproximação (Dietz simples, assume o aporte
 * concentrado no fim do período) — não é uma TWR (time-weighted return) exata, que exigiria o
 * timestamp de cada fluxo dentro do mês. Com a granularidade mensal atual (um único valor de
 * aporte por mês), essa aproximação é o que a estrutura de dados hoje permite calcular.
 */
function calcularTaxaRealizada(valorAnterior: number, valorAtual: number, aporte: number): number | null {
  if (!(valorAnterior > 0)) return null;
  const rendimento = valorAtual - valorAnterior - aporte;
  const taxa = rendimento / valorAnterior;
  return isFinite(taxa) ? taxa : null;
}

/**
 * Apura do histórico mensal a rentabilidade e o aporte médio realizados, além do prazo planejado.
 *
 * O "prazo atualizado" NÃO é mais calculado aqui: a antiga fórmula fechada de anuidade só sabia
 * responder "quando o patrimônio cruza um capital fixo" — ignorava que aposentar mais cedo exige
 * um capital maior (manter o patrimônio até os 90) e ignorava os saques programados de objetivos.
 * Ele agora sai da própria simulação do gráfico (`projetarIndependencia().mesIndependenciaReal`),
 * que usa o limiar dinâmico e os eventos de saque — KPI e gráfico coerentes por construção.
 */
export function calcularPrazoERentabilidade(
  params: PremissasIndependencia,
  historico: HistoricoPatrimonio[]
): ResultadoPrazo {
  const prazoInicialMeses = Math.round(params.prazo_anos * 12);

  const pontos = [...(historico || [])].sort((a, b) => new Date(a.data_historico).getTime() - new Date(b.data_historico).getTime());

  // Rentabilidade mensal realizada: variação não explicada pelos aportes, entre pontos consecutivos
  const taxasMensais: number[] = [];
  for (let i = 1; i < pontos.length; i++) {
    const taxa = calcularTaxaRealizada(Number(pontos[i - 1].valor_patrimonio) || 0, Number(pontos[i].valor_patrimonio) || 0, Number(pontos[i].valor_aporte) || 0);
    if (taxa !== null) taxasMensais.push(taxa);
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

  return { prazoInicialMeses, rentabilidadeRealAnual, aporteMedioRealizado };
}

/**
 * Aporte mensal necessário para atingir `capitalNecessario` em `mesesRestantes`,
 * partindo de `patrimonioAtual` rentabilizado a `taxaRealAnual` (% a.a.):
 *   i = (1 + taxa/100)^(1/12) − 1
 *   A = (FV_efetivo − P·(1+i)^n) · i / ((1+i)^n − 1)   (i > 0)
 *   A = (FV_efetivo − P) / n                            (i ≈ 0)
 * onde FV_efetivo = capitalNecessario + o valor FUTURO (capitalizado até o mês alvo) de cada
 * saque programado que acontecerá ANTES da aposentadoria (`saquesFuturos`, meses contados a
 * partir de hoje) — o dinheiro sacado para um objetivo precisa ser reposto com juros. Saques
 * posteriores à data-alvo não entram (segunda ordem; raros).
 * Retorna 0 se a meta (com saques) já está coberta; null se não há meses restantes.
 */
export function calcularAporteNecessario(
  patrimonioAtual: number,
  capitalNecessario: number,
  mesesRestantes: number,
  taxaRealAnual: number,
  saquesFuturos?: { mesesAteSaque: number; valor: number }[]
): number | null {
  if (mesesRestantes <= 0) return null;
  const i = Math.pow(1 + taxaRealAnual / 100, 1 / 12) - 1;
  const n = mesesRestantes;
  const fvSaques = (saquesFuturos || []).reduce((acc, s) => {
    if (!(s.valor > 0) || s.mesesAteSaque <= 0 || s.mesesAteSaque > n) return acc;
    return acc + s.valor * Math.pow(1 + i, n - s.mesesAteSaque);
  }, 0);
  const alvoEfetivo = capitalNecessario + fvSaques;
  if (Math.abs(i) < 1e-9) return Math.max(0, (alvoEfetivo - patrimonioAtual) / n);
  const fator = Math.pow(1 + i, n);
  return Math.max(0, ((alvoEfetivo - patrimonioAtual * fator) * i) / (fator - 1));
}

// ─── Tabela de rentabilidade mensal (ano × mês, estilo XP) ────────────────────────────────────

export interface CelulaRentabilidade {
  /** Taxa de retorno do mês (fração, ex.: 0.012 = 1,2%). */
  taxa: number;
  /**
   * Nº de meses cobertos por este cálculo (1 = normal). > 1 significa que não havia snapshot no(s)
   * mês(es) anterior(es) — a taxa mostrada é o retorno ACUMULADO desde o último snapshot
   * registrado, atribuído ao mês do snapshot mais recente (o único jeito de calcular algo com um
   * ponto de dado faltando).
   */
  gapMeses: number;
}

export interface LinhaRentabilidadeAno {
  ano: number;
  /** Índice 0 = Janeiro ... 11 = Dezembro. Null = sem snapshot suficiente para calcular esse mês. */
  meses: (CelulaRentabilidade | null)[];
  /** Retorno composto do ano (produto dos meses com dado, − 1). Null se nenhum mês tem dado. */
  totalAno: number | null;
}

/**
 * Monta a grade de rentabilidade mensal (anos em linha, meses em coluna) a partir do histórico
 * de patrimônio mensal — mesmo princípio de cálculo do `calcularPrazoERentabilidade`
 * (ver `calcularTaxaRealizada`: aproximação Dietz simples, não é uma TWR exata).
 *
 * Limitação de dados: como `historico_patrimonio` guarda no máximo 1 ponto por mês (patrimônio +
 * aporte do período), meses SEM snapshot ficam como lacuna — o retorno entre dois snapshots não
 * consecutivos é atribuído inteiro ao mês do snapshot mais recente (`gapMeses` > 1 sinaliza isso
 * na célula, para não ser lido como retorno normal de 1 mês).
 */
export function construirTabelaRentabilidade(historico: HistoricoPatrimonio[]): LinhaRentabilidadeAno[] {
  const pontos = [...(historico || [])]
    .filter(h => h.valor_patrimonio !== null && h.valor_patrimonio !== undefined)
    .sort((a, b) => new Date(a.data_historico).getTime() - new Date(b.data_historico).getTime());

  if (pontos.length < 2) return [];

  const porAnoMes = new Map<string, CelulaRentabilidade>();
  for (let i = 1; i < pontos.length; i++) {
    const taxa = calcularTaxaRealizada(Number(pontos[i - 1].valor_patrimonio) || 0, Number(pontos[i].valor_patrimonio) || 0, Number(pontos[i].valor_aporte) || 0);
    if (taxa === null) continue;

    const dataAnterior = new Date(pontos[i - 1].data_historico);
    const dataAtual = new Date(pontos[i].data_historico);
    const gapMeses = Math.max(1, Math.round((dataAtual.getFullYear() - dataAnterior.getFullYear()) * 12 + (dataAtual.getMonth() - dataAnterior.getMonth())));

    porAnoMes.set(`${dataAtual.getFullYear()}-${dataAtual.getMonth()}`, { taxa, gapMeses });
  }

  const primeiroAno = new Date(pontos[0].data_historico).getFullYear();
  const ultimoAno = new Date(pontos[pontos.length - 1].data_historico).getFullYear();
  const anos: number[] = [];
  for (let ano = primeiroAno; ano <= ultimoAno; ano++) anos.push(ano);

  return anos.map(ano => {
    const meses: (CelulaRentabilidade | null)[] = [];
    const taxasDoAno: number[] = [];
    for (let m = 0; m < 12; m++) {
      const cel = porAnoMes.get(`${ano}-${m}`) ?? null;
      meses.push(cel);
      if (cel) taxasDoAno.push(cel.taxa);
    }
    const totalAno = taxasDoAno.length > 0 ? taxasDoAno.reduce((acc, t) => acc * (1 + t), 1) - 1 : null;
    return { ano, meses, totalAno };
  });
}
