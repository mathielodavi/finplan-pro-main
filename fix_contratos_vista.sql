-- ==============================================================================
-- SCRIPT DE CORREÇÃO E SANEAMENTO DE DADOS (FINPLAN PRO)
-- Propósito: Restaurar vínculos de tipo de contrato e corrigir cálculos e 
-- parcelas de contratos 'À Vista' registrados antes da atualização do multiplicador.
-- ==============================================================================

BEGIN;

-- 1. RESTAURAR VÍNCULO DO TIPO DE CONTRATO (FALLBACK)
-- Caso algum contrato tenha perdido o 'tipo' subjacente, restaurá-lo para 'planejamento' 
-- (a vasta maioria das anomalias recaem nos de planejamento, pois extras vieram na v2).
UPDATE contratos
SET tipo = 'planejamento'
WHERE tipo IS NULL OR tipo = '';

-- 2. CORREÇÃO DE VALOR TOTAL EM CONTRATOS 'À VISTA' (PLANEJAMENTO)
-- Multiplicar o valor do contrato pelo prazo em meses, apenas para os que 
-- foram gerados antes do dia da atualização e que ainda estão com o ticket solto.
-- Assumimos que a atualização foi aplicada e os valores já estão como deveriam
-- se criados pós-patch.
UPDATE contratos
SET valor = valor * prazo_meses
WHERE 
  tipo = 'planejamento'
  AND forma_pagamento = 'vista'
  AND prazo_meses > 1
  -- Fator de segurança: Evitar multiplicar caso o valor já esteja orbitando casas de dezenas 
  -- de milhares (o que indicaria que já estava calculado como total)
  -- Se o ticket era 1000, 1000 * 12 = 12000. Se já for 12000, 12000 * 12 = 144000.
  -- Usamos o limiar empírico onde o montante/prazo = valor antigo.
  AND criado_em < CURRENT_DATE
  AND (valor / prazo_meses) < 5000; -- Teto tolerável para ticket (evita super-duplicação)


-- 3. REMOÇÃO DE PARCELAS PENDENTES EXCEDENTES EM CONTRATOS À VISTA
-- Se um contrato à vista acabou gerando N parcelas pendentes (bug antigo ou edição 
-- indevida sem limpeza), deletamos todas as pendentes EXCETO a primeira (a mais antiga).
-- IMPORTANTE: Não apagamos e nem mexemos em parcelas 'pago', garantindo que 
-- as conciliações já realizadas sejam blindadas.

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
-- Atualizamos a expectativa dessa 1ª parcela de contratos 'vista' para equivaler ao 
-- valor corrigido bruto do contrato, garantindo que o fluxo não espere menos que deve.
UPDATE financeiro_parcelas fp
SET valor_previsto = c.valor
FROM contratos c
WHERE 
  fp.contrato_id = c.id
  AND c.forma_pagamento = 'vista'
  AND fp.status = 'pendente'
  -- Restringindo apenas para contratos que AINDA NÃO tiveram nenhuma parcela paga 
  -- (se houver pagamento, mantemos intacto para não poluir fluxo de caixa histórico)
  AND NOT EXISTS (
    SELECT 1 FROM financeiro_parcelas pago 
    WHERE pago.contrato_id = c.id AND pago.status IN ('pago', 'cancelado')
  );

COMMIT;
