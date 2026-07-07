import { formatarData } from './formatadores';

export type CategoriaAgenda = 'late' | 'upcoming' | 'pending';

/** Primeiro nome do cliente (para saudação nas mensagens). */
export const primeiroNome = (nome: string | null | undefined): string => {
  if (!nome) return '';
  return nome.trim().split(/\s+/)[0];
};

/**
 * Normaliza um telefone brasileiro para o formato aceito pelo wa.me (só dígitos,
 * com DDI). Remove máscara e prefixa 55 quando ausente (10–11 dígitos = DDD + número).
 * Retorna null quando não há dígitos suficientes para um número válido.
 */
export const normalizarTelefone = (telefone: string | null | undefined): string | null => {
  if (!telefone) return null;
  let digitos = telefone.replace(/\D/g, '');
  if (digitos.length < 10) return null;
  // 10 (fixo) ou 11 (celular) dígitos → nacional, prefixa DDI 55.
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  return digitos;
};

/** Extrai "HH:MM" de um timestamp de reunião no fuso de Brasília. */
const extrairHora = (dataStr: string): string => {
  const completo = formatarData(dataStr, true); // "dd/mm/aaaa HH:MM"
  const partes = completo.split(' ');
  return partes.length > 1 ? partes[partes.length - 1] : '';
};

/**
 * Monta a mensagem pré-escrita de WhatsApp conforme a situação de agenda do cliente.
 * `linkReuniao` (ex.: link do Teams extraído do evento de calendário) é anexado como
 * parágrafo extra apenas na categoria "upcoming" (reunião futura já marcada) — não faz
 * sentido oferecer o link de uma chamada para uma reunião em atraso ou ainda não marcada.
 */
export const montarMensagemAgenda = (
  categoria: CategoriaAgenda,
  nomeCliente: string,
  dataReuniao: string | null,
  linkReuniao?: string | null,
): string => {
  const nome = primeiroNome(nomeCliente);
  const data = dataReuniao ? formatarData(dataReuniao) : '';

  switch (categoria) {
    case 'late':
      return `${nome}, notei que nossa última reunião ocorreu em ${data}, é importante mantermos uma constância no nosso trabalho. Quando podemos marcar o nosso próximo atendimento?`;
    case 'upcoming': {
      const hora = dataReuniao ? extrairHora(dataReuniao) : '';
      const base = `${nome}, temos uma reunião agendada no próximo dia ${data} às ${hora}. Posso confirmar sua presença?`;
      return linkReuniao ? `${base}\n\nUtilize o link ao lado para acessar nossa chamada: ${linkReuniao}` : base;
    }
    case 'pending':
    default:
      return `${nome}, notei que não temos um agendamento formalizado. Quando podemos marcar o nosso próximo atendimento?`;
  }
};

/**
 * Constrói o link wa.me com a mensagem já codificada. Retorna null quando o
 * telefone é inválido/ausente.
 */
export const montarLinkWhatsApp = (
  telefone: string | null | undefined,
  mensagem: string,
): string | null => {
  const numero = normalizarTelefone(telefone);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
};
