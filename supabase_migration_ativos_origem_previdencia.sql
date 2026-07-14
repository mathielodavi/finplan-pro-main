-- Corrige ativos_origem_check: o formulário de Carteira Ativa já oferece "Previdência Privada
-- (CNPJ)" como origem (com campos próprios tipo_previdencia/regime_tributario), mas o CHECK
-- constraint só aceitava bolsa/fundo/bancario. Resultado: qualquer ativo de previdência privada
-- falhava ao salvar com "violates check constraint ativos_origem_check", surfaced como "Falha ao
-- sincronizar dados." na UI.
alter table public.ativos drop constraint if exists ativos_origem_check;
alter table public.ativos add constraint ativos_origem_check
  check (origem = any (array['bolsa'::text, 'fundo'::text, 'bancario'::text, 'previdencia_privada'::text]));
