
# Setup do Banco de Dados - Vibe Financeiro Pro

Execute o script abaixo no **SQL Editor** do seu projeto Supabase para configurar ou atualizar a estrutura necessária.

### 1. Tabelas de Identidade e Empresas
```sql
-- Criar tabela de empresas
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    email TEXT,
    telefone TEXT,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de perfis vinculada ao Auth
CREATE TABLE IF NOT EXISTS public.perfis (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT UNIQUE,
    role TEXT DEFAULT 'CONSULTOR', -- MASTER, CONSULTOR, EMPRESA
    empresa_id UUID REFERENCES public.empresas(id),
    avatar_url TEXT,
    telefone TEXT,
    status TEXT DEFAULT 'Ativo',
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- Gatilho para criar perfil automático ao registrar no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfis (id, full_name, email, role, empresa_id)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'CONSULTOR'),
    (new.raw_user_meta_data->>'empresa_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 2. Estrutura de Clientes e Planejamento
```sql
-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultor_id UUID REFERENCES public.perfis(id),
    empresa_id UUID REFERENCES public.empresas(id),
    nome TEXT NOT NULL,
    patrimonio_total NUMERIC DEFAULT 0,
    aporte_mensal NUMERIC DEFAULT 0,
    reserva_recomendada NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Ativo',
    etapa_atual TEXT DEFAULT 'Prospecção',
    status_atendimento TEXT,
    tese_investimento_id UUID,
    estrategia_padrao_id UUID,
    observacoes TEXT,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Contratos (COM CORREÇÃO DE padrao_id)
CREATE TABLE IF NOT EXISTS public.contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    consultor_id UUID REFERENCES public.perfis(id),
    empresa_id UUID REFERENCES public.empresas(id),
    padrao_id UUID, -- Coluna essencial para vínculos com modelos
    tipo TEXT CHECK (tipo IN ('planejamento', 'extra')),
    descricao TEXT,
    valor NUMERIC NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE,
    status TEXT DEFAULT 'ativo',
    forma_pagamento TEXT DEFAULT 'parcelado',
    prazo_meses INTEGER DEFAULT 12,
    prazo_recebimento_dias INTEGER DEFAULT 30,
    repasse_percentual NUMERIC DEFAULT 100,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Parcelas Financeiras
CREATE TABLE IF NOT EXISTS public.financeiro_parcelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    valor_previsto NUMERIC NOT NULL,
    valor_pago NUMERIC,
    data_vencimento DATE NOT NULL,
    data_pagamento TIMESTAMPTZ,
    status TEXT DEFAULT 'pendente',
    criado_em TIMESTAMPTZ DEFAULT now()
);
```

### 3. SQL de Correção (Execute se houver erro de coluna ausente ou erro ao excluir modelos)
```sql
-- 1. Adiciona a coluna se não existir
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS padrao_id UUID;

-- 2. Ajusta restrição para permitir exclusão do modelo sem apagar o contrato do cliente
-- Para modelos de Planejamento
ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS fk_contratos_padrao_planejamento;
ALTER TABLE public.contratos ADD CONSTRAINT fk_contratos_padrao_planejamento 
    FOREIGN KEY (padrao_id) REFERENCES public.padroes_contrato_planejamento(id) ON DELETE SET NULL;

-- Para modelos Extras
ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS fk_contratos_padrao_extra;
ALTER TABLE public.contratos ADD CONSTRAINT fk_contratos_padrao_extra 
    FOREIGN KEY (padrao_id) REFERENCES public.padroes_contrato_extra(id) ON DELETE SET NULL;

-- 3. Ajusta fases para serem apagadas quando o modelo extra for excluído
ALTER TABLE public.padroes_contrato_extra_fases 
    DROP CONSTRAINT IF EXISTS padroes_contrato_extra_fases_padrao_contrato_extra_id_fkey,
    ADD CONSTRAINT padroes_contrato_extra_fases_padrao_contrato_extra_id_fkey 
    FOREIGN KEY (padrao_contrato_extra_id) REFERENCES public.padroes_contrato_extra(id) ON DELETE CASCADE;

-- Atualizar cache do PostgREST
NOTIFY pgrst, 'reload schema';
```
