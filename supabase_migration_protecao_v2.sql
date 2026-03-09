-- ============================================================
-- FinPlan Pro — Migração v2: Dashboard de Proteção
-- Execute este script no Supabase SQL Editor
-- ============================================================

-- 1. Planos de saúde por membro
CREATE TABLE IF NOT EXISTS planos_saude (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL,
  membro text NOT NULL, -- 'cliente', 'conjuge', ou nome do dependente
  operadora text,
  cobertura text CHECK (cobertura IN ('Nacional', 'Estadual', 'Municipal')),
  coparticipacao boolean DEFAULT false,
  uti boolean DEFAULT false,
  quarto_privativo boolean DEFAULT false,
  obstetricia boolean DEFAULT false,
  mensalidade numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE planos_saude ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planos_saude_all" ON planos_saude FOR ALL USING (true) WITH CHECK (true);

-- 2. Seguros de vida por membro
CREATE TABLE IF NOT EXISTS seguros_vida (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL,
  membro text NOT NULL, -- 'cliente', 'conjuge', ou nome do dependente
  seguradora text,
  cobertura_funeral numeric DEFAULT 0,
  cobertura_morte numeric DEFAULT 0,
  cobertura_invalidez numeric DEFAULT 0,
  dit numeric DEFAULT 0,  -- Diária de Incapacidade Temporária
  inicio_vigencia date,
  fim_vigencia date,
  mensalidade numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE seguros_vida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seguros_vida_all" ON seguros_vida FOR ALL USING (true) WITH CHECK (true);

-- 3. Seguros extras (residencial, automotivo, empresarial, etc.)
CREATE TABLE IF NOT EXISTS seguros_extras (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL,
  tipo_seguro text, -- 'Residencial', 'Automotivo', 'Empresarial', 'Responsabilidade Civil', 'Outro'
  descricao text,
  inicio_vigencia date,
  fim_vigencia date,
  mensalidade numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE seguros_extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seguros_extras_all" ON seguros_extras FOR ALL USING (true) WITH CHECK (true);

-- 4. Novos campos em clientes_seguros para Reserva de Emergência
ALTER TABLE clientes_seguros
  ADD COLUMN IF NOT EXISTS reserva_ideal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserva_modo text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reserva_incluir_nao_obrigatorias boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reserva_incluir_financiamentos boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS reserva_incluir_dividas boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS honorarios_perc numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS itcmd_perc numeric DEFAULT 0;

-- Adicionar campo sexo_cliente e sexo_conjuge se não existirem (usados em EtapaDadosPessoais)
ALTER TABLE clientes_seguros
  ADD COLUMN IF NOT EXISTS sexo_cliente text,
  ADD COLUMN IF NOT EXISTS sexo_conjuge text,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS fumante_cliente boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS esporte_risco_cliente boolean DEFAULT false;
