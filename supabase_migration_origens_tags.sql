-- Migration Script: Refatoração de Origens, Tags e Protocolos

-- 1. Tabela: origens
CREATE TABLE IF NOT EXISTS public.origens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- RLS para origens
ALTER TABLE public.origens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver suas próprias origens" ON public.origens FOR SELECT USING (auth.uid() = consultor_id);
CREATE POLICY "Usuários podem inserir suas próprias origens" ON public.origens FOR INSERT WITH CHECK (auth.uid() = consultor_id);
CREATE POLICY "Usuários podem atualizar suas próprias origens" ON public.origens FOR UPDATE USING (auth.uid() = consultor_id);
CREATE POLICY "Usuários podem deletar suas próprias origens" ON public.origens FOR DELETE USING (auth.uid() = consultor_id);

-- 2. Tabela: origem_tags
CREATE TABLE IF NOT EXISTS public.origem_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origem_id UUID REFERENCES public.origens(id) ON DELETE CASCADE,
    consultor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT now()
);

-- RLS para origem_tags
ALTER TABLE public.origem_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver suas próprias tags" ON public.origem_tags FOR SELECT USING (auth.uid() = consultor_id);
CREATE POLICY "Usuários podem inserir suas próprias tags" ON public.origem_tags FOR INSERT WITH CHECK (auth.uid() = consultor_id);
CREATE POLICY "Usuários podem atualizar suas próprias tags" ON public.origem_tags FOR UPDATE USING (auth.uid() = consultor_id);
CREATE POLICY "Usuários podem deletar suas próprias tags" ON public.origem_tags FOR DELETE USING (auth.uid() = consultor_id);

-- 3. Atualização da tabela clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS origem_id UUID REFERENCES public.origens(id) ON DELETE SET NULL;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS protocolo_id UUID REFERENCES public.padroes_acompanhamento(id) ON DELETE SET NULL;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS etiquetas_tags JSONB DEFAULT '[]';

-- Comentários para documentação
COMMENT ON COLUMN public.clientes.origem_id IS 'ID da origem cadastrada na tabela origens';
COMMENT ON COLUMN public.clientes.protocolo_id IS 'ID do protocolo de atendimento (check-list) vinculado';
COMMENT ON COLUMN public.clientes.etiquetas_tags IS 'Lista de tags (etiquetas) selecionadas para o cliente';
