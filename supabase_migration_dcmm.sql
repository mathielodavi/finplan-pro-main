-- Migration Script: Módulo de Gestão de Dívidas e Consórcios (DCMM)

-- 0. Função auxiliar para o trigger de updated_at (se não existir)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Tabela: dividas_credito (Créditos e Empréstimos)
CREATE TABLE public.dividas_credito (
    debt_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    debt_label text NOT NULL,
    debt_type text NOT NULL CHECK (debt_type IN ('personal_loan', 'financing', 'credit_card', 'overdraft', 'other')),
    institution text NOT NULL,
    contracted_value numeric(15,2) NOT NULL DEFAULT 0,
    installment_value numeric(15,2) NOT NULL DEFAULT 0,
    total_installments integer NOT NULL DEFAULT 1,
    remaining_installments integer NOT NULL DEFAULT 0,
    start_date date NOT NULL,
    end_date date NOT NULL,
    cet_monthly numeric(6,4) NOT NULL DEFAULT 0,
    cet_annual numeric(6,4) NOT NULL DEFAULT 0,
    outstanding_balance numeric(15,2) NOT NULL DEFAULT 0,
    payoff_balance numeric(15,2) NOT NULL DEFAULT 0,
    total_paid numeric(15,2) NOT NULL DEFAULT 0,
    income_commitment numeric(5,2) NOT NULL DEFAULT 0,
    collateral text,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela: dividas_consorcio (Consórcios)
CREATE TABLE public.dividas_consorcio (
    consortium_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    consortium_label text NOT NULL,
    asset_type text NOT NULL CHECK (asset_type IN ('real_estate', 'vehicle', 'heavy_equipment', 'services', 'other')),
    administrator text NOT NULL,
    credit_letter_value numeric(15,2) NOT NULL DEFAULT 0,
    total_installments integer NOT NULL DEFAULT 1,
    remaining_installments integer NOT NULL DEFAULT 0,
    current_installment_value numeric(15,2) NOT NULL DEFAULT 0,
    contract_type text NOT NULL CHECK (contract_type IN ('reduced_installment', 'fixed_installment')),
    admin_fee_total numeric(5,2) NOT NULL DEFAULT 0,
    admin_fee_monthly numeric(5,2) NOT NULL DEFAULT 0,
    reserve_fund_rate numeric(5,2) NOT NULL DEFAULT 0,
    insurance_monthly numeric(10,2),
    monetary_index text NOT NULL CHECK (monetary_index IN ('IPCA', 'INCC', 'IGP-M', 'fixed', 'none')),
    monetary_correction_accumulated numeric(8,4) NOT NULL DEFAULT 0,
    contemplation_status text NOT NULL CHECK (contemplation_status IN ('not_contemplated', 'contemplated_by_draw', 'contemplated_by_bid', 'awaiting_confirmation')),
    contemplation_date date,
    asset_released boolean NOT NULL DEFAULT false,
    asset_description text,
    fgts_eligible boolean NOT NULL DEFAULT false,
    last_assembly_number integer NOT NULL DEFAULT 0,
    group_size integer NOT NULL DEFAULT 1,
    bid_strategy text NOT NULL CHECK (bid_strategy IN ('none', 'own_resources', 'fgts', 'credit_bid', 'mixed')),
    estimated_bid_value numeric(15,2),
    total_paid_to_date numeric(15,2) NOT NULL DEFAULT 0,
    real_monthly_cost numeric(10,2) NOT NULL DEFAULT 0,
    embedded_total_cost_pct numeric(6,4) NOT NULL DEFAULT 0,
    start_date date NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Alteração: Adicionar método de priorização no cliente
ALTER TABLE public.clientes
ADD COLUMN IF NOT EXISTS prioritization_method text DEFAULT 'avalanche' CHECK (prioritization_method IN ('avalanche', 'snowball'));

-- 4. RLS - Habilitar Row Level Security (opcional se já tiver setup padrão, mas recomendado)
ALTER TABLE public.dividas_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dividas_consorcio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver dívidas de crédito dos próprios clientes" ON public.dividas_credito
    FOR SELECT USING (auth.uid() IN (SELECT consultor_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Usuários podem inserir dívidas de crédito dos próprios clientes" ON public.dividas_credito
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT consultor_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Usuários podem atualizar dívidas de crédito dos próprios clientes" ON public.dividas_credito
    FOR UPDATE USING (auth.uid() IN (SELECT consultor_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Usuários podem deletar dívidas de crédito dos próprios clientes" ON public.dividas_credito
    FOR DELETE USING (auth.uid() IN (SELECT consultor_id FROM public.clientes WHERE id = cliente_id));

CREATE POLICY "Usuários podem ver consórcios dos próprios clientes" ON public.dividas_consorcio
    FOR SELECT USING (auth.uid() IN (SELECT consultor_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Usuários podem inserir consórcios dos próprios clientes" ON public.dividas_consorcio
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT consultor_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Usuários podem atualizar consórcios dos próprios clientes" ON public.dividas_consorcio
    FOR UPDATE USING (auth.uid() IN (SELECT consultor_id FROM public.clientes WHERE id = cliente_id));
CREATE POLICY "Usuários podem deletar consórcios dos próprios clientes" ON public.dividas_consorcio
    FOR DELETE USING (auth.uid() IN (SELECT consultor_id FROM public.clientes WHERE id = cliente_id));

-- Triggers de updated_at
CREATE TRIGGER update_dividas_credito_modtime
    BEFORE UPDATE ON public.dividas_credito
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_dividas_consorcio_modtime
    BEFORE UPDATE ON public.dividas_consorcio
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
