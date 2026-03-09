
export interface Relatorio {
  id?: string;
  cliente_id: string;
  consultor_id: string;
  data_geracao: string;
  periodo: string;
  secoes_incluidas: string[];
  arquivo_url?: string;
  criado_em?: string;
}

export interface RelatorioEnviado {
  id?: string;
  relatorio_id: string;
  email_destinatario: string;
  data_envio: string;
  assunto: string;
  mensagem?: string;
  criado_em?: string;
}

export type SecaoRelatorio = 
  | 'resumo' 
  | 'cliente' 
  | 'contratos' 
  | 'alocacao' 
  | 'ativos' 
  | 'projetos' 
  | 'independencia' 
  | 'rebalanceamento' 
  | 'reunioes' 
  | 'analise';
