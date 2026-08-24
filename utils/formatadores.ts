

export const formatarMoeda = (valor: number | string): string => {
  const n = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (isNaN(n)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(n);
};

/** Formata percentual no padrão pt-BR: "#0,00%" (ex.: 43.4 → "43,40%"). */
export const formatarPercentual = (valor: number | string): string => {
  const n = typeof valor === 'string' ? parseFloat(valor) : valor;
  if (isNaN(n)) return '0,00%';
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};

/**
 * Formata data respeitando o fuso local (Brasília).
 * Garante que timestamps completos e strings de data simples sejam tratados sem desvios.
 */
export const formatarData = (dataStr: string | null | undefined, incluirHora: boolean = false): string => {
  if (!dataStr) return '--/--/----';
  try {
    let date: Date;
    
    // Tratamento específico para evitar que "2026-02-11" vire "10/02/2026"
    if (dataStr.length === 10) {
      const [year, month, day] = dataStr.split('-').map(Number);
      date = new Date(year, month - 1, day, 12, 0, 0); // Meio-dia local para evitar bordas de fuso
    } else {
      date = new Date(dataStr);
    }
    
    if (isNaN(date.getTime())) return '--/--/----';

    const opcoes: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo'
    };
    
    if (incluirHora) {
      // Fix: Use semicolons instead of commas for statements
      opcoes.hour = '2-digit';
      opcoes.minute = '2-digit';
    }

    // Fix: Use Intl.DateTimeFormat instead of Intl.NumberFormat for date formatting
    return new Intl.DateTimeFormat('pt-BR', opcoes).format(date);
  } catch (e) {
    return '--/--/----';
  }
};

export const desformatarMoeda = (texto: string): number => {
  const limpo = texto.replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(limpo) || 0;
};

export const normalizarTexto = (texto: string): string => {
  if (!texto) return '';
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

/**
 * Converte data para string YYYY-MM-DD sem desvios de fuso, 
 * garantindo que o dia selecionado localmente seja preservado.
 */
export const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Nº de dias corridos desde `dataStr` até hoje (idade da informação). Null se a data for inválida.
 * Usado para "atualizado há Nd" e o alerta de defasagem (>30 dias) da carteira recomendada.
 */
export const diasDesde = (dataStr: string | null | undefined): number | null => {
  if (!dataStr) return null;
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
};

/**
 * Converte um timestamp ISO para o formato aceito por <input type="datetime-local">
 * (YYYY-MM-DDTHH:mm), respeitando o fuso de Brasília — mesmo padrão usado em
 * components/Prontuario/AbaReunioes.tsx.
 */
export const paraDatetimeLocal = (dataStr: string | null | undefined): string => {
  if (!dataStr) return '';
  const date = new Date(dataStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T').substring(0, 16);
};

/**
 * Converte o valor de um <input type="datetime-local"> (YYYY-MM-DDTHH:mm, sem fuso)
 * para um timestamp ISO com o offset de Brasília (-03:00) explícito.
 */
export const deDatetimeLocalParaISO = (valor: string): string | null => {
  const partes = valor.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!partes) return null;
  const [, y, m, d, h, min] = partes;
  return `${y}-${m}-${d}T${h}:${min}:00-03:00`;
};

export const formatarCNPJ = (cnpj: string): string => {
  if (!cnpj) return '';
  const apenasNumeros = cnpj.replace(/\D/g, '');
  return apenasNumeros.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/,
    '$1.$2.$3/$4-$5'
  );
};
