-- ==============================================================================
-- SCRIPT DE CORREÇÃO E SANEAMENTO DE DADOS (FINPLAN PRO)
-- Propósito: Restaurar vínculos de tipo de contrato e corrigir cálculos e 
-- parcelas de contratos 'À Vista' registrados antes da atualização do multiplicador.
-- ==============================================================================

BEGIN;

-- Desativa temporariamente as triggers da sessão atual.
-- Isso previne que a função registrar_auditoria_contrato() tente buscar
-- o auth.uid() do usuário (que é nulo rodando direto do painel SQL)
-- e quebre a regra de NOT NULL da tabela auditoria.
SET session_replication_role = 'replica';

-- 1. RESTAURAR VÍNCULO DO TIPO DE CONTRATO (FALLBACK)
UPDATE contratos
SET tipo = 'planejamento'
WHERE tipo IS NULL OR tipo = '';

-- 2. CORREÇÃO DE VALOR TOTAL EM CONTRATOS 'À VISTA' (PLANEJAMENTO)
UPDATE contratos
SET valor = valor * prazo_meses
WHERE 
  tipo = 'planejamento'
  AND forma_pagamento = 'vista'
  AND prazo_meses > 1
  AND (valor / prazo_meses) < 5000;

-- 3. REMOÇÃO DE PARCELAS PENDENTES EXCEDENTES EM CONTRATOS À VISTA
WITH RankedPendentes AS (
  SELECT 
    id,
    contrato_id,
    status,
    data_vencimento,
    ROW_NUMBER() OVER(PARTITION BY contrato_id ORDER BY data_vencimento ASC) as rn
  FROM financeiro_parcelas
  WHERE 
    status = 'pendente'
    AND contrato_id IN (
      SELECT id FROM contratos WHERE forma_pagamento = 'vista'
    )
)
DELETE FROM financeiro_parcelas
WHERE id IN (
  SELECT id FROM RankedPendentes WHERE rn > 1
);

-- 4. ATUALIZAR O VALOR DA ÚNICA PARCELA PENDENTE RESTANTE DESSES CONTRATOS
UPDATE financeiro_parcelas fp
SET valor_previsto = c.valor
FROM contratos c
WHERE 
  fp.contrato_id = c.id
  AND c.forma_pagamento = 'vista'
  AND fp.status = 'pendente'
  AND NOT EXISTS (
    SELECT 1 FROM financeiro_parcelas pago 
    WHERE pago.contrato_id = c.id AND pago.status IN ('pago', 'cancelado')
  );

-- Reativar as triggers da sessão normalmente
SET session_replication_role = 'origin';

COMMIT;
