-- Contrato herdado (planejamento): data em que o acordo foi assumido de outro planejador.
-- Nulo = contrato próprio. Preenchido = os recebimentos com competência anterior a esta data
-- ficam com o dono anterior (não geram parcelas) e, na Movimentação da Base, o contrato entra
-- em "Herdados" no mês desta data (e não em "Novos" no mês da data-base).

alter table public.contratos
  add column if not exists data_heranca date;
