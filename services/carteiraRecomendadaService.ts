
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
  atualizado_em?: string;
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

/**
 * Aceita os valores literais da constraint quando já vierem corretos (caso do JSON gerado por
 * skill) e só recorre ao `normalizarOrigem` heurístico como fallback — ele testa 'acao' antes de
 * 'fundo', então "Fundo de Ações" cairia em 'bolsa'.
 */
const resolverOrigem = (raw: string): 'bolsa' | 'fundo' | 'bancario' => {
  const v = normalizarTexto(raw || '');
  if (v === 'bolsa' || v === 'fundo' || v === 'bancario') return v;
  return normalizarOrigem(raw);
};

/**
 * Identidade de uma variação dentro de um ativo. O rótulo (`variacoes_fundo`) faz parte da chave
 * porque o identificador de origem sozinho não desambigua todos os casos: "CDB do Daycoval" e
 * "CDB do BMG" são ambos `tipo = 'CDB'` e só se distinguem pelo nome. Retorna '' quando a linha
 * não tem nem identificador nem rótulo — aí o chamador cai no id da linha.
 */
export const chaveVariacaoAtivo = (l: { ticker?: string; cnpj?: string; tipo?: string; variacoes_fundo?: string }): string => {
  const ident = normalizarTexto((l.ticker || l.cnpj || l.tipo || '').trim());
  const rotulo = normalizarTexto(l.variacoes_fundo || '');
  return ident || rotulo ? `${ident}|${rotulo}` : '';
};

const soLetrasNums = (s: string) => normalizarTexto(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Distância de edição (Levenshtein) — para pegar erro de digitação em nome curto. */
const distanciaEdicao = (a: string, b: string): number => {
  if (a === b) return 0;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    anterior = atual;
  }
  return anterior[b.length];
};

/**
 * Similaridade (0 a 1) entre nomes de INSTITUIÇÃO. Não reusa o `scoreSimilaridadeNome` da
 * conciliação: aquele é calibrado para nome de pessoa (exige 2+ tokens com 3+ letras), o que zera
 * casos como "BTG" × "BTG Pactual" ou "XP" × "XP Investimentos". Aqui vale contenção de sigla,
 * sobreposição de tokens e, por último, erro de digitação.
 */
