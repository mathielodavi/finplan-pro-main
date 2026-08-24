-- Reformulação do cadastro de dívidas de crédito: situação (em dia/em atraso) com âncora
-- de parcela do último pagamento, e taxa nominal informativa (separada do CET).
-- outstanding_balance/remaining_installments/end_date passam a ser sempre calculados
-- pela aplicação (não editados manualmente no formulário), mas as colunas permanecem
-- (mesmo formato/NOT NULL) para não quebrar leitores existentes (ex.: getSaldoDevedorPorCliente).

alter table public.dividas_credito
  add column if not exists situacao text not null default 'em_dia'
    check (situacao in ('em_dia', 'em_atraso'));

alter table public.dividas_credito
  add column if not exists parcela_ultimo_pagamento integer;

alter table public.dividas_credito
  add constraint dividas_credito_parcela_ultimo_pagamento_check
    check (situacao = 'em_dia' or parcela_ultimo_pagamento is not null);

alter table public.dividas_credito
  add column if not exists taxa_nominal numeric(6,4);

alter table public.dividas_credito
  add column if not exists taxa_nominal_unidade text
    check (taxa_nominal_unidade in ('am', 'aa'));
