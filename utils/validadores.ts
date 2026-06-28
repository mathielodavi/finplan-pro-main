
export const isDateValid = (inicio: string, fim?: string | null): boolean => {
  if (!fim) return true;
  const dInicio = new Date(inicio);
  const dFim = new Date(fim);
  return dFim >= dInicio;
};

export const isPositiveNumber = (valor: number): boolean => {
  return valor > 0;
};

export const validarContrato = (dados: {
  tipo: string;
  valor: number;
  data_inicio: string;
  data_fim?: string | null;
}) => {
  const erros: string[] = [];

  if (!['planejamento', 'extra'].includes(dados.tipo)) {
    erros.push('Tipo de contrato inválido.');
  }

  if (!isPositiveNumber(dados.valor)) {
    erros.push('O valor do contrato deve ser maior que zero.');
  }

  if (!dados.data_inicio) {
    erros.push('Data de início é obrigatória.');
  }

  if (!isDateValid(dados.data_inicio, dados.data_fim)) {
    erros.push('A data de término não pode ser anterior à data de início.');
  }

  return {
    valido: erros.length === 0,
    erros
  };
};
