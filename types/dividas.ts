export type DebtType = 'personal_loan' | 'financing' | 'credit_card' | 'overdraft' | 'other';
export type AssetType = 'real_estate' | 'vehicle' | 'heavy_equipment' | 'services' | 'other';
export type ContractType = 'reduced_installment' | 'fixed_installment';
export type MonetaryIndex = 'IPCA' | 'INCC' | 'IGP-M' | 'fixed' | 'none';
export type ContemplationStatus = 'not_contemplated' | 'contemplated_by_draw' | 'contemplated_by_bid' | 'awaiting_confirmation';
export type BidStrategy = 'none' | 'own_resources' | 'fgts' | 'credit_bid' | 'mixed';
export type PrioritizationMethod = 'avalanche' | 'snowball';

export interface DividaCredito {
    debt_id?: string;
    cliente_id: string;
    debt_label: string;
    debt_type: DebtType;
    institution: string;
    contracted_value: number;
    installment_value: number;
    total_installments: number;
    remaining_installments: number;
    start_date: string;
    end_date: string;
    cet_monthly: number;
    cet_annual: number; // calculated
    outstanding_balance: number;
    payoff_balance: number;
    total_paid: number; // calculated
    income_commitment: number; // calculated
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
    admin_fee_monthly: number;
    reserve_fund_rate: number;
    insurance_monthly?: number;
    monetary_index: MonetaryIndex;
    monetary_correction_accumulated: number;
    contemplation_status: ContemplationStatus;
    contemplation_date?: string;
    asset_released: boolean;
    asset_description?: string;
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
