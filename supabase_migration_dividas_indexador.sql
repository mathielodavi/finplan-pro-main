-- Indexador de correção em dívidas de crédito e consórcio (com SELIC), usado nas projeções.
-- `monetary_correction_annual` passa a ser o AJUSTE MANUAL: para 'fixed' é a própria taxa; para
-- índices de mercado (IPCA/IGP-M/INCC/SELIC), vazio = usar o acumulado de 12 meses do BCB.

alter table public.dividas_credito
  add column if not exists monetary_index text not null default 'none'
    check (monetary_index in ('IPCA', 'INCC', 'IGP-M', 'SELIC', 'fixed', 'none'));

-- Preserva o comportamento atual: crédito com correção manual já cadastrada vira "fixed".
update public.dividas_credito
  set monetary_index = 'fixed'
  where monetary_index = 'none' and coalesce(monetary_correction_annual, 0) > 0;

alter table public.dividas_consorcio
  drop constraint if exists dividas_consorcio_monetary_index_check;

alter table public.dividas_consorcio
  add constraint dividas_consorcio_monetary_index_check
    check (monetary_index in ('IPCA', 'INCC', 'IGP-M', 'SELIC', 'fixed', 'none'));

alter table public.dividas_consorcio
  add column if not exists monetary_correction_annual numeric(8,4);
