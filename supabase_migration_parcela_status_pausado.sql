-- Corrige financeiro_parcelas_status_check: a migração de inadimplência (pausarContrato) grava
-- status = 'pausado' nas parcelas congeladas, mas o CHECK constraint existente não incluía esse
-- valor (só 'pendente'/'pago'/'atrasado'/'cancelado'), causando erro em toda pausa por
-- inadimplência mesmo com o episódio já tendo sido criado com sucesso.
alter table public.financeiro_parcelas drop constraint if exists financeiro_parcelas_status_check;
alter table public.financeiro_parcelas add constraint financeiro_parcelas_status_check
  check (status = any (array['pendente'::text, 'pago'::text, 'atrasado'::text, 'cancelado'::text, 'pausado'::text]));
