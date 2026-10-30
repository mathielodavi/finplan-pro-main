-- Vínculo opcional entre apólice e o contrato extra que a originou. Nulo = apólice sem contrato
-- vinculado. Se o contrato for excluído, a apólice permanece, só perde o vínculo.

alter table public.seguros_vida
  add column if not exists contrato_id uuid references public.contratos(id) on delete set null;
alter table public.planos_saude
  add column if not exists contrato_id uuid references public.contratos(id) on delete set null;
alter table public.seguros_extras
  add column if not exists contrato_id uuid references public.contratos(id) on delete set null;

create index if not exists seguros_vida_contrato_idx on public.seguros_vida (contrato_id) where contrato_id is not null;
create index if not exists planos_saude_contrato_idx on public.planos_saude (contrato_id) where contrato_id is not null;
create index if not exists seguros_extras_contrato_idx on public.seguros_extras (contrato_id) where contrato_id is not null;
