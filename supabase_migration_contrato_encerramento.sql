-- Migration Script: Classificação de encerramento e resgate de contratos
-- Objetivo: segmentar distratos (não renovação vs cancelamento antecipado) e
-- identificar renovações tardias ("resgate", >1 mês após o distrato anterior)
-- para a "Movimentação da Base" da Visão Geral.

-- 1. Novas colunas em contratos
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS tipo_encerramento TEXT
    CHECK (tipo_encerramento IN ('nao_renovacao', 'cancelamento_antecipado'));
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS is_resgate BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contratos.tipo_encerramento IS
  'Classificação do encerramento de um contrato de planejamento: '
  '"nao_renovacao" = contrato cumprido na íntegra mas não renovado; '
  '"cancelamento_antecipado" = cancelado antes da finalização. NULL enquanto vigente.';
COMMENT ON COLUMN public.contratos.is_resgate IS
  'true quando o contrato de planejamento reativa um cliente mais de 1 mês '
  'após o encerramento (distrato) do contrato de planejamento anterior.';

-- 2. Backfill do tipo_encerramento para contratos históricos ------------------

-- 2a. Cancelamento antecipado: cancelados cujo encerramento efetivo (data_fim,
-- ou data de atualização) ocorreu antes do fim natural (data_inicio + prazo_meses).
UPDATE public.contratos c
SET tipo_encerramento = 'cancelamento_antecipado'
WHERE c.tipo = 'planejamento'
  AND c.status = 'cancelado'
  AND c.tipo_encerramento IS NULL
  AND COALESCE(c.data_fim::timestamptz, c.atualizado_em, now())
      < (c.data_inicio::timestamptz + make_interval(months => COALESCE(c.prazo_meses, 0))) - interval '1 day';

-- 2b. Demais cancelados (sem sinal claro de antecipação) e concluídos sem
-- renovação subsequente são tratados como não renovação.
UPDATE public.contratos c
SET tipo_encerramento = 'nao_renovacao'
WHERE c.tipo = 'planejamento'
  AND c.status IN ('cancelado', 'concluido')
  AND c.tipo_encerramento IS NULL;

-- 3. Backfill de is_resgate ---------------------------------------------------
-- Marca contratos de planejamento cujo cliente teve um contrato de planejamento
-- anterior encerrado (concluído/cancelado) mais de 1 mês antes do data_inicio atual.
WITH encerrados AS (
  SELECT
    id,
    cliente_id,
    COALESCE(
      data_fim::timestamptz,
      atualizado_em,
      data_inicio::timestamptz + make_interval(months => COALESCE(prazo_meses, 0))
    ) AS fim_efetivo
  FROM public.contratos
  WHERE tipo = 'planejamento'
    AND status IN ('concluido', 'cancelado')
)
UPDATE public.contratos novo
SET is_resgate = true
WHERE novo.tipo = 'planejamento'
  AND EXISTS (
    SELECT 1
    FROM encerrados e
    WHERE e.cliente_id = novo.cliente_id
      AND e.id <> novo.id
      AND e.fim_efetivo < novo.data_inicio::timestamptz
      AND e.fim_efetivo < novo.data_inicio::timestamptz - interval '1 month'
  );
