
import { supabase } from './supabaseClient';
import { calcularScoreProtecaoCliente } from '../utils/protecaoUtils';
import { calcularTaxaRealMensal } from '../utils/calculosFinanceiros';
import { toLocalDateString } from '../utils/formatadores';

/** `padroes_contrato_extra.tipo` dos contratos extras que representam proteção do cliente. */
const TIPOS_PADRAO_PROTECAO = ['Seguros', 'Planos de Saúde'];

const idsPadroesProtecao = async (): Promise<Set<string>> => {
    const { data, error } = await supabase.from('padroes_contrato_extra').select('id').in('tipo', TIPOS_PADRAO_PROTECAO);
    if (error) throw error;
    return new Set((data || []).map((p: any) => p.id));
};

export interface ContratoProtecao { id: string; descricao: string }
export type GrupoProtecao = 'sem' | 'com_contrato' | 'sem_contrato';
export interface ApoliceResumo { id: string; tipo: string; rotulo: string; contratoId?: string | null }
export interface ProtecaoCliente {
    id: string;
    nome: string;
    grupo: GrupoProtecao;
    apolices: ApoliceResumo[];
    contratos: ContratoProtecao[];
    /** Contratos de proteção ativos que nenhuma apólice vinculou. */
    contratosSemApolice: number;
    /** Apólices sem contrato vinculado, de cliente que tem contrato ativo. */
    apolicesSemVinculo: number;
}

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
    contrato_id?: string | null; // contrato extra que originou a apólice (opcional)
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
    contrato_id?: string | null; // contrato extra que originou a apólice (opcional)
    membro: string; // 'cliente', 'conjuge', ou nome do dependente
    seguradora?: string;
    modalidade?: 'individual' | 'grupo';
    // Padrão de Vida
    cobertura_doencas_graves?: number;
    cobertura_invalidez?: number;
    cobertura_cirurgia?: number;
    dit?: number;
    // Sucessão
    cobertura_morte?: number;
    cobertura_funeral?: number;
    inicio_vigencia?: string;
    fim_vigencia?: string;
    mensalidade?: number;
}

// ─── Seguro Extra ─────────────────────────────────────────────────────────────

export interface SeguroExtra {
    id?: string;
    cliente_id: string;
    contrato_id?: string | null; // contrato extra que originou a apólice (opcional)
    tipo_seguro?: string;
    descricao?: string;
    inicio_vigencia?: string;
    fim_vigencia?: string;
    mensalidade?: number;
}

// ─── Cliente Seguro ───────────────────────────────────────────────────────────

