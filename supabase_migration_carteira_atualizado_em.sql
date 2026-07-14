-- Data de última atualização por colocação (linha) da carteira recomendada, para o "check de OK"
-- e o alerta de defasagem (>30 dias) no Simulador Tático. A tabela já possui criado_em.
alter table public.carteiras_recomendadas
  add column if not exists atualizado_em timestamptz default now();
