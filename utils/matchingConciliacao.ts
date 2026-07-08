import { normalizarTexto } from './formatadores';
import { LinhaExtraida } from './extracaoConciliacao';
import { Parcela } from '../services/financeiroService';

export type ConfiancaMatch = 'historico' | 'nome' | 'sem_correspondencia';

export interface SugestaoMatch {
    linha: LinhaExtraida;
    clienteId: string | null;
    clienteNome: string | null;
    parcelaId: string | null;
    confianca: ConfiancaMatch;
    scoreNome?: number;
}

export interface ClienteResumo {
    id: string;
    nome: string;
    email: string | null;
}

/** Chave normalizada usada tanto para consultar quanto para gravar `conciliacao_aprendizado`. */
export const normalizarChaveAprendizado = (valor: string): string => normalizarTexto(valor).replace(/\s+/g, ' ');

const tokenizar = (nome: string): string[] => normalizarTexto(nome).split(/\s+/).filter(t => t.length >= 3);

/**
 * Similaridade por sobreposição de tokens (0 a 1) — robusta a ordem de nome/sobrenome, acentos
 * e a ruído ao redor do nome (texto extraído por OCR costuma vir com produto/instituição na
 * mesma linha, ex.: "Kelly Novaes da Rocha Seguro de AZOS"). Por isso o denominador é o MENOR
 * conjunto de tokens: mede o quanto o nome mais curto está contido no mais longo. Para evitar
 * falso positivo com um único sobrenome comum, exige ao menos 2 tokens em comum (a menos que
 * ambos os nomes tenham 1 token só).
 */
const scoreSimilaridadeNome = (a: string, b: string): number => {
    const tokensA = tokenizar(a);
    const tokensB = tokenizar(b);
    if (tokensA.length === 0 || tokensB.length === 0) return 0;
    const setB = new Set(tokensB);
    const comuns = tokensA.filter(t => setB.has(t)).length;
    if (comuns < 2 && !(tokensA.length === 1 && tokensB.length === 1)) return 0;
    return comuns / Math.min(tokensA.length, tokensB.length);
};

const LIMIAR_SIMILARIDADE_NOME = 0.5;

/**
 * Gera, para cada linha extraída de um arquivo, uma sugestão de cliente + próxima parcela em
 * aberto. Ordem de prioridade: (1) histórico de conciliações confirmadas anteriormente
 * (email/documento/nome normalizado → cliente_id), (2) email exato do cadastro, (3) fuzzy
 * matching por nome. O valor da linha NUNCA descarta um candidato — só desempata quando dois
 * clientes têm score de nome muito próximo. Múltiplas linhas do mesmo cliente no arquivo são
 * atribuídas, em ordem, às parcelas em aberto mais antigas primeiro (efeito "próxima parcela
 * ainda não conciliada", já considerando as duas dentro do mesmo lote).
 */
export const gerarSugestoes = (
    linhas: LinhaExtraida[],
    clientes: ClienteResumo[],
    parcelasAbertasPorCliente: Map<string, Parcela[]>,
    historico: Map<string, string>
): SugestaoMatch[] => {
    const parcelasUsadasPorCliente = new Map<string, number>();

    return linhas.map(linha => {
        let clienteId: string | null = null;
        let confianca: ConfiancaMatch = 'sem_correspondencia';
        let scoreNome: number | undefined;

        const chaveEmail = linha.emailOriginal ? normalizarChaveAprendizado(linha.emailOriginal) : null;
        const chaveDoc = linha.documentoOriginal ? normalizarChaveAprendizado(linha.documentoOriginal) : null;
        const chaveNome = normalizarChaveAprendizado(linha.nomeOriginal);

        if (chaveEmail && historico.has(chaveEmail)) {
            clienteId = historico.get(chaveEmail)!;
            confianca = 'historico';
        } else if (chaveDoc && historico.has(chaveDoc)) {
            clienteId = historico.get(chaveDoc)!;
            confianca = 'historico';
        } else if (historico.has(chaveNome)) {
            clienteId = historico.get(chaveNome)!;
            confianca = 'historico';
        }

        if (!clienteId && linha.emailOriginal) {
            const porEmail = clientes.find(c => c.email && normalizarTexto(c.email) === normalizarTexto(linha.emailOriginal!));
            if (porEmail) {
                clienteId = porEmail.id;
                confianca = 'nome';
                scoreNome = 1;
            }
        }

        if (!clienteId) {
            const candidatos = clientes
                .map(c => ({ c, score: scoreSimilaridadeNome(linha.nomeOriginal, c.nome) }))
                .filter(x => x.score >= LIMIAR_SIMILARIDADE_NOME)
                .sort((a, b) => b.score - a.score);

            if (candidatos.length > 0) {
                const melhorScore = candidatos[0].score;
                const empatados = candidatos.filter(x => x.score >= melhorScore - 0.001);
                let escolhido = empatados[0];

                if (empatados.length > 1) {
                    // Desempate: valor da linha mais próximo do valor previsto da próxima parcela em aberto.
                    escolhido = empatados.reduce((melhor, atual) => {
                        const proxMelhor = parcelasAbertasPorCliente.get(melhor.c.id)?.[0];
                        const proxAtual = parcelasAbertasPorCliente.get(atual.c.id)?.[0];
                        const distMelhor = proxMelhor ? Math.abs(proxMelhor.valor_previsto - linha.valor) : Infinity;
                        const distAtual = proxAtual ? Math.abs(proxAtual.valor_previsto - linha.valor) : Infinity;
                        return distAtual < distMelhor ? atual : melhor;
                    });
                }

                clienteId = escolhido.c.id;
                confianca = 'nome';
                scoreNome = escolhido.score;
            }
        }

        let clienteNome: string | null = null;
        let parcelaId: string | null = null;

        if (clienteId) {
            clienteNome = clientes.find(c => c.id === clienteId)?.nome || null;
            const disponiveis = parcelasAbertasPorCliente.get(clienteId) || [];
            const jaUsadas = parcelasUsadasPorCliente.get(clienteId) || 0;
            const parcela = disponiveis[jaUsadas];
            if (parcela) {
                parcelaId = parcela.id;
                parcelasUsadasPorCliente.set(clienteId, jaUsadas + 1);
            }
        }

        return {
            linha,
            clienteId,
            clienteNome,
            parcelaId,
            confianca: parcelaId ? confianca : 'sem_correspondencia',
            scoreNome,
        };
    });
};
