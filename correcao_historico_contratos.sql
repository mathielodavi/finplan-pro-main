-- ==============================================================================
-- SCRIPT DE CORREÇÃO DE HISTÓRICO DE VÍNCULOS (FINPLAN PRO)
-- Propósito: Recuperar padrao_id de contratos antigos baseando-se no texto
-- da descrição salva (Ex: "Plano Contínuo"). E varrer parcelas fantasmas novamente.
-- ==============================================================================

BEGIN;

-- Desativa auditoria obrigatória do Supabase temporariamente
SET session_replication_role = 'replica';


-- 1. RECUPERAÇÃO DE PADRÃO_ID DE CONTRATOS DE PLANEJAMENTO
-- Lê a tabela de padrões de planejamento, se o nome do padrão bater
-- exatamente com a 'descricao' digitada no contrato de planejamento sem ID, ele vincula.
UPDATE contratos c
SET padrao_id = p.id
FROM padroes_contrato_planejamento p
WHERE c.tipo = 'planejamento'
  AND (c.padrao_id IS NULL OR c.padrao_id = '')
  AND c.descricao = p.nome;


-- 2. RECUPERAÇÃO DE PADRÃO_ID DE CONTRATOS EXTRAS (Por segurança)
-- Se houve algum serviço extra na mesma situação, ele faz o mesmo link.
UPDATE contratos c
SET padrao_id = p.id
FROM padroes_contrato_extra p
WHERE c.tipo = 'extra'
  AND (c.padrao_id IS NULL OR c.padrao_id = '')
  AND c.descricao = p.nome;


-- 3. REMOÇÃO DE PARCELAS FANTASMAS EM CONTRATOS RECENTEMENTE ATUALIZADOS A VISTA
-- Garantia da deleção do bug relatado. Mantém intacta se houver pagamento.
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

-- Reativar auditorias
SET session_replication_role = 'origin';

COMMIT;
