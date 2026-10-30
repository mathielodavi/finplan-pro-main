// supabase/functions/sync-calendarios/logica.ts
// Lógica pura do sync de calendários (sem Deno/Supabase, testável em Node): parser de ICS,
// expansão de recorrência (RRULE) e casamento evento → cliente.

export interface Cliente {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
}

export interface EventoIcs {
  uid: string | null;
  dtstart: Date;
  summary: string;
  description: string;
  /** E-mails de ATTENDEE. Pode incluir o próprio organizador (o Google faz isso). */
  attendeeEmails: string[];
  organizerEmail: string | null;
  linkReuniao: string | null;
  rrule: string | null;
  /** Ocorrências removidas da série (EXDATE), em ms. */
  exdates: number[];
  /** Presente quando o VEVENT é uma exceção (ocorrência alterada) de uma série. */
  recurrenceId: number | null;
  cancelado: boolean;
}

export interface EventoSemCliente {
  data: string;
  titulo: string;
  motivo: string;
}

// ─── Utilidades de texto (equivalente a utils/formatadores.ts normalizarTexto) ─

export function normalizarTexto(texto: string): string {
  if (!texto) return "";
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function somenteDigitos(texto: string): string {
  return (texto || "").replace(/\D/g, "");
}

function desescaparIcsTexto(valor: string): string {
  return valor
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

// Link de chamada: Outlook/Exchange costuma incluir X-MICROSOFT-SKYPETEAMSMEETINGURL e o Google,
// X-GOOGLE-CONFERENCE; alguns feeds só trazem o link no corpo do DESCRIPTION — nesse caso buscamos
// a URL padrão de cada serviço como último recurso.
function extrairLinkDaDescricao(descricao: string): string | null {
  const m = descricao.match(
    /https:\/\/(?:teams\.microsoft\.com\/l\/meetup-join\/|meet\.google\.com\/|[\w.-]*zoom\.us\/j\/)[^\s"'<>\]]+/i
  );
  return m ? m[0] : null;
}

// ─── Parser manual de ICS (VEVENT) ───────────────────────────────────────────
// Unfold de linhas dobradas, DTSTART em DATE ou DATE-TIME (UTC ou "flutuante"), SUMMARY,
// DESCRIPTION, ATTENDEE/ORGANIZER (mailto:), RRULE/EXDATE/RECURRENCE-ID e STATUS.

function desdobrarLinhasIcs(texto: string): string[] {
  const linhasCru = texto.split(/\r\n|\n|\r/);
  const linhas: string[] = [];
  for (const linha of linhasCru) {
    if ((linha.startsWith(" ") || linha.startsWith("\t")) && linhas.length > 0) {
      linhas[linhas.length - 1] += linha.slice(1);
    } else {
      linhas.push(linha);
    }
  }
  return linhas;
}

// TZID's comuns para o fuso de Brasília (Windows e IANA) — Outlook/Exchange
// costuma exportar "E. South America Standard Time" em vez do IANA padrão.
// Brasil não observa horário de verão desde 2019, então -03:00 fixo é seguro.
function ehFusoBrasilia(tzid: string): boolean {
  const t = normalizarTexto(tzid);
  return t.includes("sao_paulo") || t.includes("brasilia") || t.includes("south america") || t.includes("utc-03");
}

export function parsearDataIcs(valor: string, paramsDaChave?: string): Date | null {
  const v = valor.trim();
  // DATE-TIME: YYYYMMDDTHHMMSS[Z]
  const mDateTime = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (mDateTime) {
    const [, ano, mes, dia, hora, min, seg, z] = mDateTime;
    if (z) {
      return new Date(Date.UTC(+ano, +mes - 1, +dia, +hora, +min, +seg));
    }
    const tzidMatch = paramsDaChave?.match(/TZID=(?:"([^"]+)"|([^;:]+))/i);
    const tzid = tzidMatch ? (tzidMatch[1] || tzidMatch[2]) : null;
    if (tzid && ehFusoBrasilia(tzid)) {
      // Horário local de Brasília (UTC-3) → converte para UTC de verdade.
      return new Date(Date.UTC(+ano, +mes - 1, +dia, +hora + 3, +min, +seg));
    }
    // TZID não reconhecido — mantém como horário "flutuante" no fuso do
    // servidor (comportamento anterior, mais seguro que assumir errado).
    return new Date(+ano, +mes - 1, +dia, +hora, +min, +seg);
  }
  // DATE (evento de dia inteiro): YYYYMMDD
  const mDate = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (mDate) {
    const [, ano, mes, dia] = mDate;
    return new Date(+ano, +mes - 1, +dia, 0, 0, 0);
  }
  return null;
}

/** Primeiro ":" fora de aspas — TZID pode vir como TZID="(UTC-03:00) Brasília":2026... */
function posicaoSeparador(linha: string): number {
  let emAspas = false;
  for (let i = 0; i < linha.length; i++) {
    if (linha[i] === '"') emAspas = !emAspas;
    else if (linha[i] === ":" && !emAspas) return i;
  }
  return -1;
}

export function parsearEventosIcs(icsTexto: string): EventoIcs[] {
  const linhas = desdobrarLinhasIcs(icsTexto);
  const eventos: EventoIcs[] = [];

  let dentroDeEvento = false;
  let atual: (Omit<EventoIcs, "dtstart" | "linkReuniao"> & { dtstart: Date | null; link: string | null }) | null = null;

  for (const linhaRaw of linhas) {
    const linha = linhaRaw.trim();
    if (linha === "BEGIN:VEVENT") {
      dentroDeEvento = true;
      atual = {
        uid: null, dtstart: null, summary: "", description: "", attendeeEmails: [], organizerEmail: null,
        link: null, rrule: null, exdates: [], recurrenceId: null, cancelado: false,
      };
      continue;
    }
    if (linha === "END:VEVENT") {
      if (atual && atual.dtstart) {
        const description = desescaparIcsTexto(atual.description);
        const { link, ...resto } = atual;
        eventos.push({
          ...resto,
          dtstart: atual.dtstart,
          summary: desescaparIcsTexto(atual.summary),
          description,
          linkReuniao: link ? desescaparIcsTexto(link) : extrairLinkDaDescricao(description),
        });
      }
      dentroDeEvento = false;
      atual = null;
      continue;
    }
    if (!dentroDeEvento || !atual) continue;

    const idx = posicaoSeparador(linha);
    if (idx === -1) continue;
    const chaveComParams = linha.slice(0, idx);
    const valor = linha.slice(idx + 1);
    const chave = chaveComParams.split(";")[0].toUpperCase();

    if (chave === "UID") {
      atual.uid = valor.trim();
    } else if (chave === "DTSTART") {
      atual.dtstart = parsearDataIcs(valor, chaveComParams);
    } else if (chave === "SUMMARY") {
      atual.summary = valor;
    } else if (chave === "DESCRIPTION") {
      atual.description = valor;
    } else if (chave === "X-MICROSOFT-SKYPETEAMSMEETINGURL" || chave === "X-GOOGLE-CONFERENCE") {
      atual.link = valor.trim();
    } else if (chave === "RRULE") {
      atual.rrule = valor.trim();
    } else if (chave === "EXDATE") {
      for (const parte of valor.split(",")) {
        const d = parsearDataIcs(parte, chaveComParams);
        if (d) atual.exdates.push(d.getTime());
      }
    } else if (chave === "RECURRENCE-ID") {
      const d = parsearDataIcs(valor, chaveComParams);
      if (d) atual.recurrenceId = d.getTime();
    } else if (chave === "STATUS") {
      atual.cancelado = valor.trim().toUpperCase() === "CANCELLED";
    } else if (chave === "ATTENDEE" || chave === "ORGANIZER") {
      const mMailto = valor.match(/mailto:(.+)/i);
      if (mMailto) {
        const email = mMailto[1].trim().toLowerCase();
        if (chave === "ORGANIZER") atual.organizerEmail = email;
        else atual.attendeeEmails.push(email);
      }
    }
  }

  return eventos;
}

// ─── Recorrência (RRULE) ─────────────────────────────────────────────────────
// Cálculos no horário de Brasília (UTC-3 fixo), para o dia da semana não virar à noite.

const FUSO_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;
const LIMITE_ITERACOES = 3000; // guarda contra regra malformada
const DIAS_SEMANA = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

interface DiaRegra { ordinal: number | null; dia: number }

function parsearByDay(valor: string | undefined): DiaRegra[] {
  if (!valor) return [];
  return valor.split(",").flatMap((parte) => {
    const m = parte.trim().match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i);
    if (!m) return [];
    return [{ ordinal: m[1] ? parseInt(m[1], 10) : null, dia: DIAS_SEMANA.indexOf(m[2].toUpperCase()) }];
  });
}

/** Dias do mês (UTC do "horário local") que atendem a um BYDAY como 2TU, -1FR ou TU. */
function diasDoMesPorByDay(ano: number, mes: number, regras: DiaRegra[]): number[] {
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const dias: number[] = [];
  for (const r of regras) {
    const doMes: number[] = [];
    for (let d = 1; d <= ultimoDia; d++) {
      if (new Date(Date.UTC(ano, mes, d)).getUTCDay() === r.dia) doMes.push(d);
    }
    if (r.ordinal === null) dias.push(...doMes);
    else {
      const escolhido = r.ordinal > 0 ? doMes[r.ordinal - 1] : doMes[doMes.length + r.ordinal];
      if (escolhido) dias.push(escolhido);
    }
  }
  return dias.sort((a, b) => a - b);
}

/** Ocorrências da regra em ordem, a partir do início da série (no máximo LIMITE_ITERACOES períodos). */
function* ocorrencias(inicio: Date, rrule: string): Generator<Date> {
  const partes = Object.fromEntries(
    rrule.split(";").map((p) => p.split("=")).map(([k, v]) => [k.toUpperCase(), v])
  ) as Record<string, string | undefined>;

  const freq = (partes.FREQ || "").toUpperCase();
  const intervalo = Math.max(1, parseInt(partes.INTERVAL || "1", 10) || 1);
  const limite = partes.COUNT ? parseInt(partes.COUNT, 10) : Infinity;
  const ate = partes.UNTIL ? parsearDataIcs(partes.UNTIL, "TZID=America/Sao_Paulo") : null;
  const byDay = parsearByDay(partes.BYDAY);
  const byMonthDay = partes.BYMONTHDAY ? parseInt(partes.BYMONTHDAY, 10) : null;

  const local = new Date(inicio.getTime() - FUSO_MS);
  const ano0 = local.getUTCFullYear();
  const mes0 = local.getUTCMonth();
  const dia0 = local.getUTCDate();
  const horaMs = local.getTime() - Date.UTC(ano0, mes0, dia0);

  const emUtc = (ano: number, mes: number, dia: number) => new Date(Date.UTC(ano, mes, dia) + horaMs + FUSO_MS);

  let emitidas = 0;
  const emitir = function* (candidatas: Date[]): Generator<Date, boolean> {
    for (const c of candidatas) {
      if (c.getTime() < inicio.getTime()) continue;
      if (ate && c.getTime() > ate.getTime()) return true;
      if (emitidas >= limite) return true;
      emitidas++;
      yield c;
    }
    return false;
  };

  for (let k = 0; k < LIMITE_ITERACOES; k++) {
    let candidatas: Date[] = [];
    if (freq === "DAILY") {
      candidatas = [emUtc(ano0, mes0, dia0 + k * intervalo)];
    } else if (freq === "WEEKLY") {
      // Semana iniciando na segunda (WKST padrão do RFC 5545).
      const diaSemana0 = (local.getUTCDay() + 6) % 7;
      const segunda = dia0 - diaSemana0 + k * intervalo * 7;
      const dias = byDay.length > 0 ? byDay.map((d) => (d.dia + 6) % 7) : [diaSemana0];
      candidatas = [...dias].sort((a, b) => a - b).map((d) => emUtc(ano0, mes0, segunda + d));
    } else if (freq === "MONTHLY") {
      const base = new Date(Date.UTC(ano0, mes0 + k * intervalo, 1));
      const ano = base.getUTCFullYear();
      const mes = base.getUTCMonth();
      const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
      const dias = byDay.length > 0 ? diasDoMesPorByDay(ano, mes, byDay) : [byMonthDay ?? dia0];
      candidatas = dias.filter((d) => d >= 1 && d <= ultimoDia).map((d) => emUtc(ano, mes, d));
    } else if (freq === "YEARLY") {
      const ano = ano0 + k * intervalo;
      const ultimoDia = new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
      candidatas = dia0 <= ultimoDia ? [emUtc(ano, mes0, dia0)] : [];
    } else {
      return; // FREQ não suportada
    }
    const fim = yield* emitir(candidatas);
    if (fim) return;
  }
}

/** Próxima ocorrência da série a partir de `desde`, ignorando as excluídas. */
export function proximaOcorrencia(evento: EventoIcs, desde: Date, excluidas: Set<number>): Date | null {
  if (!evento.rrule) return null;
  for (const c of ocorrencias(evento.dtstart, evento.rrule)) {
    if (c.getTime() >= desde.getTime() && !excluidas.has(c.getTime())) return c;
  }
  return null;
}

/**
 * Eventos a partir de `desde`: remove cancelados, troca cada série pela próxima ocorrência e
 * tira da série as ocorrências alteradas (o VEVENT com RECURRENCE-ID já as representa).
 */
export function eventosAPartirDe(eventos: EventoIcs[], desde: Date): EventoIcs[] {
  const excluidasPorUid = new Map<string, Set<number>>();
  for (const e of eventos) {
    if (e.uid && e.recurrenceId !== null) {
      const set = excluidasPorUid.get(e.uid) ?? new Set<number>();
      set.add(e.recurrenceId);
      excluidasPorUid.set(e.uid, set);
    }
  }

  const resultado: EventoIcs[] = [];
  for (const e of eventos) {
    if (e.cancelado) continue;
    if (e.rrule && e.recurrenceId === null) {
      const excluidas = new Set<number>([...e.exdates, ...(excluidasPorUid.get(e.uid ?? "") ?? [])]);
      const proxima = proximaOcorrencia(e, desde, excluidas);
      if (proxima) resultado.push({ ...e, dtstart: proxima });
    } else if (e.dtstart.getTime() >= desde.getTime()) {
      resultado.push(e);
    }
  }
  return resultado;
}

// ─── Matching evento → cliente ───────────────────────────────────────────────
// Prioridade: e-mail do participante > nome do cliente no título/descrição >
// telefone do cliente na descrição.

function escaparRegExp(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function primeiroNome(nome: string): string {
  return normalizarTexto(nome).split(/\s+/)[0] || "";
}

function contemPalavra(texto: string, palavra: string): boolean {
  return new RegExp(`\\b${escaparRegExp(palavra)}\\b`).test(texto);
}

/**
 * Compara o nome do cliente (como cadastrado no CRM, que pode ter mais partes —
 * ex.: "Cynthia Honorato Val") ao texto do evento (que costuma ter só parte do
 * nome, ex.: "Cynthia Honorato" digitado à mão no calendário). Em vez de exigir
 * o nome completo como substring exata, exige que pelo menos 2 das palavras
 * significativas do nome (ou todas, se o nome só tiver 1-2 palavras) apareçam
 * como palavra inteira em qualquer lugar do texto, em qualquer ordem.
 */
function nomeCompativelComTexto(nomeCliente: string, texto: string): boolean {
  const tokens = normalizarTexto(nomeCliente).split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  const textoNormalizado = normalizarTexto(texto);
  const presentes = tokens.filter((t) => contemPalavra(textoNormalizado, t)).length;
  const minimoNecessario = Math.min(2, tokens.length);
  return presentes >= minimoNecessario;
}

/** Convidados "de verdade": sem o organizador e sem o próprio consultor (dono do calendário). */
function convidados(e: EventoIcs, emailsProprios: Set<string>): string[] {
  return e.attendeeEmails.filter((a) => a !== e.organizerEmail && !emailsProprios.has(a));
}

function mencionaCliente(cliente: Cliente, e: EventoIcs, contagemPrimeiroNome: Map<string, number>): boolean {
  if (!cliente.nome) return false;
  const texto = `${e.summary} ${e.description}`;
  if (nomeCompativelComTexto(cliente.nome, texto)) return true;
  // Só aceita casar pelo primeiro nome isolado (ex.: evento só diz "Raquel", sem o sobrenome)
  // quando esse primeiro nome é único entre os clientes deste consultor — evita ambiguidade
  // entre clientes que compartilham o mesmo nome.
  const pn = primeiroNome(cliente.nome);
  if (pn.length >= 3 && (contagemPrimeiroNome.get(pn) || 0) === 1) {
    return contemPalavra(normalizarTexto(texto), pn);
  }
  return false;
}

/**
 * Evento tem outros convidados e o cliente não está entre eles? Provavelmente é a reunião de outra
 * pessoa que só menciona o nome do cliente de passagem (ex.: "Follow-up sobre Cynthia") — não casa
 * por nome. O organizador e o próprio consultor não contam: um compromisso que o consultor criou
 * sozinho, com o nome do cliente no título, é justamente o caso que deve casar.
 */
function bloqueadoPorConvidados(cliente: Cliente, e: EventoIcs, emailsProprios: Set<string>): boolean {
  const emailCliente = cliente.email ? cliente.email.trim().toLowerCase() : null;
  if (!emailCliente) return false;
  const lista = convidados(e, emailsProprios);
  return lista.length > 0 && !lista.includes(emailCliente);
}

export function encontrarEventoCasado(
  cliente: Cliente,
  eventos: EventoIcs[],
  contagemPrimeiroNome: Map<string, number>,
  emailsProprios: Set<string> = new Set()
): EventoIcs | null {
  const candidatos: EventoIcs[] = [];
  const emailCliente = cliente.email ? cliente.email.trim().toLowerCase() : null;

  if (emailCliente) {
    candidatos.push(...eventos.filter((e) => e.attendeeEmails.includes(emailCliente) || e.organizerEmail === emailCliente));
  }
  if (candidatos.length === 0 && cliente.nome) {
    candidatos.push(
      ...eventos.filter((e) =>
        !bloqueadoPorConvidados(cliente, e, emailsProprios) && mencionaCliente(cliente, e, contagemPrimeiroNome)
      )
    );
  }
  if (candidatos.length === 0 && cliente.telefone) {
    const telDigitos = somenteDigitos(cliente.telefone);
    if (telDigitos.length >= 8) {
      candidatos.push(...eventos.filter((e) => somenteDigitos(`${e.summary} ${e.description}`).includes(telDigitos)));
    }
  }

  if (candidatos.length === 0) return null;
  // O compromisso mais próximo: é ele que a Agenda precisa mostrar.
  return candidatos.reduce((prox, atual) => (atual.dtstart < prox.dtstart ? atual : prox));
}

/** Por que um evento futuro não casou com nenhum cliente (diagnóstico da tela de Configurações). */
export function motivoSemCliente(
  e: EventoIcs,
  clientes: Cliente[],
  contagemPrimeiroNome: Map<string, number>,
  emailsProprios: Set<string>
): string {
  const bloqueado = clientes.find((c) => mencionaCliente(c, e, contagemPrimeiroNome) && bloqueadoPorConvidados(c, e, emailsProprios));
  if (bloqueado) return `Cita ${bloqueado.nome}, mas o e-mail cadastrado não está entre os convidados`;
  return "Nenhum cliente com esse nome, e-mail ou telefone";
}
