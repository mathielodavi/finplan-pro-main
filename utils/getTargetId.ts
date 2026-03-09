import { supabase } from '../services/supabaseClient';

/**
 * Retorna o ID do contexto do usuário atual (empresa_id ou user.id).
 * Centraliza a lógica que antes era repetida em 8+ services.
 */
export const getTargetId = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    return user.user_metadata?.empresa_id || user.id;
};
