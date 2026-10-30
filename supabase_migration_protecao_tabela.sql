-- Dados que a tabela de Proteção precisa: vencimento do plano, valor segurado dos seguros de bens
-- e o membro titular da proteção profissional.

ALTER TABLE planos_saude ADD COLUMN IF NOT EXISTS fim_vigencia date;
ALTER TABLE seguros_extras ADD COLUMN IF NOT EXISTS valor_cobertura numeric;
ALTER TABLE seguros_extras ADD COLUMN IF NOT EXISTS membro text;
