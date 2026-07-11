
export type ContratoTipo = 'planejamento' | 'extra';
export type ContratoStatus = 'ativo' | 'inativo' | 'concluido' | 'cancelado';
export type FormaPagamento = 'vista' | 'parcelado';
export type TipoEncerramento = 'nao_renovacao' | 'cancelamento_antecipado';

export interface Contrato {
  id: string;
  cliente_id: string;
  tipo: ContratoTipo;
  descricao: string;
  valor: number;
  data_inicio: string;
  data_vencimento?: string; 
  data_fim?: string | null;
  /** Data em que o cliente ficou inadimplente. Se anterior ao cancelamento, o corte
   *  de parcelas respeita esta data, sem aplicar a carência (prazo de recebimento). */
  data_inadimplencia?: string | null;
  /** Início da pausa por inadimplência em vigor (espelho do episódio aberto). Null = não pausado. */
  pausado_em?: string | null;
  /** Dias acumulados que a vigência/parcelas foram empurradas por pausas de inadimplência. */
  dias_prorrogados?: number;
  status: ContratoStatus;
  forma_pagamento: FormaPagamento;
  prazo_meses: number;
  prazo_recebimento_dias: number; // Novo campo
  repasse_percentual: number;
  // Fix: Adicionado padrao_id para suportar o vínculo com modelos de contrato em contratoService.ts
  padrao_id?: string | null;
  // Classificação de encerramento (distratos) e resgate (renovação tardia)
  tipo_encerramento?: TipoEncerramento | null;
  is_resgate?: boolean;
  // true quando o advisor já tomou uma decisão explícita (renovar / confirmar não
  // renovação) via o fluxo de Renovação — usado para tirar o contrato da lista de
  // "Vencidos" mesmo quando a classificação de tipo_encerramento já existe (ex.: via
  // backfill histórico) mas a decisão real ainda não tinha sido tomada.
  resolvido_renovacao?: boolean;
  consultor_id?: string;
  empresa_id?: string;
  criado_em?: string;
  atualizado_em?: string;
}

export interface Auditoria {
  id: string;
  usuario_id: string;
  tabela: string;
  registro_id: string;
  acao: 'INSERT' | 'UPDATE' | 'DELETE';
  dados_anteriores?: any;
  dados_novos?: any;
  criado_em: string;
}
