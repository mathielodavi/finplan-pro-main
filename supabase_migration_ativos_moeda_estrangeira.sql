-- Suporte a ativos cadastrados em moeda estrangeira (ex.: aplicação no exterior, conta em dólar).
-- valor_atual continua sendo sempre o saldo em BRL (fonte da verdade para todos os cálculos
-- existentes); valor_original + cotacao_conversao são guardados só para referência/auditoria de
-- como o valor em BRL foi calculado.
alter table public.ativos
  add column if not exists moeda_origem text not null default 'BRL',
  add column if not exists valor_original numeric null,
  add column if not exists cotacao_conversao numeric null;
