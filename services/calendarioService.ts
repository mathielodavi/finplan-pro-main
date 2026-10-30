
import { supabase } from './supabaseClient';
import { invalidarVisaoGeral } from '../utils/cacheVisaoGeral';

export type CalendarioProvedor = 'google' | 'microsoft' | 'ics';

export interface CalendarioConexao {
  id: string;
  consultor_id: string;
  provedor: CalendarioProvedor;
  ics_url: string;
  ativo: boolean;
  ultima_sync: string | null;
  ultimo_erro: string | null;
  ultimo_diagnostico?: DiagnosticoCalendario | null;
  criado_em?: string;
}

/** Resultado da última sincronização: gravado pela edge function, visível só ao dono da conexão. */
export interface DiagnosticoCalendario {
  eventos_futuros: number;
  clientes_casados: number;
  sem_cliente: { data: string; titulo: string; motivo: string }[];
}

export const calendarioService = {
  /** Busca a conexão do consultor logado (no máximo uma). */
  async getConexao(): Promise<CalendarioConexao | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from('calendario_conexoes')
      .select('*')
      .eq('consultor_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Cria ou atualiza a conexão do consultor logado. */
  async salvarConexao(ics_url: string, provedor: CalendarioProvedor): Promise<CalendarioConexao> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const existente = await this.getConexao();
    const payload = { consultor_id: user.id, provedor, ics_url, ativo: true };

    const { data, error } = existente
      ? await supabase.from('calendario_conexoes').update(payload).eq('id', existente.id).select().single()
      : await supabase.from('calendario_conexoes').insert([payload]).select().single();

    if (error) throw error;
    return data;
  },

  async removerConexao(id: string): Promise<void> {
    const { error } = await supabase.from('calendario_conexoes').delete().eq('id', id);
    if (error) throw error;
  },

  /** Dispara a sincronização imediatamente (sem esperar o cron), via edge function. */
  async sincronizarAgora(): Promise<{ ok: boolean; erro?: string }> {
    const { data, error } = await supabase.functions.invoke('sync-calendarios', { body: {} });
    // A function grava em reunioes/clientes pelo lado do servidor, sem passar pelo fetch do cliente.
    invalidarVisaoGeral();
    if (error) return { ok: false, erro: error.message };
    // A function responde 200 mesmo com falha em uma conexão: o erro real vem em `conexoes_com_erro`.
    if (data?.conexoes_com_erro > 0) {
      const erro = data.detalhes?.find((d: any) => !d.ok)?.erro;
      return { ok: false, erro: erro || 'Falha ao sincronizar o calendário.' };
    }
    return { ok: true };
  },
};