export const protecaoService = {
    /** Leitura simples (sem criar registro) da data de nascimento do cliente titular */
    async getDataNascimentoCliente(clienteId: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('clientes_seguros')
            .select('data_nascimento_cliente')
            .eq('cliente_id', clienteId)
            .maybeSingle();
        if (error) throw error;
        return data?.data_nascimento_cliente || null;
    },

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

    /**
     * Substitui a lista de dependentes do cliente. Grava os novos ANTES de apagar os antigos
     * (nunca o inverso): se a gravação falhar no meio do caminho, os dependentes já cadastrados
     * continuam intactos no banco — antes, um delete-then-insert podia apagar todos os
     * dependentes e falhar no insert seguinte (erro transitório de rede, por exemplo), zerando o
     * cadastro no banco enquanto a tela ainda mostrava os dados digitados (só no state local).
     */
    async salvarDependentes(clienteId: string, dependentes: Omit<DependenteSeguro, 'id' | 'cliente_id'>[]): Promise<DependenteSeguro[]> {
        const { data: atuais, error: errAtuais } = await supabase.from('dependentes_seguros').select('id').eq('cliente_id', clienteId);
        if (errAtuais) throw errAtuais;
        const idsAntigos = (atuais || []).map((a: any) => a.id);

        let salvos: DependenteSeguro[] = [];
        if (dependentes.length > 0) {
            const rows = dependentes.map((d, i) => ({ ...d, cliente_id: clienteId, ordem: i }));
            const { data, error } = await supabase.from('dependentes_seguros').insert(rows).select();
            if (error) throw error;
            salvos = data || [];
        }

        if (idsAntigos.length > 0) {
            const { error: errDel } = await supabase.from('dependentes_seguros').delete().in('id', idsAntigos);
            if (errDel) throw errDel;
        }
        return salvos;
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

    /** Atualiza os parâmetros gerais de cálculo (linha única, criada se não existir) */
    async salvarParametros(dados: Partial<ParametrosCalculo>): Promise<void> {
        const { data: existente } = await supabase.from('parametros_calculo').select('id').maybeSingle();
        if (existente?.id) {
            const { error } = await supabase.from('parametros_calculo').update(dados).eq('id', existente.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('parametros_calculo').insert(dados);
            if (error) throw error;
        }
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

    /** Pontuação de proteção (0-100) de UM cliente. Reusa utils/protecaoUtils. */
    async getScoreCliente(clienteId: string): Promise<number> {
        const [{ data: cli }, { data: seguro }, deps, planos, seguros, { data: ativos }, params] = await Promise.all([
            supabase.from('clientes').select('reserva_recomendada').eq('id', clienteId).maybeSingle(),
            supabase.from('clientes_seguros').select('*').eq('cliente_id', clienteId).maybeSingle(),
            this.getDependentes(clienteId),
            this.getPlanosSaude(clienteId),
            this.getSegurosVida(clienteId),
            supabase.from('ativos').select('cliente_id, valor_atual, distribuicao_objetivos').eq('cliente_id', clienteId),
            this.getParametros(),
        ]);
        const taxaRealMensal = calcularTaxaRealMensal(params.taxa_juros_aa, params.ipca_projetado_aa);
        return calcularScoreProtecaoCliente({
            clienteId,
            dadosClienteSeguro: seguro,
            reservaRecomendada: cli?.reserva_recomendada || 0,
            dependentes: deps || [],
            planosSaude: planos || [],
            segurosVida: seguros || [],
            ativos: ativos || [],
            taxaRealMensal,
        });
    },

    /**
     * Pontuação de proteção (0-100) de TODOS os clientes, em lote (sem N+1).
     * Fonte única da fórmula: utils/protecaoUtils.ts — usada tanto pelo KPI agregado do
     * Dashboard quanto pela coluna "Proteção" da listagem de clientes.
     */
    async getScoresPorCliente(): Promise<Map<string, number>> {
        const { data: clientesAll } = await supabase.from('clientes').select('id, reserva_recomendada');
        const clientes = clientesAll || [];
        if (clientes.length === 0) return new Map();

        const clienteIds = clientes.map(c => c.id);

        const [
            { data: seguros },
            { data: dependentes },
            { data: planosSaude },
            { data: segurosVida },
            { data: ativos },
            { data: parametrosRaw },
        ] = await Promise.all([
            supabase.from('clientes_seguros').select('*').in('cliente_id', clienteIds),
            supabase.from('dependentes_seguros').select('cliente_id, nome_dependente').in('cliente_id', clienteIds),
            supabase.from('planos_saude').select('cliente_id, membro').in('cliente_id', clienteIds),
            // Todas as coberturas usadas pelo pilar Vida: sem elas a soma dá 0 e o score trava em 83,3.
            supabase.from('seguros_vida').select('cliente_id, membro, cobertura_morte, cobertura_doencas_graves, cobertura_invalidez, cobertura_cirurgia, dit').in('cliente_id', clienteIds),
            supabase.from('ativos').select('cliente_id, valor_atual, distribuicao_objetivos').in('cliente_id', clienteIds),
            supabase.from('parametros_calculo').select('taxa_juros_aa, ipca_projetado_aa').maybeSingle(),
        ]);

        const parametros = parametrosRaw || { taxa_juros_aa: 6.25, ipca_projetado_aa: 4.50 };
        const taxaRealMensal = calcularTaxaRealMensal(parametros.taxa_juros_aa, parametros.ipca_projetado_aa);

        const segurosPorCliente = new Map<string, any>((seguros || []).map((s: any) => [s.cliente_id, s]));

        const scores = new Map<string, number>();
        clientes.forEach(c => {
            const score = calcularScoreProtecaoCliente({
                clienteId: c.id,
                dadosClienteSeguro: segurosPorCliente.get(c.id),
                reservaRecomendada: c.reserva_recomendada || 0,
                dependentes: dependentes || [],
                planosSaude: planosSaude || [],
                segurosVida: segurosVida || [],
                ativos: ativos || [],
                taxaRealMensal,
            });
            scores.set(c.id, score);
        });

        return scores;
    },

    // ─── Contratos de proteção ────────────────────────────────────────────────

    /** Contratos extras ativos de proteção do cliente (para vincular a uma apólice). */
    async getContratosProtecaoCliente(clienteId: string): Promise<ContratoProtecao[]> {
        const [{ data: contratos, error }, ids] = await Promise.all([
            supabase.from('contratos').select('id, descricao, padrao_id, status')
                .eq('cliente_id', clienteId).eq('tipo', 'extra').eq('status', 'ativo'),
            idsPadroesProtecao(),
        ]);
        if (error) throw error;
        return (contratos || [])
            .filter((c: any) => ids.has(c.padrao_id))
            .map((c: any) => ({ id: c.id, descricao: c.descricao || 'Contrato extra' }));
    },

    /**
     * Situação de proteção dos clientes ativos com planejamento (mesma base do KPI):
     * tem proteção quem tem apólice vigente OU contrato extra de proteção ativo. Separa quem tem
     * contrato ativo com o planejador de quem tem só apólice.
     */
    async getProtecaoClientes(): Promise<ProtecaoCliente[]> {
        const [{ data: clientesAll }, { data: contratosAll }, idsProtecao] = await Promise.all([
            supabase.from('clientes').select('id, nome, status').eq('status', 'Ativo'),
            supabase.from('contratos').select('id, cliente_id, tipo, status, descricao, padrao_id'),
            idsPadroesProtecao(),
        ]);

        const contratos = contratosAll || [];
        const comPlanejamento = new Set(contratos.filter((c: any) => c.tipo === 'planejamento').map((c: any) => c.cliente_id));
        const clientes = (clientesAll || []).filter(c => comPlanejamento.has(c.id));
        if (clientes.length === 0) return [];

        // RLS dessas tabelas é ampla: filtrar sempre pelos clientes visíveis.
        const ids = clientes.map(c => c.id);
        const [{ data: vida }, { data: saude }, { data: extras }] = await Promise.all([
            supabase.from('seguros_vida').select('id, cliente_id, seguradora, membro, fim_vigencia, contrato_id').in('cliente_id', ids),
            supabase.from('planos_saude').select('id, cliente_id, operadora, membro, contrato_id').in('cliente_id', ids),
            supabase.from('seguros_extras').select('id, cliente_id, tipo_seguro, descricao, fim_vigencia, contrato_id').in('cliente_id', ids),
        ]);

        const hoje = toLocalDateString(new Date());
        const vigente = (a: { fim_vigencia?: string | null }) => !a.fim_vigencia || a.fim_vigencia >= hoje;

        const apolices = new Map<string, ApoliceResumo[]>();
        const adicionar = (clienteId: string, a: ApoliceResumo) =>
            apolices.set(clienteId, [...(apolices.get(clienteId) || []), a]);

        (vida || []).filter(vigente).forEach((a: any) =>
            adicionar(a.cliente_id, { id: a.id, tipo: 'Vida', rotulo: a.seguradora || 'Seguro de vida', contratoId: a.contrato_id }));
        (saude || []).forEach((a: any) =>
            adicionar(a.cliente_id, { id: a.id, tipo: 'Saúde', rotulo: a.operadora || 'Plano de saúde', contratoId: a.contrato_id }));
        (extras || []).filter(vigente).forEach((a: any) =>
            adicionar(a.cliente_id, { id: a.id, tipo: a.tipo_seguro || 'Seguro', rotulo: a.descricao || a.tipo_seguro || 'Seguro', contratoId: a.contrato_id }));

        const contratosProtecao = contratos.filter((c: any) => c.tipo === 'extra' && c.status === 'ativo' && idsProtecao.has(c.padrao_id));

        return clientes.map(c => {
            const doCliente = apolices.get(c.id) || [];
            const contratosCli = contratosProtecao
                .filter((ct: any) => ct.cliente_id === c.id)
                .map((ct: any) => ({ id: ct.id, descricao: ct.descricao || 'Contrato extra' }));
            const vinculados = new Set(doCliente.map(a => a.contratoId).filter(Boolean));
            const grupo: GrupoProtecao = contratosCli.length > 0 ? 'com_contrato' : doCliente.length > 0 ? 'sem_contrato' : 'sem';
            return {
                id: c.id,
                nome: c.nome,
                grupo,
                apolices: doCliente,
                contratos: contratosCli,
                contratosSemApolice: contratosCli.filter(ct => !vinculados.has(ct.id)).length,
                apolicesSemVinculo: contratosCli.length > 0 ? doCliente.filter(a => !a.contratoId).length : 0,
            };
        });
    },
};
