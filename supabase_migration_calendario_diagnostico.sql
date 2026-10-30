-- Diagnóstico da última sincronização de calendário: quantos eventos foram lidos e casados, e os
-- compromissos próximos sem cliente identificado (com o motivo). Sob a mesma RLS da conexão: só o
-- consultor dono enxerga, já que os títulos dos eventos são dados dele.

alter table public.calendario_conexoes
  add column if not exists ultimo_diagnostico jsonb;
