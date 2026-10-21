export type DebtType = 'personal_loan' | 'financing' | 'credit_card' | 'overdraft' | 'other';
export type AssetType = 'real_estate' | 'vehicle' | 'heavy_equipment' | 'services' | 'other';
export type ContractType = 'reduced_installment' | 'fixed_installment';
export type MonetaryIndex = 'IPCA' | 'INCC' | 'IGP-M' | 'SELIC' | 'fixed' | 'none';
export type ContemplationStatus = 'not_contemplated' | 'contemplated_by_draw' | 'contemplated_by_bid' | 'awaiting_confirmation';
export type BidStrategy = 'none' | 'own_resources' | 'fgts' | 'credit_bid' | 'mixed';
export type PrioritizationMethod = 'avalanche' | 'snowball';
export type AmortizationSystem = 'price' | 'sac';
export type DebtSituacao = 'em_dia' | 'em_atraso';
export type TaxaNominalUnidade = 'am' | 'aa';

export interface DividaCredito {
    debt_id?: string;
    cliente_id: string;
    debt_label: string;
    debt_type: DebtType;
    institution: string;
    contracted_value: number;
    installment_value: number;
    total_installments: number;
    remaining_installments: number; // calculated — cronograma de amortização, não editado manualmente
    start_date: string;
    end_date: string; // calculated — start_date + total_installments meses
    situacao: DebtSituacao;
    /** Nº da parcela do último pagamento efetuado. Obrigatório quando situacao === 'em_atraso'. */
    parcela_ultimo_pagamento?: number;
    /** Taxa nominal informativa — não afeta nenhum cálculo (CET é o campo usado nos cálculos). */
    taxa_nominal?: number;
    taxa_nominal_unidade?: TaxaNominalUnidade;
    cet_monthly: number;
    cet_annual: number; // calculated
    outstanding_balance: number; // calculated — cronograma de amortização, não editado manualmente
    payoff_balance: number;
    total_paid: number; // calculated
    income_commitment: number; // calculated
    /** Sistema de amortização: price (parcela fixa) ou sac (amortização constante, parcela decrescente). */
    amortization_system: AmortizationSystem;
    /** Indexador de correção do saldo ('none' = sem correção; 'fixed' = taxa manual em `monetary_correction_annual`). */
    monetary_index: MonetaryIndex;
    /** Ajuste manual da correção (% a.a.). Para 'fixed' é a própria taxa; para índices de mercado,
     * vazio = usar o acumulado de 12 meses do mercado. */
    monetary_correction_annual?: number | null;
    /** Calculado em memória (NÃO persistir): taxa efetiva usada nas projeções (ajuste manual ou mercado). */
    monetary_correction_effective?: number;
    collateral?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface DividaConsorcio {
    consortium_id?: string;
    cliente_id: string;
    consortium_label: string;
    asset_type: AssetType;
    administrator: string;
    credit_letter_value: number;
    total_installments: number;
    remaining_installments: number;
    current_installment_value: number;
    contract_type: ContractType;
    admin_fee_total: number;
    reserve_fund_rate: number;
    insurance_monthly?: number;
    monetary_index: MonetaryIndex;
    monetary_correction_accumulated: number;
    /** Ajuste manual da correção projetada (% a.a.). Vazio = acumulado de 12 meses do mercado; 'fixed' = taxa manual. */
    monetary_correction_annual?: number | null;
    /** Calculado em memória (NÃO persistir): taxa efetiva usada nas projeções. */
    monetary_correction_effective?: number;
    contemplation_status: ContemplationStatus;
    contemplation_date?: string;
    asset_released: boolean;
    fgts_eligible: boolean;
    last_assembly_number: number;
    group_size: number;
    bid_strategy: BidStrategy;
    estimated_bid_value?: number;
    total_paid_to_date: number;
    real_monthly_cost: number; // calculated
    embedded_total_cost_pct: number; // calculated
    start_date: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}
