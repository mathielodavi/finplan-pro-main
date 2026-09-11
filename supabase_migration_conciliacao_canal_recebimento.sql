-- Suporte ao import JSON de conciliação de recebíveis: para recebimentos da frente
-- "extra", registra o canal usado (pix/transferência/boleto/cartão/outro). Sem
-- constraint NOT NULL — só é preenchido nesse fluxo; permanece null para o restante
-- da carteira (planejamento e conciliações via arquivo/OCR já existentes).
--
-- OBSOLETO: renomeado para `seguradora` e sem lista fixa de valores — ver
-- supabase_migration_conciliacao_seguradora.sql. "Canal de recebimento" foi um
-- entendimento errado do campo: não é o meio de pagamento, é a seguradora/plano de
-- origem da comissão (ex.: Azos, MAG), um universo aberto que não cabe num enum.

alter table public.financeiro_parcelas
  add column if not exists canal_recebimento text
    check (canal_recebimento is null or canal_recebimento in ('pix', 'transferencia', 'boleto', 'cartao', 'outro'));
