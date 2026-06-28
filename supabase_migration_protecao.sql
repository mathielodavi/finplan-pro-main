-- ============================================================
-- MIGRATION: Módulo de Proteção (Seguros)
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TABELA: parametros_calculo
-- Configurações globais dos cálculos financeiros
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parametros_calculo (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taxa_juros_aa             numeric(6,4) NOT NULL DEFAULT 6.25,
  ipca_projetado_aa         numeric(6,4) NOT NULL DEFAULT 4.50,
  perc_custos_inventario    numeric(5,2) NOT NULL DEFAULT 20.00,
  atualizado_em             timestamptz DEFAULT now()
);

-- Inserir row padrão (apenas uma vez)
INSERT INTO parametros_calculo (taxa_juros_aa, ipca_projetado_aa, perc_custos_inventario)
SELECT 6.25, 4.50, 20.00
WHERE NOT EXISTS (SELECT 1 FROM parametros_calculo);

-- RLS: leitura para todos autenticados, escrita bloqueada
ALTER TABLE parametros_calculo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura publica parametros" ON parametros_calculo
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Escrita apenas service role" ON parametros_calculo
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────
-- 2. TABELA: clientes_seguros
-- Formulário multipasso vinculado ao cliente (1:1)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes_seguros (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id                    uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,

  -- Etapa 1 — Dados do Cliente
  nome_cliente                  text,
  email_cliente                 text,
  telefone_cliente              text,
  data_nascimento_cliente       date,
  cpf_cliente                   text,
  estado_cliente                text,
  profissao_cliente             text,
  esporte_hobby_cliente         text,
  medicamento_continuo_cliente  text,
  doenca_cronica_cliente        text,
  cirurgia_complexa_cliente     text,
  peso_cliente                  numeric(5,2),
  altura_cliente                integer,
  fuma_cliente                  boolean DEFAULT false,

  -- Conjuge
  casado_cliente                boolean DEFAULT false,
  regime_bens                   text,
  nome_conjuge                  text,
  email_conjuge                 text,
  telefone_conjuge              text,
  data_nascimento_conjuge       date,
  cpf_conjuge                   text,
  estado_conjuge                text,
  profissao_conjuge             text,
  esporte_hobby_conjuge         text,
  medicamento_continuo_conjuge  text,
  doenca_cronica_conjuge        text,
  cirurgia_complexa_conjuge     text,
  peso_conjuge                  numeric(5,2),
  altura_conjuge                integer,
  fuma_conjuge                  boolean DEFAULT false,

  -- Etapa 4 — Padrão de Vida / Renda
  renda_cliente                 numeric(15,2) DEFAULT 0,
  declaracao_ir_cliente         text,
  regime_contratacao_cliente    text,
  renda_conjuge                 numeric(15,2) DEFAULT 0,
  declaracao_ir_conjuge         text,
  regime_contratacao_conjuge    text,

  -- Etapa 4 — Despesas
  despesas_obrigatorias         numeric(15,2) DEFAULT 0,
  despesas_nao_obrigatorias     numeric(15,2) DEFAULT 0,
  financiamentos                numeric(15,2) DEFAULT 0,
  dividas_mensais               numeric(15,2) DEFAULT 0,
  projetos_financeiros          numeric(15,2) DEFAULT 0,
  periodo_cobertura_anos        integer DEFAULT 10,

  -- Etapa 4 — Resultados calculados (persistidos)
  cobertura_cliente             numeric(15,2) DEFAULT 0,
  cobertura_conjuge             numeric(15,2) DEFAULT 0,
  cobertura_familiar_vida       numeric(15,2) DEFAULT 0,

  -- Etapa 5 — Sucessão Patrimonial
  funeral_cliente               numeric(15,2) DEFAULT 0,
  funeral_conjuge               numeric(15,2) DEFAULT 0,
  bens_cliente                  numeric(15,2) DEFAULT 0,
  bens_conjuge                  numeric(15,2) DEFAULT 0,
  investimentos_cliente         numeric(15,2) DEFAULT 0,
  investimentos_conjuge         numeric(15,2) DEFAULT 0,
  dividas_cliente               numeric(15,2) DEFAULT 0,
  dividas_conjuge               numeric(15,2) DEFAULT 0,
  pgbl_cliente                  numeric(15,2) DEFAULT 0,
  pgbl_conjuge                  numeric(15,2) DEFAULT 0,
  vgbl_cliente                  numeric(15,2) DEFAULT 0,
  vgbl_conjuge                  numeric(15,2) DEFAULT 0,

  -- Etapa 5 — Resultado
  cobertura_sucessao            numeric(15,2) DEFAULT 0,

  -- Controle
  etapa_atual                   integer DEFAULT 1,
  completo                      boolean DEFAULT false,
  ultimo_salvamento             timestamptz DEFAULT now(),
  criado_em                     timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_seguros_cliente_id ON clientes_seguros(cliente_id);

-- RLS: consultor acessa apenas clientes da sua carteira
ALTER TABLE clientes_seguros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor acessa apenas seus clientes - clientes_seguros"
  ON clientes_seguros
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = clientes_seguros.cliente_id
        AND c.consultor_id = auth.uid()
    )
  );


-- ─────────────────────────────────────────────────────────────
-- 3. TABELA: dependentes_seguros
-- Etapas 2 e 3: lista dinâmica de dependentes com cobertura
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dependentes_seguros (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id               uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  ordem                    integer NOT NULL DEFAULT 0,

  -- Etapa 2
  nome_dependente          text NOT NULL,
  data_nascimento_dep      date,
  parentesco               text,

  -- Etapa 3 (cálculo)
  cobertura_anos           integer DEFAULT 10,
  auxilio_mensal           numeric(15,2) DEFAULT 0,
  total_calculado          numeric(15,2) DEFAULT 0,

  criado_em                timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dependentes_seguros_cliente_id ON dependentes_seguros(cliente_id);

-- RLS
ALTER TABLE dependentes_seguros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultor acessa apenas seus dependentes"
  ON dependentes_seguros
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM clientes c
      WHERE c.id = dependentes_seguros.cliente_id
        AND c.consultor_id = auth.uid()
    )
  );