export const scoreInstituicao = (a: string, b: string): number => {
  const na = soLetrasNums(a);
  const nb = soLetrasNums(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // "btg" ⊂ "btg pactual" — sigla ou razão social abreviada.
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  const ta = na.split(' ');
  const tb = nb.split(' ');
  const setB = new Set(tb);
  const comuns = ta.filter(t => setB.has(t)).length;
  if (comuns > 0) return 0.5 + 0.4 * (comuns / Math.min(ta.length, tb.length));

  const ratio = 1 - distanciaEdicao(na, nb) / Math.max(na.length, nb.length);
  return ratio >= 0.75 ? ratio * 0.8 : 0;
};

/** Instituição citada no arquivo que não bate com nenhum banco cadastrado. */
export interface InstituicaoPendente {
  /** Nome exatamente como veio no arquivo. */
  nome: string;
  /** Banco cadastrado mais parecido (null quando nada passou do limiar). */
  sugestao: string | null;
  score: number;
  /** Em quantas linhas da importação esse nome aparece. */
  ocorrencias: number;
}

const LIMIAR_SUGESTAO_INSTITUICAO = 0.6;

// ─── Contrato de importação (skill → app) ─────────────────────────────────────
/**
 * Variação = uma alternativa equivalente do MESMO ativo (ex.: "ETF IRFM11 OU ETF IDKA11",
 * "CDB do Daycoval OU CDB do BMG", ou classes de acesso de um fundo com CNPJs diferentes).
 * Todas herdam os dados compartilhados do ativo e a MESMA alocação — são um "ou", não um "e".
 */
export interface VariacaoImportada {
  /** Nome de exibição da variação (vai para `variacoes_fundo`). */
  nome?: string;
  ticker?: string;
  cnpj?: string;
  tipo?: string;
}

export interface AtivoImportadoCarteira {
  nome_ativo: string;
  asset: string;
  alocacao: number;
  origem?: string;
  ticker?: string;
  cnpj?: string;
  tipo?: string;
  /** Array = variações do ativo. String = rótulo único (formato antigo da planilha). */
  variacoes?: string | VariacaoImportada[];
  instituicao?: string;
  observacoes?: string;
}

/** Um bloco = uma tela da carteira de origem (uma estratégia × uma faixa). */
export interface BlocoCarteira {
  estrategia: string;
  faixa: string;
  ativos: AtivoImportadoCarteira[];
}

export interface BlocoResolvido {
  estrategia: string;
  faixa: string;
  estrategia_id: string;
  faixa_id: string;
  /** Uma linha por (variação × estratégia × faixa) — o grão da tabela. */
  linhas: any[];
  /** Ativos distintos (um ativo com 3 variações = 1 ativo, 3 linhas). */
  ativos: number;
  /** Quantas linhas já existem nesse par e serão substituídas. */
  substituira: number;
}

export interface ResolucaoCarteira {
  blocos: BlocoResolvido[];
  /** Impeditivos: havendo qualquer um, nada é gravado. */
  erros: string[];
  /** Não impeditivos. */
  alertas: string[];
  /** Instituições sem correspondência exata, para o usuário relacionar antes de importar. */
  instituicoes: InstituicaoPendente[];
}

export interface ResultadoImportacaoCarteira {
  blocos: { estrategia: string; faixa: string; inseridos: number; removidos: number }[];
  alertas: string[];
}

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

  /**
   * Faz o parse do JSON colado. Aceita `{ blocos: [...] }` ou um array puro de blocos.
   * Só valida a FORMA aqui; a validação de negócio (estratégia/faixa/classe) é do `resolverBlocos`.
   */
  parseBlocosJSON(texto: string): { blocos: BlocoCarteira[]; erros: string[] } {
    let bruto: any;
    try {
      bruto = JSON.parse(texto);
    } catch {
      return { blocos: [], erros: ['JSON inválido — verifique a formatação.'] };
    }

    const lista: any[] = Array.isArray(bruto) ? bruto : Array.isArray(bruto?.blocos) ? bruto.blocos : [];
    if (lista.length === 0) return { blocos: [], erros: ['Nenhum bloco encontrado (esperado um array "blocos").'] };

    const erros: string[] = [];
    const blocos: BlocoCarteira[] = [];
    lista.forEach((b: any, i: number) => {
      const rotulo = `Bloco ${i + 1}`;
      const estrategia = typeof b?.estrategia === 'string' ? b.estrategia.trim() : '';
      const faixa = typeof b?.faixa === 'string' ? b.faixa.trim() : '';
      if (!estrategia) { erros.push(`${rotulo}: "estrategia" ausente.`); return; }
      if (!faixa) { erros.push(`${rotulo} (${estrategia}): "faixa" ausente.`); return; }
      if (!Array.isArray(b?.ativos) || b.ativos.length === 0) {
        // Bloco vazio apagaria o par inteiro — provavelmente uma tela que a skill não conseguiu ler.
        erros.push(`${rotulo} (${estrategia} · ${faixa}): nenhum ativo informado.`);
        return;
      }
      blocos.push({ estrategia, faixa, ativos: b.ativos });
    });

    return { blocos, erros };
  },

  /**
   * Resolve nomes de estratégia/faixa para os UUIDs, valida cada ativo e monta as linhas prontas
   * para gravação. TODA a validação acontece aqui, ANTES de qualquer escrita — havendo erro, o
   * chamador aborta sem apagar nada (o importador antigo descartava linhas inválidas depois de já
   * ter decidido o delete, o que gerava carteira meio apagada).
   */
  async resolverBlocos(blocos: BlocoCarteira[]): Promise<ResolucaoCarteira> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado');
    const empresaId = user.user_metadata?.empresa_id || user.id;

    const [estrategias, faixas, alocacoes, bancos, atuais] = await Promise.all([
      configService.getEstrategias(),
      supabase.from('estrategias_faixas').select('id, nome, estrategia_id'),
      configService.getAssetAllocations(),
      configService.getBancos(),
      supabase.from('carteiras_recomendadas').select('estrategia_id, faixa_id').eq('empresa_id', empresaId),
    ]);

    const faixasData = faixas.data || [];
    const classes = Array.from(new Set(alocacoes.flatMap(a => a.classes?.map((c: any) => c.nome) || [])));
    const classesNorm = classes.map(c => normalizarTexto(c));
    const nomesBancos = bancos.map(b => normalizarTexto(b.nome));

    // Quantas linhas já existem em cada par (para o preview dizer o que será substituído).
    const existentes = new Map<string, number>();
    (atuais.data || []).forEach((r: any) => {
      const k = `${r.estrategia_id}|${r.faixa_id}`;
      existentes.set(k, (existentes.get(k) || 0) + 1);
    });

    const erros: string[] = [];
    const alertas: string[] = [];
    const pendentes = new Map<string, InstituicaoPendente>();
    const resolvidos: BlocoResolvido[] = [];
    const paresVistos = new Set<string>();
    const carimbo = new Date().toISOString();

    for (const bloco of blocos) {
      const rotulo = `${bloco.estrategia} · ${bloco.faixa}`;

      const est = estrategias.find(e => normalizarTexto(e.nome) === normalizarTexto(bloco.estrategia));
      if (!est) {
        erros.push(`${rotulo}: estratégia "${bloco.estrategia}" não cadastrada. Disponíveis: ${estrategias.map(e => e.nome).join(', ') || '(nenhuma)'}.`);
        continue;
      }

      const fx = faixasData.find(f => f.estrategia_id === est.id && normalizarTexto(f.nome) === normalizarTexto(bloco.faixa));
      if (!fx) {
        const opcoes = faixasData.filter(f => f.estrategia_id === est.id).map(f => f.nome).join(', ');
        erros.push(`${rotulo}: faixa "${bloco.faixa}" não vinculada a ${est.nome}. Disponíveis: ${opcoes || '(nenhuma)'}.`);
        continue;
      }

      const chave = `${est.id}|${fx.id}`;
      if (paresVistos.has(chave)) {
        erros.push(`${rotulo}: bloco duplicado para a mesma estratégia e faixa.`);
        continue;
      }
      paresVistos.add(chave);

      const linhas: any[] = [];
      bloco.ativos.forEach((a: any, i: number) => {
        const pos = `${rotulo}, ativo ${i + 1}`;
        const nome = typeof a?.nome_ativo === 'string' ? a.nome_ativo.trim() : '';
        const asset = typeof a?.asset === 'string' ? a.asset.trim() : '';
        const alocacao = Number(a?.alocacao);

        if (!nome) { erros.push(`${pos}: "nome_ativo" ausente.`); return; }
        if (!asset) { erros.push(`${pos} (${nome}): "asset" (classe) ausente.`); return; }
        // Classe fora das cadastradas nunca casa no Simulador Tático (comparação normalizada
        // exata) — a linha entraria como peso morto, então é impeditivo.
        if (!classesNorm.includes(normalizarTexto(asset))) {
          erros.push(`${pos} (${nome}): classe "${asset}" não existe nas alocações. Disponíveis: ${classes.join(', ') || '(nenhuma)'}.`);
          return;
        }
        if (!isFinite(alocacao)) { erros.push(`${pos} (${nome}): "alocacao" inválida.`); return; }

        if (a?.instituicao) {
          String(a.instituicao).split(',').map((s: string) => s.trim()).filter(Boolean).forEach((inst: string) => {
            if (!nomesBancos.includes(normalizarTexto(inst))) {
              // Não vira alerta solto: entra na fila de relacionamento com a melhor sugestão.
              const atual = pendentes.get(normalizarTexto(inst));
              if (atual) { atual.ocorrencias++; return; }
              const melhor = bancos
                .map((b: any) => ({ nome: b.nome as string, score: scoreInstituicao(inst, b.nome) }))
                .sort((x, y) => y.score - x.score)[0];
              pendentes.set(normalizarTexto(inst), {
                nome: inst,
                sugestao: melhor && melhor.score >= LIMIAR_SUGESTAO_INSTITUICAO ? melhor.nome : null,
                score: melhor?.score || 0,
                ocorrencias: 1,
              });
            }
          });
        }

        // Origem é compartilhada pelo ativo (como no editor manual) e define qual campo identifica
        // cada variação: bolsa→ticker, fundo→cnpj, bancario→tipo.
        const origem = resolverOrigem(a.origem);
        const campoIdent: 'ticker' | 'cnpj' | 'tipo' = origem === 'bolsa' ? 'ticker' : origem === 'fundo' ? 'cnpj' : 'tipo';

        // `variacoes` como array = variações do ativo; como string (ou ausente) = ativo de uma
        // variação só, com os identificadores no próprio ativo (formato da planilha).
        const lista: VariacaoImportada[] = Array.isArray(a?.variacoes) && a.variacoes.length > 0
          ? a.variacoes
          : [{ nome: typeof a?.variacoes === 'string' ? a.variacoes : '', ticker: a.ticker, cnpj: a.cnpj, tipo: a.tipo }];

        const identsVistos = new Set<string>();
        lista.forEach((v: any, vi: number) => {
          const rotuloVar = String(v?.nome || '').trim();
          const posVar = lista.length > 1 ? `${pos} (${nome}), variação ${vi + 1}${rotuloVar ? ` "${rotuloVar}"` : ''}` : `${pos} (${nome})`;
          const ident = String(v?.[campoIdent] || '').trim();

          // Com mais de uma variação, cada uma precisa do identificador da origem do ativo —
          // sem isso elas seriam linhas indistinguíveis.
          if (lista.length > 1 && !ident) {
            const outro = ['ticker', 'cnpj', 'tipo'].filter(c => c !== campoIdent).find(c => String(v?.[c] || '').trim());
            erros.push(outro
              ? `${posVar}: origem "${origem}" exige "${campoIdent}", mas veio "${outro}". Confira a origem do ativo.`
              : `${posVar}: falta "${campoIdent}" (obrigatório quando o ativo tem variações).`);
            return;
          }

          // Só é duplicata se o identificador E o rótulo coincidirem — mesma regra de identidade
          // usada pela tabela e pelo editor manual (ver `chaveVariacaoAtivo`).
          const chaveVar = chaveVariacaoAtivo({ [campoIdent]: ident, variacoes_fundo: rotuloVar } as any);
          if (identsVistos.has(chaveVar)) {
            erros.push(`${posVar}: variação duplicada (mesmo identificador e nome).`);
            return;
          }
          identsVistos.add(chaveVar);

          linhas.push({
            empresa_id: empresaId,
            estrategia_id: est.id,
            faixa_id: fx.id,
            nome_ativo: nome,
            variacoes_fundo: rotuloVar,
            origem_ativo: origem,
            // Espelha o editor manual: só o campo da origem é gravado, os demais ficam vazios.
            ticker: campoIdent === 'ticker' ? ident : '',
            cnpj: campoIdent === 'cnpj' ? ident : '',
            tipo: campoIdent === 'tipo' ? ident : '',
            // Todas as variações compartilham a MESMA alocação (são alternativas, não somam).
            alocacao,
            asset_classe_nome: asset,
            instituicoes: String(a.instituicao || ''),
            observacoes: String(a.observacoes || ''),
            // Linhas importadas nascem "atualizadas hoje" (a importação é uma atualização em massa).
            atualizado_em: carimbo,
          });
        });
      });

      resolvidos.push({
        estrategia: est.nome,
        faixa: fx.nome,
        estrategia_id: est.id,
        faixa_id: fx.id,
        linhas,
        ativos: new Set(linhas.map(l => normalizarTexto(l.nome_ativo))).size,
        substituira: existentes.get(chave) || 0,
      });
    }

    return {
      blocos: resolvidos,
      erros,
      alertas,
      instituicoes: Array.from(pendentes.values()).sort((a, b) => b.ocorrencias - a.ocorrencias),
    };
  },

  /**
   * Reescreve o campo `instituicoes` das linhas conforme o relacionamento decidido pelo usuário.
   * `mapa`: nome vindo do arquivo → nome final. String vazia remove a instituição do ativo
   * (o ativo passa a valer para qualquer instituição). Nomes ausentes do mapa ficam como vieram.
   */
  aplicarMapaInstituicoes(blocos: BlocoResolvido[], mapa: Record<string, string>): BlocoResolvido[] {
    const chaves = Object.keys(mapa);
    if (chaves.length === 0) return blocos;
    const porNorm = new Map(chaves.map(k => [normalizarTexto(k), mapa[k]]));

    return blocos.map(b => ({
      ...b,
      linhas: b.linhas.map(l => {
        if (!l.instituicoes) return l;
        const finais = String(l.instituicoes)
          .split(',').map((s: string) => s.trim()).filter(Boolean)
          .map((inst: string) => {
            const alvo = porNorm.get(normalizarTexto(inst));
            return alvo === undefined ? inst : alvo;
          })
          .filter(Boolean);
        // Dedup preservando a ordem (dois nomes distintos podem mapear para o mesmo banco).
        return { ...l, instituicoes: Array.from(new Set(finais)).join(', ') };
      }),
    }));
  },

  /**
   * Grava os blocos resolvidos com SUBSTITUIÇÃO ESCOPADA: apenas os pares (estratégia × faixa)
   * presentes no payload são trocados; os demais permanecem intactos.
   *
   * Ordem insert→delete de propósito: sem transação no PostgREST, apagar primeiro deixaria o par
   * vazio numa falha de inserção. Inserindo antes, um erro no insert preserva as linhas antigas.
   */
  async aplicarBlocos(blocos: BlocoResolvido[], alertas: string[] = []): Promise<ResultadoImportacaoCarteira> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado');
    const empresaId = user.user_metadata?.empresa_id || user.id;

    const resumo: ResultadoImportacaoCarteira = { blocos: [], alertas };

    for (const bloco of blocos) {
      const { data: antigas, error: selError } = await supabase
        .from('carteiras_recomendadas')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('estrategia_id', bloco.estrategia_id)
        .eq('faixa_id', bloco.faixa_id);
      if (selError) throw new Error(`Erro ao ler ${bloco.estrategia} · ${bloco.faixa}: ${selError.message}`);
      const idsAntigos = (antigas || []).map((r: any) => r.id);

      const { error: insError } = await supabase.from('carteiras_recomendadas').insert(bloco.linhas);
      if (insError) throw new Error(`Erro ao gravar ${bloco.estrategia} · ${bloco.faixa}: ${insError.message}. Nada foi removido.`);

      if (idsAntigos.length > 0) {
        const { error: delError } = await supabase.from('carteiras_recomendadas').delete().in('id', idsAntigos);
        if (delError) throw new Error(`Ativos de ${bloco.estrategia} · ${bloco.faixa} foram inseridos, mas a remoção dos anteriores falhou: ${delError.message}. Verifique duplicidades.`);
      }

      resumo.blocos.push({
        estrategia: bloco.estrategia,
        faixa: bloco.faixa,
        inseridos: bloco.linhas.length,
        removidos: idsAntigos.length,
      });
    }

    return resumo;
  },

  /** Importação por JSON (skill): parse → resolve → aplica. Aborta sem gravar se houver erro. */
  async importarCarteiraJSON(blocos: BlocoCarteira[]): Promise<ResultadoImportacaoCarteira> {
    const resolucao = await this.resolverBlocos(blocos);
    if (resolucao.erros.length > 0) throw new Error(resolucao.erros.join('\n'));
    return this.aplicarBlocos(resolucao.blocos, resolucao.alertas);
  },

  /**
   * Importação por planilha (XLSX/CSV): agrupa as linhas por estratégia × faixa e delega ao mesmo
   * núcleo — herda a substituição escopada e a validação bloqueante.
   */
  async importarCarteira(linhas: any[]): Promise<ResultadoImportacaoCarteira> {
    const porPar = new Map<string, BlocoCarteira>();
    for (const row of linhas) {
      const estrategia = String(row.estrategia || '').trim();
      const faixa = String(row.faixa || '').trim();
      const chave = `${normalizarTexto(estrategia)}|${normalizarTexto(faixa)}`;
      if (!porPar.has(chave)) porPar.set(chave, { estrategia, faixa, ativos: [] });
      porPar.get(chave)!.ativos.push({
        nome_ativo: String(row.nome_ativo || ''),
        asset: String(row.asset || ''),
        alocacao: parseFloat(row.alocacao),
        origem: row.origem,
        ticker: row.ticker,
        cnpj: row.cnpj,
        tipo: row.tipo,
        variacoes: row.variacoes,
        instituicao: row.instituicao,
        observacoes: row.observacoes,
      });
    }
    return this.importarCarteiraJSON(Array.from(porPar.values()));
  },

  /**
   * Insere (sem id) ou atualiza (com id) uma colocação da carteira recomendada — uma linha
   * (estratégia × faixa × ativo). Sempre carimba `atualizado_em = now()`.
   */
  async salvarAtivoRecomendado(row: Partial<AtivoRecomendado>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Não autenticado');
    const empresaId = user.user_metadata?.empresa_id || user.id;

    const { id, estrategias_base, estrategias_faixas, ...rest } = row as any;
    const payload = { ...rest, empresa_id: empresaId, atualizado_em: new Date().toISOString() };

    const { data, error } = id
      ? await supabase.from('carteiras_recomendadas').update(payload).eq('id', id).select().single()
      : await supabase.from('carteiras_recomendadas').insert([payload]).select().single();
    if (error) throw error;
    return data;
  },

  /** Remove uma colocação (linha) da carteira recomendada. */
  async deletarAtivoRecomendado(id: string) {
    const { error } = await supabase.from('carteiras_recomendadas').delete().eq('id', id);
    if (error) throw error;
  },

  /** Remove um ativo de TODAS as estratégias/faixas de uma vez (várias colocações). */
  async deletarGrupoAtivo(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase.from('carteiras_recomendadas').delete().in('id', ids);
    if (error) throw error;
  },

  /** "Check de OK": só renova a data de atualização daquela colocação, sem alterar dados. */
  async marcarAtualizado(id: string) {
    const { error } = await supabase
      .from('carteiras_recomendadas')
      .update({ atualizado_em: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }
};
