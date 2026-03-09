
import { supabase } from './supabaseClient';

export interface Cliente {
  id?: string;
  nome: string;
  patrimonio_total: number;
  aporte_mensal: number;
  reserva_recomendada?: number;
  estrategia_padrao_id?: string;
  tese_investimento_id?: string; // Referência para estrategias_base (Carteira Recomendada)
  bancos_ativos?: string; // Nomes dos bancos separados por vírgula
  consultor_id: string;
  empresa_id: string | null;
  data_ultima_importacao?: string;
  criado_em?: string;
  status?: string;
  observacoes?: string;
  status_atendimento?: string;
  etapa_atual?: 'Prospecção' | 'Apresentação' | 'Análise' | 'Implementação' | 'Acompanhamento';
  origem?: string | null;
  renda_mensal?: number;
  origem_id?: string | null;
  protocolo_id?: string | null;
  etiquetas_tags?: string[];
}

export interface Origem {
  id: string;
  nome: string;
  consultor_id: string;
  criado_em: string;
}

export interface OrigemTag {
  id: string;
  origem_id: string;
  nome: string;
  consultor_id: string;
  criado_em: string;
}

export const obterClientes = async () => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data;
};

export const criarCliente = async (cliente: Partial<Cliente>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const empresaId = user.user_metadata?.empresa_id || user.id;

  const { data, error } = await supabase
    .from('clientes')
    .insert([{
      ...cliente,
      consultor_id: user.id,
      empresa_id: empresaId,
      etapa_atual: cliente.etapa_atual || 'Prospecção'
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const atualizarCliente = async (id: string, dados: Partial<Cliente>) => {
  const { data, error } = await supabase
    .from('clientes')
    .update(dados)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deletarCliente = async (id: string) => {
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const buscarClientes = async (termo: string) => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .ilike('nome', `%${termo}%`)
    .order('nome', { ascending: true });

  if (error) throw error;
  return data;
};

// --- NOVAS FUNÇÕES: ORIGENS E TAGS ---

export const obterOrigens = async () => {
  const { data, error } = await supabase
    .from('origens')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data as Origem[];
};

export const criarOrigem = async (nome: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('origens')
    .insert([{ nome, consultor_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data as Origem;
};

export const obterTagsPorOrigem = async (origemId: string) => {
  const { data, error } = await supabase
    .from('origem_tags')
    .select('*')
    .eq('origem_id', origemId)
    .order('nome', { ascending: true });

  if (error) throw error;
  return data as OrigemTag[];
};

export const criarTagOrigem = async (origemId: string, nome: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('origem_tags')
    .insert([{ origem_id: origemId, nome, consultor_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data as OrigemTag;
};

export const obterClientePorId = async (id: string) => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
};
