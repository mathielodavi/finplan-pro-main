
import { supabase } from './supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClienteSeguro {
    id?: string;
    cliente_id: string;
    // Etapa 1 — Cliente
    nome_cliente?: string;
    email_cliente?: string;
    telefone_cliente?: string;
    data_nascimento_cliente?: string;
    cpf_cliente?: string;
    estado_cliente?: string;
    sexo_cliente?: string;
    estado_civil?: string;
    profissao_cliente?: string;
    esporte_hobby_cliente?: string;
    medicamento_continuo_cliente?: string;
    doenca_cronica_cliente?: string;
    cirurgia_complexa_cliente?: string;
    peso_cliente?: number;
    altura_cliente?: number;
    fuma_cliente?: boolean;
    fumante_cliente?: boolean;
    esporte_risco_cliente?: boolean;
    // Cônjuge
    casado_cliente?: boolean;
    regime_bens?: string;
    nome_conjuge?: string;
    email_conjuge?: string;
    telefone_conjuge?: string;
    data_nascimento_conjuge?: string;
    cpf_conjuge?: string;
    estado_conjuge?: string;
    sexo_conjuge?: string;
    profissao_conjuge?: string;
    esporte_hobby_conjuge?: string;
    medicamento_continuo_conjuge?: string;
    doenca_cronica_conjuge?: string;
    cirurgia_complexa_conjuge?: string;
    peso_conjuge?: number;
    altura_conjuge?: number;
    fuma_conjuge?: boolean;
    // Etapa 4
    renda_cliente?: number;
    declaracao_ir_cliente?: string;
    regime_contratacao_cliente?: string;
    renda_conjuge?: number;
    declaracao_ir_conjuge?: string;
    regime_contratacao_conjuge?: string;
    despesas_obrigatorias?: number;
    despesas_nao_obrigatorias?: number;
    financiamentos?: number;
    dividas_mensais?: number;
    projetos_financeiros?: number;
    // Toggles de inclusão de despesas no cálculo de cobertura de seguro
    cobertura_incluir_obrigatorias?: boolean;
    cobertura_incluir_nao_obrigatorias?: boolean;
    cobertura_incluir_financiamentos?: boolean;
    cobertura_incluir_dividas?: boolean;
    cobertura_incluir_projetos?: boolean;
    periodo_cobertura_anos?: number;
    cobertura_cliente?: number;
    cobertura_conjuge?: number;
    cobertura_familiar_vida?: number;
    // Etapa 5
    funeral_cliente?: number;
    funeral_conjuge?: number;
    bens_cliente?: number;
    bens_conjuge?: number;
    investimentos_cliente?: number;
    investimentos_conjuge?: number;
    dividas_cliente?: number;
    dividas_conjuge?: number;
    pgbl_cliente?: number;
    pgbl_conjuge?: number;
    vgbl_cliente?: number;
    vgbl_conjuge?: number;
    honorarios_perc?: number;
    itcmd_perc?: number;
    cobertura_sucessao?: number;
    // Reserva de Emergência
    reserva_ideal?: number;
    reserva_modo?: 'manual' | 'automatico';
    reserva_incluir_nao_obrigatorias?: boolean;
    reserva_incluir_financiamentos?: boolean;
    reserva_incluir_dividas?: boolean;
    // Controle
    taxa_real_anual?: number;  // Taxa real anual para cálculo de cobertura de vida (padrão: 4%)
    etapa_atual?: number;
    completo?: boolean;
    ultimo_salvamento?: string;
}

export interface DependenteSeguro {
    id?: string;
    cliente_id: string;
    ordem: number;
    nome_dependente: string;
    data_nascimento_dep?: string;
    parentesco?: string;
    cobertura_anos?: number;
    auxilio_mensal?: number;
    total_calculado?: number;
}

export interface ParametrosCalculo {
    taxa_juros_aa: number;
    ipca_projetado_aa: number;
    perc_custos_inventario: number;
}

// ─── Plano de Saúde ───────────────────────────────────────────────────────────

export interface PlanoSaude {
    id?: string;
    cliente_id: string;
    membro: string; // 'cliente', 'conjuge', ou nome do dependente
    operadora?: string;
    cobertura?: 'Nacional' | 'Estadual' | 'Municipal' | string;
    coparticipacao?: boolean;
    uti?: boolean;
    quarto_privativo?: boolean;
    obstetricia?: boolean;
    mensalidade?: number;
}

// ─── Seguro de Vida ───────────────────────────────────────────────────────────

export interface SeguroVida {
    id?: string;
    cliente_id: string;
    membro: string; // 'cliente', 'conjuge', ou nome do dependente
    seguradora?: string;
    cobertura_funeral?: number;
    cobertura_morte?: number;
    cobertura_invalidez?: number;
    dit?: number;
    inicio_vigencia?: string;
    fim_vigencia?: string;
    mensalidade?: number;
}

