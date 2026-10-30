-- Balanço patrimonial: bens fora da carteira e prazo de liquidação dos ativos financeiros.

CREATE TABLE IF NOT EXISTS bens_patrimoniais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('imovel', 'veiculo', 'empresa')),
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bens_patrimoniais_cliente ON bens_patrimoniais (cliente_id);

ALTER TABLE bens_patrimoniais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consultor acessa apenas seus bens" ON bens_patrimoniais;
CREATE POLICY "Consultor acessa apenas seus bens"
  ON bens_patrimoniais
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = bens_patrimoniais.cliente_id AND c.consultor_id = auth.uid()
    )
  );

-- Nulo = usa a regra padrão (utils/balanco.ts): Caixa ou vínculo com a reserva é curto prazo.
ALTER TABLE ativos ADD COLUMN IF NOT EXISTS prazo_liquidacao text
  CHECK (prazo_liquidacao IN ('curto', 'longo'));
