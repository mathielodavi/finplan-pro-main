
import { supabase } from './supabaseClient';

/**
 * Registra um novo usuário com papel de MASTER por padrão para uso individual.
 */
export const signUp = async (email: string, password: string, name: string, role: string = 'MASTER') => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/#/login`,
      data: {
        full_name: name,
        role: role // Este campo será lido pelo trigger SQL 'handle_new_user'
      }
    }
  });

  if (error) {
    if (error.message.includes('already registered')) {
      throw new Error('Este email já está cadastrado no sistema.');
    }
    throw error;
  }
  return data;
};

/**
 * Autentica o usuário e inicia a sessão persistente.
 */
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('Email ou senha incorretos.');
    }
    throw error;
  }
  return data;
};

/**
 * Finaliza a sessão e limpa o localStorage.
 */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  // Remove apenas as chaves de sessão do Supabase, preservando preferências do usuário
  Object.keys(localStorage)
    .filter(key => key.startsWith('sb-'))
    .forEach(key => localStorage.removeItem(key));
};

/**
 * Inicia o fluxo de recuperação de senha por email.
 */
export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/#/redefinir-senha`,
  });
  if (error) throw error;
};

/**
 * Atualiza a senha do usuário logado.
 */
export const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  });
  if (error) throw error;
};

/**
 * Retorna os dados do usuário atual ou null.
 */
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

/**
 * Obtém a sessão atual.
 */
export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};
