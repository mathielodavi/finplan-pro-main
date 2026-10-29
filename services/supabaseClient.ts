
import { createClient } from '@supabase/supabase-js';
import { invalidarVisaoGeral } from '../utils/cacheVisaoGeral';

// Credenciais do projeto Supabase via variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios. Configure seu arquivo .env');
}

/**
 * Toda escrita no banco (POST/PATCH/PUT/DELETE no PostgREST) invalida o cache da Visão Geral.
 * Ponto único: cobre qualquer serviço atual ou futuro (contratos, clientes, parcelas, reuniões,
 * dívidas, proteção...) sem depender de cada função lembrar de invalidar.
 */
const fetchComInvalidacao: typeof fetch = async (input, init) => {
  const resposta = await fetch(input, init);
  const metodo = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (metodo !== 'GET' && metodo !== 'HEAD' && url.includes('/rest/v1/')) {
    invalidarVisaoGeral();
  }
  return resposta;
};

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  global: { fetch: fetchComInvalidacao },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    flowType: 'pkce'
  }
});
