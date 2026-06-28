
export interface TermometroData {
  percentual: number;
  cor: string;
  status: 'ENGAJADO' | 'RECUPERAR' | 'GHOSTING' | 'SEM TERMÔMETRO';
  descricao: string;
}

export const calcularTermometro = (ultimaReuniao: string | null, proximaReuniao: string | null, statusAnterior?: TermometroData): TermometroData => {
  const hoje = new Date();

  // Regra I (parte 2): Se houver próxima reunião agendada e for futura, é ENGAJADO (100%)
  if (proximaReuniao && new Date(proximaReuniao) >= hoje) {
    return {
      percentual: 100,
      cor: '#10b981',
      status: 'ENGAJADO',
      descricao: 'Cliente com reunião futura agendada.'
    };
  }

  // Regras baseadas na última reunião realizada
  if (ultimaReuniao) {
    const dUltima = new Date(ultimaReuniao);
    const diffMs = hoje.getTime() - dUltima.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Regra III: Ghosting (> 90 dias)
    if (diffDays > 90) {
      return {
        percentual: 20,
        cor: '#ef4444',
        status: 'GHOSTING',
        descricao: `Mais de 90 dias sem contato (Última: ${diffDays} dias).`
      };
    }
    // Regra II: Recuperar (> 70 dias)
    if (diffDays > 70) {
      return {
        percentual: 50,
        cor: '#f59e0b',
        status: 'RECUPERAR',
        descricao: `Mais de 70 dias desde o último contato.`
      };
    }
    // Regra I: Engajado (Até 70 dias)
    return {
      percentual: 85,
      cor: '#10b981',
      status: 'ENGAJADO',
      descricao: 'Contato realizado nos últimos 70 dias.'
    };
  }

  // Regra IV: Se não houver dados mas havia status anterior, mantém o último
  if (statusAnterior && statusAnterior.status !== 'SEM TERMÔMETRO') {
    return statusAnterior;
  }

  // Caso realmente não haja dados
  return {
    percentual: 0,
    cor: '#94a3b8',
    status: 'SEM TERMÔMETRO',
    descricao: 'Agende uma reunião para iniciar o cálculo.'
  };
};
