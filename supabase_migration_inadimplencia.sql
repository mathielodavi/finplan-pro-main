-- Pausa contratual por inadimplência.
-- Episódios de inadimplência (fonte da verdade de histórico/recorrência/tempo médio).
-- Episódio aberto (data_fim is null) = contrato pausado agora.
create table if not exists public.inadimplencia_episodios (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid not null references public.contratos(id) on delete cascade,
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  data_inicio   date not null,
  data_fim      date null,
  motivo        text null,
  consultor_id  uuid null,
  empresa_id    uuid null,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_inadimplencia_cliente on public.inadimplencia_episodios (cliente_id);
create index if not exists idx_inadimplencia_contrato on public.inadimplencia_episodios (contrato_id);
-- No máximo um episódio ABERTO por contrato.
create unique index if not exists uniq_inadimplencia_aberto_contrato
  on public.inadimplencia_episodios (contrato_id) where data_fim is null;

alter table public.inadimplencia_episodios enable row level security;

-- RLS espelhando contratos: acesso escopado ao consultor dono do cliente.
create policy "Consultores veem episodios de seus clientes" on public.inadimplencia_episodios
  for select using (cliente_id in (select id from public.clientes where consultor_id = auth.uid()));
create policy "Consultores criam episodios de seus clientes" on public.inadimplencia_episodios
  for insert with check (cliente_id in (select id from public.clientes where consultor_id = auth.uid()));
create policy "Consultores atualizam episodios de seus clientes" on public.inadimplencia_episodios
  for update using (cliente_id in (select id from public.clientes where consultor_id = auth.uid()))
  with check (cliente_id in (select id from public.clientes where consultor_id = auth.uid()));
create policy "Consultores deletam episodios de seus clientes" on public.inadimplencia_episodios
  for delete using (cliente_id in (select id from public.clientes where consultor_id = auth.uid()));

-- Contrato: espelho do início da pausa (UI/consulta rápida) e acumulador de dias prorrogados.
-- O status 'pausado' das parcelas em financeiro_parcelas é apenas texto de aplicação (a coluna
-- não tem CHECK constraint), então não requer alteração de schema.
alter table public.contratos
  add column if not exists pausado_em date null,
  add column if not exists dias_prorrogados integer not null default 0;
