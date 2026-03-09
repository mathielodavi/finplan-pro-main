
import { supabase } from './supabaseClient';

export interface Reuniao {
  id?: string;
  cliente_id: string;
  data_reuniao: string;
  notas: string;
  status: 'agendada' | 'realizada' | 'cancelada' | 'reagendada';
  criado_em?: string;
}

export const reuniaoService = {
  async getPorCliente(clienteId: string) {
    let query = supabase
      .from('reunioes')
      .select('*')
      .order('data_reuniao', { ascending: false });
    
    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data as Reuniao[];
  },

  async salvar(reuniao: Partial<Reuniao>) {
    // Limpeza de payload para evitar conflitos com colunas de auditoria do banco
    const { id, criado_em, ...payload } = reuniao as any;

    if (id) {
      const { data, error } = await supabase
        .from('reunioes')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('reunioes')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  async excluir(id: string) {
    const { error } = await supabase.from('reunioes').delete().eq('id', id);
    if (error) throw error;
  }
};
