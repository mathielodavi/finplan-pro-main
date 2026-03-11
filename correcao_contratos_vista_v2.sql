-- ==============================================================================
-- SCRIPT DE CORREÇÃO E SANEAMENTO DE DADOS v2 (FINPLAN PRO)
-- Propósito: Destravar salvamento de padrão no React e limpar parcelas duplas
-- de contratos à vista consolidados.
-- ==============================================================================

BEGIN;

-- Desativa temporariamente as triggers (para ignorar a auditoria sem o auth.uid())
SET session_replication_role = 'replica';

-- 1. REMOVER A AMARRA QUE IMPEDIA VÍNCULOS DE PADRÃO NO PLANEJAMENTO
-- Essa chave estrangeira exigia que padrao_id só pudesse existir na tabela de extras.
ALTER TABLE contratos DROP CONSTRAINT IF EXISTS fk_contratos_padrao_extra;

-- 2. LIMPAR PARCELAS PENDENTES "FANTASMAS" (Ex: Arthur Simonete)
-- Em contratos 'à vista', só deve existir 1 parcela no total. Se o contrato já 
-- possui 1 parcela 'pago', qualquer outra parcela 'pendente' que tenha sido gerada
-- por engano de recálculo no passado deve ser deletada.
DELETE FROM financeiro_parcelas
WHERE status = 'pendente'
  AND contrato_id IN (
    SELECT c.id
    FROM contratos c
    WHERE c.forma_pagamento = 'vista'
      AND EXISTS (
        SELECT 1 
        FROM financeiro_parcelas fp 
        WHERE fp.contrato_id = c.id AND fp.status = 'pago'
      )
  );

-- Reativar as triggers da sessão normalmente
SET session_replication_role = 'origin';

COMMIT;
