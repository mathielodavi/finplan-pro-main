-- Cadastro único da família do cliente. O titular continua em `clientes`; cônjuge e demais
-- membros ficam aqui. Dados de saúde e renda do cônjuge seguem em `clientes_seguros`, que recebe
-- um espelho da identificação para os cálculos, o score e o PDF.

CREATE TABLE IF NOT EXISTS clientes_familiares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  parentesco text NOT NULL,
  nome text NOT NULL,
  data_nascimento date,
  telefone text,
  email text,
  estado text,
  cpf text,
  profissao text,
  cobertura_anos integer,
  auxilio_mensal numeric,
  total_calculado numeric,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_familiares_cliente ON clientes_familiares (cliente_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_familiares_conjuge
  ON clientes_familiares (cliente_id) WHERE parentesco = 'Cônjuge';

ALTER TABLE clientes_familiares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consultor acessa apenas seus familiares" ON clientes_familiares;
CREATE POLICY "Consultor acessa apenas seus familiares"
  ON clientes_familiares
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = clientes_familiares.cliente_id AND c.consultor_id = auth.uid()
    )
  );

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS profissao text;

-- Titular: o que só existia no levantamento passa para o cadastro.
UPDATE clientes c
SET cpf = COALESCE(NULLIF(c.cpf, ''), NULLIF(s.cpf_cliente, '')),
    profissao = COALESCE(NULLIF(c.profissao, ''), NULLIF(s.profissao_cliente, ''))
FROM clientes_seguros s
WHERE s.cliente_id = c.id
  AND (NULLIF(s.cpf_cliente, '') IS NOT NULL OR NULLIF(s.profissao_cliente, '') IS NOT NULL);

-- Cônjuges e dependentes. Reexecutável: pula quem já foi copiado.
INSERT INTO clientes_familiares (cliente_id, parentesco, nome, data_nascimento, telefone, email, estado, cpf, profissao, ordem)
SELECT s.cliente_id, 'Cônjuge', COALESCE(NULLIF(trim(s.nome_conjuge), ''), 'Cônjuge'), s.data_nascimento_conjuge,
       s.telefone_conjuge, s.email_conjuge, s.estado_conjuge, s.cpf_conjuge, s.profissao_conjuge, 0
FROM clientes_seguros s
WHERE s.casado_cliente IS TRUE
  AND NOT EXISTS (
    SELECT 1 FROM clientes_familiares f WHERE f.cliente_id = s.cliente_id AND f.parentesco = 'Cônjuge'
  );

INSERT INTO clientes_familiares (cliente_id, parentesco, nome, data_nascimento, cobertura_anos, auxilio_mensal, total_calculado, ordem)
SELECT d.cliente_id, COALESCE(NULLIF(d.parentesco, ''), 'Filho(a)'), trim(d.nome_dependente), d.data_nascimento_dep,
       d.cobertura_anos, d.auxilio_mensal, d.total_calculado, d.ordem + 1
FROM dependentes_seguros d
WHERE NULLIF(trim(d.nome_dependente), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM clientes_familiares f WHERE f.cliente_id = d.cliente_id AND f.nome = trim(d.nome_dependente)
  );
