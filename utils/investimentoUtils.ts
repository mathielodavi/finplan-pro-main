
export const calcularIndependencia = (rendaDesejada: number, taxaAnual: number, patrimonioAtual: number, aporteMensal: number) => {
  const taxaMensal = Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
  const patrimonioNecessario = (rendaDesejada * 12) / (taxaAnual / 100);
  
  // N = log((FV*i + PMT)/(PV*i + PMT)) / log(1+i)
  let mesesParaMeta = 0;
  if (taxaMensal > 0) {
    mesesParaMeta = Math.log((patrimonioNecessario * taxaMensal + aporteMensal) / (patrimonioAtual * taxaMensal + aporteMensal)) / Math.log(1 + taxaMensal);
  } else {
    mesesParaMeta = (patrimonioNecessario - patrimonioAtual) / aporteMensal;
  }

  const anos = Math.floor(mesesParaMeta / 12);
  const meses = Math.ceil(mesesParaMeta % 12);

  return {
    patrimonioNecessario,
    tempoEstimado: `${anos > 0 ? anos + ' anos' : ''} ${meses > 0 ? meses + ' meses' : ''}`.trim() || 'Meta atingida!',
    aporteNecessario: Math.max(0, (patrimonioNecessario - patrimonioAtual) / Math.max(1, mesesParaMeta))
  };
};

export const getCorProgresso = (percentual: number) => {
  if (percentual < 25) return 'bg-red-500';
  if (percentual < 50) return 'bg-orange-500';
  if (percentual < 75) return 'bg-yellow-500';
  return 'bg-green-500';
};

export const formatarPercentual = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 }).format(valor / 100);
};
