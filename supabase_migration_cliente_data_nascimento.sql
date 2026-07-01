-- Vincula os dados de identificação do titular (e-mail, telefone, estado e data de
-- nascimento) ao cadastro do cliente, tornando a tabela `clientes` a fonte única.
-- A tela de Proteção (clientes_seguros) passa a apenas espelhar esses campos.

-- 1. Nova coluna de data de nascimento no cadastro do cliente
alter table public.clientes add column if not exists data_nascimento date;

-- 2. Backfill: traz a data de nascimento já preenchida no levantamento de proteção
update public.clientes c
set data_nascimento = cs.data_nascimento_cliente
from public.clientes_seguros cs
where cs.cliente_id = c.id
  and c.data_nascimento is null
  and cs.data_nascimento_cliente is not null;

-- 3. Backfill: preenche e-mail/telefone/estado do cadastro a partir do levantamento,
--    somente quando o cadastro estiver vazio (não sobrescreve dados existentes).
update public.clientes c
set email    = coalesce(nullif(c.email, ''),    cs.email_cliente),
    telefone = coalesce(nullif(c.telefone, ''), cs.telefone_cliente),
    estado   = coalesce(nullif(c.estado, ''),   cs.estado_cliente)
from public.clientes_seguros cs
where cs.cliente_id = c.id;
