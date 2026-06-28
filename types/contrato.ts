
export type ContratoTipo = 'planejamento' | 'extra';
export type ContratoStatus = 'ativo' | 'inativo' | 'concluido' | 'cancelado';
export type FormaPagamento = 'vista' | 'parcelado';

export interface Contrato {
  id: string;
  cliente_id: string;
  tipo: ContratoTipo;
  descricao: string;
  valor: number;
  data_inicio: string;
  data_vencimento?: string; 
  data_fim?: string | null;
  status: ContratoStatus;
  forma_pagamento: FormaPagamento;
  prazo_meses: number;
  prazo_recebimento_dias: number; // Novo campo
  repasse_percentual: number;
  // Fix: Adicionado padrao_id para suportar o vínculo com modelos de contrato em contratoService.ts
  padrao_id?: string | null;
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
