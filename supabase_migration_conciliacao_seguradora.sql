-- Corrige o entendimento do campo criado em supabase_migration_conciliacao_canal_recebimento.sql:
-- não é o meio de pagamento (pix/transferência/...), é a seguradora/plano de origem da comissão
-- de um recebimento "extra" (ex.: Azos, MAG, Icatu). Universo aberto — sem lista fixa de valores.

alter table public.financeiro_parcelas
  drop constraint if exists financeiro_parcelas_canal_recebimento_check;

alter table public.financeiro_parcelas
  rename column canal_recebimento to seguradora;
