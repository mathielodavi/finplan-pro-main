-- Suporte ao import JSON de conciliação de recebíveis: para recebimentos da frente
-- "extra", registra o canal usado (pix/transferência/boleto/cartão/outro). Sem
-- constraint NOT NULL — só é preenchido nesse fluxo; permanece null para o restante
-- da carteira (planejamento e conciliações via arquivo/OCR já existentes).

alter table public.financeiro_parcelas
  add column if not exists canal_recebimento text
    check (canal_recebimento is null or canal_recebimento in ('pix', 'transferencia', 'boleto', 'cartao', 'outro'));
