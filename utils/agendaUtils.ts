export interface CategoriaAgendaCliente {
  categoria: 'late' | 'upcoming' | 'pending';
  reuniao: any | null;
  qtdAtrasadas: number;
  /** true quando a reunião exibida (`reuniao`) ocorre hoje — usado para colorir o
   *  indicador em amarelo ("Hoje") em vez do neutro padrão de "Agendada". */
  atencaoHoje: boolean;
}

const UMA_HORA_MS = 60 * 60 * 1000;

function ehMesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Categoriza a situação de agenda de UM cliente a partir das suas reuniões.
 * Prioridade: atrasada (late) > próxima futura (upcoming) > sem nenhuma agendada (pending).
 * Usada tanto pela Agenda do Dashboard quanto pelo indicador "Próxima Ação" da lista de clientes.
 *
 * Janela de tolerância: uma reunião de HOJE só é considerada "atrasada" depois de passar
 * mais de 1h do horário marcado. Antes disso (inclusive se já passou o horário, mas há
 * menos de 1h), ela continua em "upcoming" — a UI sinaliza esse caso com `atencaoHoje`.
 * Reuniões de dias anteriores a hoje continuam sem tolerância (atrasada imediatamente).
 */
export function categorizarAgendaCliente(reunioes: any[], agora: Date = new Date()): CategoriaAgendaCliente {
  const agendadas = (reunioes || []).filter((r: any) => r.status === 'agendada');

  const passadas = agendadas.filter((r: any) => new Date(r.data_reuniao) < agora);
  const futuras = agendadas.filter((r: any) => new Date(r.data_reuniao) >= agora);

  const atrasadas: any[] = [];
  const hojeDentroDaJanela: any[] = [];
  passadas.forEach((r: any) => {
    const dt = new Date(r.data_reuniao);
    const diffMs = agora.getTime() - dt.getTime();
    if (ehMesmoDia(dt, agora) && diffMs <= UMA_HORA_MS) {
      hojeDentroDaJanela.push(r);
    } else {
      atrasadas.push(r);
    }
  });
  atrasadas.sort((a: any, b: any) => new Date(a.data_reuniao).getTime() - new Date(b.data_reuniao).getTime());

  const proximas = [...hojeDentroDaJanela, ...futuras]
    .sort((a: any, b: any) => new Date(a.data_reuniao).getTime() - new Date(b.data_reuniao).getTime());

  if (atrasadas.length > 0) {
    return { categoria: 'late', reuniao: atrasadas[0], qtdAtrasadas: atrasadas.length, atencaoHoje: false };
  }
  if (proximas.length > 0) {
    const reuniao = proximas[0];
    return { categoria: 'upcoming', reuniao, qtdAtrasadas: 0, atencaoHoje: ehMesmoDia(new Date(reuniao.data_reuniao), agora) };
  }
  return { categoria: 'pending', reuniao: null, qtdAtrasadas: 0, atencaoHoje: false };
}
