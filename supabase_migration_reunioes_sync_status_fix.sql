-- Corrige o bug em que uma reunião marcada como "realizada" pelo consultor voltava
-- para "agendada" sozinha: a sync-calendarios reaproveitava a única linha "gerenciada
-- pelo sync" (calendario_evento_uid IS NOT NULL) do cliente para QUALQUER ocorrência
-- futura do evento recorrente, mesmo já concluída, porque o índice único abaixo
-- proibia mais de uma linha com calendario_evento_uid por cliente, independente do
-- status. Agora a Edge Function só reaproveita uma linha 'agendada' (ver
-- supabase/functions/sync-calendarios/index.ts); o índice precisa acompanhar essa
-- regra, senão o INSERT de uma nova reunião "agendada" para o próximo evento falha
-- quando já existe uma linha 'realizada' antiga vinculada ao mesmo cliente.

drop index if exists reunioes_calendario_por_cliente_idx;

create unique index if not exists reunioes_calendario_por_cliente_idx
  on public.reunioes (cliente_id)
  where calendario_evento_uid is not null and status = 'agendada';
