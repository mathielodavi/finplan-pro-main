export interface CategoriaAgendaCliente {
  categoria: 'late' | 'upcoming' | 'pending';
  reuniao: any | null;
  qtdAtrasadas: number;
}

/**
 * Categoriza a situação de agenda de UM cliente a partir das suas reuniões.
 * Prioridade: atrasada (late) > próxima futura (upcoming) > sem nenhuma agendada (pending).
 * Usada tanto pela Agenda do Dashboard quanto pelo indicador "Próxima Ação" da lista de clientes.
 */
export function categorizarAgendaCliente(reunioes: any[], agora: Date = new Date()): CategoriaAgendaCliente {
  const agendadas = (reunioes || []).filter((r: any) => r.status === 'agendada');

  const atrasadas = agendadas
    .filter((r: any) => new Date(r.data_reuniao) < agora)
    .sort((a: any, b: any) => new Date(a.data_reuniao).getTime() - new Date(b.data_reuniao).getTime());

  const futuras = agendadas
    .filter((r: any) => new Date(r.data_reuniao) >= agora)
    .sort((a: any, b: any) => new Date(a.data_reuniao).getTime() - new Date(b.data_reuniao).getTime());

  if (atrasadas.length > 0) {
    return { categoria: 'late', reuniao: atrasadas[0], qtdAtrasadas: atrasadas.length };
  }
  if (futuras.length > 0) {
    return { categoria: 'upcoming', reuniao: futuras[0], qtdAtrasadas: 0 };
  }
  return { categoria: 'pending', reuniao: null, qtdAtrasadas: 0 };
}
