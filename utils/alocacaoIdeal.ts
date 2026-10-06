import { normalizarTexto } from './formatadores';

/** Campos da linha de `carteiras_recomendadas` usados no cálculo do ideal. */
export interface LinhaRecomendadaPeso {
    estrategia_id?: string;
    faixa_id?: string;
    nome_ativo?: string;
    asset_classe_nome?: string;
    alocacao?: number;
}

export const chaveFaixaClasse = (faixaId: string | undefined, classe: string | undefined): string =>
    `${faixaId || ''}|${normalizarTexto(classe || '')}`;

/**
 * Soma dos pesos (`alocacao`) da carteira recomendada por (faixa, classe), restrita à estratégia
 * (tese) do cliente. Variações do mesmo ativo (linhas com o mesmo `nome_ativo` e `variacoes_fundo`
 * diferente) compartilham a MESMA alocação — são alternativas, não somam — então cada ativo conta
 * uma única vez por (faixa, classe). O denominador cobre a classe inteira da carteira ideal,
 * independente de o cliente possuir ou não cada ativo.
 */
export const somarPesosPorFaixaClasse = (
    carteiraRec: LinhaRecomendadaPeso[],
    estrategiaId: string | undefined
): Map<string, number> => {
    const somas = new Map<string, number>();
    if (!estrategiaId) return somas;

    const jaContados = new Set<string>();
    carteiraRec.forEach(r => {
        if (r.estrategia_id !== estrategiaId) return;
        const chaveClasse = chaveFaixaClasse(r.faixa_id, r.asset_classe_nome);
        const chaveAtivo = `${chaveClasse}|${normalizarTexto(r.nome_ativo || '')}`;
        if (jaContados.has(chaveAtivo)) return;
        jaContados.add(chaveAtivo);
        somas.set(chaveClasse, (somas.get(chaveClasse) || 0) + (Number(r.alocacao) || 0));
    });
    return somas;
};

/**
 * Alocação ideal do ativo DENTRO da classe, em % (mesma base de "Aloc. Classe"): peso do ativo
 * na carteira recomendada ÷ soma dos pesos da classe. Null quando não há peso/denominador.
 */
export const idealNaClasse = (
    linha: LinhaRecomendadaPeso,
    somasPorFaixaClasse: Map<string, number>
): number | null => {
    const peso = Number(linha.alocacao) || 0;
    const soma = somasPorFaixaClasse.get(chaveFaixaClasse(linha.faixa_id, linha.asset_classe_nome)) || 0;
    if (!(peso > 0) || !(soma > 0)) return null;
    return (peso / soma) * 100;
};
