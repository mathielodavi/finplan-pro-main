-- Adiciona "Outras fontes de renda" às premissas de independência financeira.
-- A renda considerada no capital de liberdade e na fase de consumo passa a ser
-- líquida: max(0, renda_alvo - outras_fontes_renda).
alter table public.premissas_independencia
  add column if not exists outras_fontes_renda numeric not null default 0;

-- Taxa de rentabilização pós-aposentadoria deixa de ser só o padrão global (Configurações >
-- Investimentos > Parâmetros) e passa a poder ser sobrescrita por cliente. Null = usa o padrão
-- global (protecaoService.getParametros().taxa_juros_aa) como fallback.
alter table public.premissas_independencia
  add column if not exists taxa_pos_aposentadoria numeric null;
