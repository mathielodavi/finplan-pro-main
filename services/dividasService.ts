import { supabase } from './supabaseClient';
import { DividaCredito, DividaConsorcio, PrioritizationMethod } from '../types/dividas';
import { indexadoresService, IndiceMercado } from './indexadoresService';
import { calcularSaldoEParcelasAtual, formatarDebtType, taxaCorrecaoEfetiva } from '../utils/calculosDividas';

export interface LinhaDivida {
    id: string;
    cliente_id: string;
    rotulo: string;
    tipo: string;
    instituicao: string;
    saldo: number;
}

export interface DividasCliente {
    id: string;
    nome: string;
    saldo: number;
    linhas: LinhaDivida[];
}

/** Créditos e consórcios de todos os clientes, com o saldo atual de cada um. */
const carregarDividas = async (): Promise<LinhaDivida[]> => {
    const [{ data: creditos, error: errCred }, { data: consorcios, error: errCons }] = await Promise.all([
        supabase.from('dividas_credito').select('*'),
        supabase.from('dividas_consorcio').select('consortium_id, cliente_id, consortium_label, administrator, credit_letter_value, total_paid_to_date'),
    ]);
    if (errCred) throw errCred;
    if (errCons) throw errCons;

    const indices = (creditos || [])
        .map((c: DividaCredito) => c.monetary_index)
        .filter((i): i is IndiceMercado => !!i && i !== 'fixed' && i !== 'none');
    const mercado = await indexadoresService.getTaxasMercado(indices);

    return [
        ...(creditos || []).map((c: DividaCredito): LinhaDivida => ({
            id: c.debt_id!,
            cliente_id: c.cliente_id,
            rotulo: c.debt_label || 'Crédito',
            tipo: formatarDebtType(c.debt_type),
            instituicao: c.institution || '',
            saldo: calcularSaldoEParcelasAtual({ ...c, monetary_correction_effective: taxaCorrecaoEfetiva(c, mercado) }).saldoDevedor,
        })),
        ...(consorcios || []).map((c: any): LinhaDivida => ({
            id: c.consortium_id,
            cliente_id: c.cliente_id,
            rotulo: c.consortium_label || 'Consórcio',
            tipo: 'Consórcio',
            instituicao: c.administrator || '',
            saldo: Math.max(0, (Number(c.credit_letter_value) || 0) - (Number(c.total_paid_to_date) || 0)),
        })),
    ];
};

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
    },

    /**
     * Saldo devedor (créditos + consórcios) de TODOS os clientes, em lote.
     * Mesma fórmula da aba Dívidas do prontuário: o saldo de crédito é recalculado na hora (data e
     * indexador), não lido do valor gravado, que só muda quando o cadastro é salvo.
     */
    getSaldoDevedorPorCliente: async (): Promise<Map<string, number>> => {
        const linhas = await carregarDividas();
        const saldos = new Map<string, number>();
        linhas.forEach(l => saldos.set(l.cliente_id, (saldos.get(l.cliente_id) || 0) + l.saldo));
        return saldos;
    },

    /** Dívidas por cliente ativo, maior saldo primeiro (drawer do KPI "Endividamento Total"). */
    getDividasClientes: async (): Promise<DividasCliente[]> => {
        const [linhas, { data: clientes, error }] = await Promise.all([
            carregarDividas(),
            supabase.from('clientes').select('id, nome').eq('status', 'Ativo'),
        ]);
        if (error) throw error;

        const nomes = new Map((clientes || []).map((c: any) => [c.id, c.nome as string]));
        const porCliente = new Map<string, DividasCliente>();
        linhas.forEach(l => {
            const nome = nomes.get(l.cliente_id);
            if (!nome || l.saldo <= 0) return;
            const atual = porCliente.get(l.cliente_id) || { id: l.cliente_id, nome, saldo: 0, linhas: [] };
            atual.saldo += l.saldo;
            atual.linhas.push(l);
            porCliente.set(l.cliente_id, atual);
        });
        return Array.from(porCliente.values()).sort((a, b) => b.saldo - a.saldo);
    },
};
