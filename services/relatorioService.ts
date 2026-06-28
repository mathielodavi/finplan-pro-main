
import { supabase } from './supabaseClient';
import { Relatorio, RelatorioEnviado } from '../types/relatorio';

export const relatorioService = {
  async listarPorCliente(clienteId: string) {
    const { data, error } = await supabase
      .from('relatorios')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('data_geracao', { ascending: false });
    if (error) throw error;
    return data as Relatorio[];
  },

  async salvarRelatorio(relatorio: Partial<Relatorio>) {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...relatorio, consultor_id: user?.id };
    const { data, error } = await supabase
      .from('relatorios')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return data as Relatorio;
  },

  async excluirRelatorio(id: string) {
    const { error } = await supabase.from('relatorios').delete().eq('id', id);
    if (error) throw error;
  },

  async registrarEnvio(envio: Partial<RelatorioEnviado>) {
    const { data, error } = await supabase
      .from('relatorios_enviados')
      .insert([envio])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async listarEnvios(clienteId: string) {
    // Busca envios com join no relatório; filtragem por cliente feita client-side
    // pois PostgREST não suporta .eq() em FK aninhada diretamente
    const { data, error } = await supabase
      .from('relatorios_enviados')
      .select('*, relatorios(periodo, cliente_id)')
      .order('data_envio', { ascending: false });
    if (error) throw error;
    return (data || []).filter((d: any) => d.relatorios?.cliente_id === clienteId);
  },

  // STUB: Envio de e-mail não implementado. 
  // Para implementar, criar uma Supabase Edge Function com serviço de email (Resend, SendGrid, etc.)
  async enviarPorEmail(_relatorio: any, _email: string, _assunto: string, _mensagem: string) {
    throw new Error('Envio de e-mail não implementado. Configure uma Edge Function no Supabase.');
  }
};
