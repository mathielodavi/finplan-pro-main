
import { supabase } from './supabaseClient';
import { normalizarTexto } from '../utils/formatadores';
import { configService } from './configuracoesService';

export interface AtivoRecomendado {
  id?: string;
  estrategia_id: string;
  faixa_id: string;
  nome_ativo: string;
  variacoes_fundo?: string;
  origem_ativo: 'bolsa' | 'fundo' | 'bancario';
  ticker?: string;
  cnpj?: string;
  tipo?: string;
  alocacao: number;
  asset_classe_nome: string;
  instituicoes?: string;
  observacoes?: string;
  empresa_id: string;
}

/**
 * Mapeia e normaliza a string de origem vinda da planilha para os valores aceitos pela constraint do banco:
 * 'bolsa', 'fundo' ou 'bancario'
 */
const normalizarOrigem = (origemRaw: string): 'bolsa' | 'fundo' | 'bancario' => {
  const normalized = normalizarTexto(origemRaw || '');
  
  if (normalized.includes('bolsa') || normalized.includes('acao') || normalized.includes('stock') || normalized.includes('etf')) {
    return 'bolsa';
  }
  if (normalized.includes('fundo') || normalized.includes('fii')) {
    return 'fundo';
  }
  if (normalized.includes('bancario') || normalized.includes('fixa') || normalized.includes('tesouro') || normalized.includes('cdb') || normalized.includes('caixa')) {
    return 'bancario';
  }
  
  // Default de segurança caso venha algo inesperado
  return 'bolsa';
};

export const carteiraRecomendadaService = {
  async listarAtivos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const targetId = user.user_metadata?.empresa_id || user.id;

    const { data, error } = await supabase
      .from('carteiras_recomendadas')
      .select(`
        *,
        estrategias_base (nome),
        estrategias_faixas (nome)
      `)
      .eq('empresa_id', targetId)
      .order('nome_ativo');
      
    if (error) {
      console.error("Erro ao listar ativos da carteira:", error);
      return [];
    }
    return data;
  },

  async importarCarteira(linhas: any[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");
    const empresaId = user.user_metadata?.empresa_id || user.id;

    // 1. Carregar metadados para validação
    const [estrategias, faixas, alocacoes, bancos] = await Promise.all([
      configService.getEstrategias(),
      supabase.from('estrategias_faixas').select('id, nome, estrategia_id'),
      configService.getAssetAllocations(),
      configService.getBancos()
    ]);

    const faixasData = faixas.data || [];
    const classesAtivos = Array.from(new Set(alocacoes.flatMap(a => a.classes?.map((c: any) => normalizarTexto(c.nome)) || [])));
    const nomesBancos = bancos.map(b => normalizarTexto(b.nome));

    const resultados = { 
      sucessos: 0, 
      alertas: [] as string[] 
    };

    const novosRegistros: any[] = [];

    for (const [idx, row] of linhas.entries()) {
      const nLinha = idx + 2;
      
      // Validação Estratégia
      const estMatch = estrategias.find(e => normalizarTexto(e.nome) === normalizarTexto(row.estrategia));
      if (!estMatch) {
        resultados.alertas.push(`Linha ${nLinha}: Estratégia "${row.estrategia}" não cadastrada.`);
        continue;
      }

      // Validação Faixa
      const faixaMatch = faixasData.find(f => f.estrategia_id === estMatch.id && normalizarTexto(f.nome) === normalizarTexto(row.faixa));
      if (!faixaMatch) {
        resultados.alertas.push(`Linha ${nLinha}: Faixa "${row.faixa}" não vinculada à estratégia ${row.estrategia}.`);
        continue;
      }

      // Validação Asset (Classe de Ativo)
      if (!classesAtivos.includes(normalizarTexto(row.asset))) {
        resultados.alertas.push(`Linha ${nLinha}: Asset/Classe "${row.asset}" não existe nas alocações.`);
      }

      // Validação Instituições
      if (row.instituicao) {
        const insts = String(row.instituicao).split(',').map((s: string) => s.trim());
        insts.forEach((inst: string) => {
          if (!nomesBancos.includes(normalizarTexto(inst))) {
            resultados.alertas.push(`Linha ${nLinha}: Instituição "${inst}" não cadastrada.`);
          }
        });
      }

      novosRegistros.push({
        empresa_id: empresaId,
        estrategia_id: estMatch.id,
        faixa_id: faixaMatch.id,
        nome_ativo: String(row.nome_ativo || ''),
        variacoes_fundo: String(row.variacoes || ''),
        origem_ativo: normalizarOrigem(row.origem),
        ticker: String(row.ticker || ''),
        cnpj: String(row.cnpj || ''),
        tipo: String(row.tipo || ''),
        alocacao: parseFloat(row.alocacao) || 0,
        asset_classe_nome: String(row.asset || ''),
        instituicoes: String(row.instituicao || ''),
        observacoes: String(row.observacoes || '')
      });
    }

    if (novosRegistros.length > 0) {
      // SUBSTITUIÇÃO TOTAL: Remove registros antigos da empresa antes de inserir novos
      const { error: delError } = await supabase.from('carteiras_recomendadas').delete().eq('empresa_id', empresaId);
      if (delError) console.warn("Erro ao limpar carteira anterior (pode estar vazia):", delError);
      
      const { error: insError } = await supabase.from('carteiras_recomendadas').insert(novosRegistros);
      
      if (insError) {
        console.error("Erro técnico na inserção (Verifique o SQL):", insError);
        throw new Error(`Erro ao salvar no banco: ${insError.message}`);
      }
      
      resultados.sucessos = novosRegistros.length;
    }

    return resultados;
  }
};
