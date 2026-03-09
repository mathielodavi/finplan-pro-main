import { supabase } from './supabaseClient';
import { DividaCredito, DividaConsorcio, PrioritizationMethod } from '../types/dividas';

export const dividasService = {
    // ---- Prioritization Method ----
    getPrioritizationMethod: async (clienteId: string): Promise<PrioritizationMethod> => {
        const { data, error } = await supabase
            .from('clientes')
            .select('prioritization_method')
            .eq('id', clienteId)
            .single();

        if (error) {
            console.error('Erro ao buscar método de priorização:', error);
            return 'avalanche';
        }
        return data?.prioritization_method || 'avalanche';
    },

    updatePrioritizationMethod: async (clienteId: string, method: PrioritizationMethod): Promise<boolean> => {
        const { error } = await supabase
            .from('clientes')
            .update({ prioritization_method: method })
            .eq('id', clienteId);

        if (error) {
            console.error('Erro ao atualizar método de priorização:', error);
            return false;
        }
        return true;
    },

    // ---- Dívidas de Crédito ----
    getCreditos: async (clienteId: string): Promise<DividaCredito[]> => {
        const { data, error } = await supabase
            .from('dividas_credito')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar dívidas de crédito:', error);
            throw error;
        }
        return data as DividaCredito[];
    },

    createCredito: async (credito: Omit<DividaCredito, 'debt_id'>): Promise<DividaCredito> => {
        const { data, error } = await supabase
            .from('dividas_credito')
            .insert(credito)
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar dívida de crédito:', error);
            throw error;
        }
        return data as DividaCredito;
    },

    updateCredito: async (debtId: string, updates: Partial<DividaCredito>): Promise<DividaCredito> => {
        const { data, error } = await supabase
            .from('dividas_credito')
            .update(updates)
            .eq('debt_id', debtId)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar dívida de crédito:', error);
            throw error;
        }
        return data as DividaCredito;
    },

    deleteCredito: async (debtId: string): Promise<boolean> => {
        const { error } = await supabase
            .from('dividas_credito')
            .delete()
            .eq('debt_id', debtId);

        if (error) {
            console.error('Erro ao deletar dívida de crédito:', error);
            throw error;
        }
        return true;
    },

    // ---- Consórcios ----
    getConsorcios: async (clienteId: string): Promise<DividaConsorcio[]> => {
        const { data, error } = await supabase
            .from('dividas_consorcio')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar consórcios:', error);
            throw error;
        }
        return data as DividaConsorcio[];
    },

    createConsorcio: async (consorcio: Omit<DividaConsorcio, 'consortium_id'>): Promise<DividaConsorcio> => {
        const { data, error } = await supabase
            .from('dividas_consorcio')
            .insert(consorcio)
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar consórcio:', error);
            throw error;
        }
        return data as DividaConsorcio;
    },

    updateConsorcio: async (consortiumId: string, updates: Partial<DividaConsorcio>): Promise<DividaConsorcio> => {
        const { data, error } = await supabase
            .from('dividas_consorcio')
            .update(updates)
            .eq('consortium_id', consortiumId)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar consórcio:', error);
            throw error;
        }
        return data as DividaConsorcio;
    },

    deleteConsorcio: async (consortiumId: string): Promise<boolean> => {
        const { error } = await supabase
            .from('dividas_consorcio')
            .delete()
            .eq('consortium_id', consortiumId);

        if (error) {
            console.error('Erro ao deletar consórcio:', error);
            throw error;
        }
        return true;
    }
};