// ─── Seguro Extra ─────────────────────────────────────────────────────────────

export interface SeguroExtra {
    id?: string;
    cliente_id: string;
    tipo_seguro?: string;
    descricao?: string;
    inicio_vigencia?: string;
    fim_vigencia?: string;
    mensalidade?: number;
}

// ─── Cliente Seguro ───────────────────────────────────────────────────────────

export const protecaoService = {
    /** Busca ou cria o registro clientes_seguros para o cliente */
    async getOrCreate(clienteId: string): Promise<ClienteSeguro> {
        const { data, error } = await supabase
            .from('clientes_seguros')
            .select('*')
            .eq('cliente_id', clienteId)
            .maybeSingle();

        if (error) throw error;

        if (data) return data;

        const { data: novo, error: errCreate } = await supabase
            .from('clientes_seguros')
            .insert({ cliente_id: clienteId, etapa_atual: 1 })
            .select()
            .single();

        if (errCreate) throw errCreate;
        return novo;
    },

    /** Salva parcialmente os dados (autosave por etapa) */
    async update(clienteId: string, dados: Partial<ClienteSeguro>): Promise<void> {
        const { error } = await supabase
            .from('clientes_seguros')
            .update({ ...dados, ultimo_salvamento: new Date().toISOString() })
            .eq('cliente_id', clienteId);

        if (error) throw error;
    },

    // ─── Dependentes ──────────────────────────────────────────────────────────

    async getDependentes(clienteId: string): Promise<DependenteSeguro[]> {
        const { data, error } = await supabase
            .from('dependentes_seguros')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('ordem', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async salvarDependentes(clienteId: string, dependentes: Omit<DependenteSeguro, 'id' | 'cliente_id'>[]): Promise<DependenteSeguro[]> {
        await supabase.from('dependentes_seguros').delete().eq('cliente_id', clienteId);
        if (dependentes.length === 0) return [];
        const rows = dependentes.map((d, i) => ({ ...d, cliente_id: clienteId, ordem: i }));
        const { data, error } = await supabase.from('dependentes_seguros').insert(rows).select();
        if (error) throw error;
        return data || [];
    },

    // ─── Parâmetros ───────────────────────────────────────────────────────────

    async getParametros(): Promise<ParametrosCalculo> {
        const { data, error } = await supabase
            .from('parametros_calculo')
            .select('taxa_juros_aa, ipca_projetado_aa, perc_custos_inventario')
            .single();

        if (error || !data) {
            return { taxa_juros_aa: 6.25, ipca_projetado_aa: 4.50, perc_custos_inventario: 20.00 };
        }
        return data;
    },

    // ─── Planos de Saúde ──────────────────────────────────────────────────────

    async getPlanosSaude(clienteId: string): Promise<PlanoSaude[]> {
        const { data, error } = await supabase
            .from('planos_saude')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('membro');
        if (error) throw error;
        return data || [];
    },

    async upsertPlanoSaude(plano: PlanoSaude): Promise<PlanoSaude> {
        if (plano.id) {
            const { data, error } = await supabase
                .from('planos_saude')
                .update(plano)
                .eq('id', plano.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase
                .from('planos_saude')
                .insert(plano)
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    async deletePlanoSaude(id: string): Promise<void> {
        const { error } = await supabase.from('planos_saude').delete().eq('id', id);
        if (error) throw error;
    },

    // ─── Seguros de Vida ──────────────────────────────────────────────────────

    async getSegurosVida(clienteId: string): Promise<SeguroVida[]> {
        const { data, error } = await supabase
            .from('seguros_vida')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('membro');
        if (error) throw error;
        return data || [];
    },

    async upsertSeguroVida(seguro: SeguroVida): Promise<SeguroVida> {
        if (seguro.id) {
            const { data, error } = await supabase
                .from('seguros_vida')
                .update(seguro)
                .eq('id', seguro.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase
                .from('seguros_vida')
                .insert(seguro)
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    async deleteSeguroVida(id: string): Promise<void> {
        const { error } = await supabase.from('seguros_vida').delete().eq('id', id);
        if (error) throw error;
    },

    // ─── Seguros Extras ───────────────────────────────────────────────────────

    async getSegurosExtras(clienteId: string): Promise<SeguroExtra[]> {
        const { data, error } = await supabase
            .from('seguros_extras')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('tipo_seguro');
        if (error) throw error;
        return data || [];
    },

    async upsertSeguroExtra(seguro: SeguroExtra): Promise<SeguroExtra> {
        if (seguro.id) {
            const { data, error } = await supabase
                .from('seguros_extras')
                .update(seguro)
                .eq('id', seguro.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase
                .from('seguros_extras')
                .insert(seguro)
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    async deleteSeguroExtra(id: string): Promise<void> {
        const { error } = await supabase.from('seguros_extras').delete().eq('id', id);
        if (error) throw error;
    },
};
