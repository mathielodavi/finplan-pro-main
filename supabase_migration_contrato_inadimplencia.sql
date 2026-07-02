-- Data de inadimplência do contrato. Usada no cancelamento: quando anterior à data
-- de cancelamento, o corte de parcelas passa a respeitar a inadimplência, sem aplicar
-- a carência (prazo de recebimento).
alter table public.contratos add column if not exists data_inadimplencia date;
