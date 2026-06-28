
import { supabase } from './supabaseClient';

export const acompanhamentoService = {
  async getItensCliente(clienteId: string) {
    const { data, error } = await supabase
      .from('clientes_acompanhamento_itens')
      .select('*, fase:padroes_acompanhamento_fases(nome_fase)')
      .eq('cliente_id', clienteId)
      .order('criado_em', { ascending: true })
      .order('ordem', { ascending: true });
    if (error) throw error;
    return data;
  },

  async iniciarRoteiroPorNome(clienteId: string, etapaNome: string) {
    // 1. Busca o template/roteiro que corresponde ao nome da etapa
    const { data: roteiroPadrao } = await supabase
      .from('padroes_acompanhamento')
      .select('id, nome')
      .ilike('nome', `%${etapaNome}%`)
      .maybeSingle();

    if (!roteiroPadrao) return;

    // 2. Busca todos os itens desse roteiro específico
    const { data: itensPadrao } = await supabase
      .from('padroes_acompanhamento_itens')
      .select('*')
      .eq('padrao_acompanhamento_id', roteiroPadrao.id);

    if (itensPadrao && itensPadrao.length > 0) {
      const novosItens = itensPadrao.map(it => ({
        cliente_id: clienteId,
        fase_id: it.fase_id,
        descricao: it.descricao,
        concluido: false,
        ordem: it.ordem,
        // Adicionamos a data para garantir a ordem no histórico
        criado_em: new Date().toISOString()
      }));
      
      await supabase.from('clientes_acompanhamento_itens').insert(novosItens);
    }
  },

  async aplicarPadrao(clienteId: string, padraoId: string) {
    const { data: itensPadrao, error: fetchError } = await supabase
      .from('padroes_acompanhamento_itens')
      .select('*')
      .eq('padrao_acompanhamento_id', padraoId);

    if (fetchError) throw fetchError;

    if (itensPadrao && itensPadrao.length > 0) {
      const novosItens = itensPadrao.map(it => ({
        cliente_id: clienteId,
        fase_id: it.fase_id,
        descricao: it.descricao,
        concluido: false,
        ordem: it.ordem,
        criado_em: new Date().toISOString()
      }));
      
      const { error: insertError } = await supabase
        .from('clientes_acompanhamento_itens')
        .insert(novosItens);
        
      if (insertError) throw insertError;
    }
    return true;
  },

  async atualizarStatus(id: string, concluido: boolean) {
    const { error } = await supabase
      .from('clientes_acompanhamento_itens')
      .update({ concluido })
      .eq('id', id);
    if (error) throw error;
  },

  async adicionarItemManual(item: any) {
    const { data, error } = await supabase
      .from('clientes_acompanhamento_itens')
      .insert([item])
      .select();
    if (error) throw error;
    return data;
  },

  async excluirItem(id: string) {
    const { error } = await supabase
      .from('clientes_acompanhamento_itens')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
