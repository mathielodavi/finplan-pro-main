import { supabase } from './supabaseClient';
import { investimentoService } from './investimentoService';
import { normalizarTexto, formatarCNPJ } from '../utils/formatadores';

// ─── Contrato de importação (skill → app) ─────────────────────────────────────
export interface AtivoImportado {
    nome: string;
    valor_atual: number;
    ticker?: string;
    cnpj?: string;
    tipo_ativo?: string;
    origem?: 'bolsa' | 'fundo' | 'bancario' | 'previdencia_privada';
    tipo_especifico?: string;
    tipo_previdencia?: string;
    regime_tributario?: string;
    moeda_origem?: string;
    valor_original?: number;
    cotacao_conversao?: number;
}

export interface PayloadImportacao {
    aporte_periodo?: number;
    ativos: AtivoImportado[];
}

export interface ResultadoImportacao {
    inseridos: number;
    atualizados: number;
    totalCarteira: number;
}

export interface PreviewLinha {
    row: AtivoImportado;
    acao: 'inserir' | 'ajustar';
    valorAnterior?: number;
}

const up = (s?: string) => (s || '').toUpperCase().trim();
const digitos = (s?: string) => (s || '').replace(/\D/g, '');

/** Casa por prioridade ticker → cnpj → nome normalizado (mesmo critério do wizard de Aporte). */
const casarAtivo = (existentes: any[], row: AtivoImportado): any | undefined => {
    const t = up(row.ticker);
    const c = digitos(row.cnpj);
    return (existentes || []).find(a =>
        (t && up(a.ticker) === t) ||
        (c && digitos(a.cnpj) === c) ||
        (normalizarTexto(a.nome) === normalizarTexto(row.nome))
    );
};

const inferirOrigem = (row: AtivoImportado): AtivoImportado['origem'] => {
    if (row.origem) return row.origem;
    if (row.tipo_previdencia) return 'previdencia_privada';
    if (row.ticker) return 'bolsa';
    if (row.cnpj) return 'fundo';
    return 'bancario';
};

export const importacaoService = {
    /**
     * Faz o parse do texto JSON colado e valida os campos mínimos (nome + valor_atual).
     * Aceita tanto `{ aporte_periodo?, ativos: [...] }` quanto um array puro de ativos.
     * Retorna o payload normalizado e a lista de erros (usada no preview antes de gravar).
     */
    parsePayload(texto: string): { payload: PayloadImportacao; erros: string[] } {
        const erros: string[] = [];
        let bruto: any;
        try {
            bruto = JSON.parse(texto);
        } catch {
            return { payload: { ativos: [] }, erros: ['JSON inválido — verifique a formatação.'] };
        }

        const listaBruta: any[] = Array.isArray(bruto) ? bruto : Array.isArray(bruto?.ativos) ? bruto.ativos : [];
        if (listaBruta.length === 0) erros.push('Nenhum ativo encontrado no JSON (esperado um array "ativos").');

        const ativos: AtivoImportado[] = [];
        listaBruta.forEach((r: any, i: number) => {
            const nome = typeof r?.nome === 'string' ? r.nome.trim() : '';
            const valor = Number(r?.valor_atual);
            if (!nome) { erros.push(`Linha ${i + 1}: "nome" ausente.`); return; }
            if (!isFinite(valor)) { erros.push(`Linha ${i + 1} (${nome}): "valor_atual" inválido.`); return; }
            ativos.push({
                nome,
                valor_atual: valor,
                ticker: r.ticker ? String(r.ticker) : undefined,
                cnpj: r.cnpj ? String(r.cnpj) : undefined,
                tipo_ativo: r.tipo_ativo ? String(r.tipo_ativo) : undefined,
                origem: r.origem,
                tipo_especifico: r.tipo_especifico ? String(r.tipo_especifico) : undefined,
                tipo_previdencia: r.tipo_previdencia ? String(r.tipo_previdencia) : undefined,
                regime_tributario: r.regime_tributario ? String(r.regime_tributario) : undefined,
                moeda_origem: r.moeda_origem ? String(r.moeda_origem) : undefined,
                valor_original: isFinite(Number(r.valor_original)) ? Number(r.valor_original) : undefined,
                cotacao_conversao: isFinite(Number(r.cotacao_conversao)) ? Number(r.cotacao_conversao) : undefined,
            });
        });

        const aporte = Number(bruto?.aporte_periodo);
        return { payload: { ativos, aporte_periodo: isFinite(aporte) ? aporte : 0 }, erros };
    },

    /** Classifica cada linha como inserir/ajustar contra a carteira atual (para o preview). */
    classificar(existentes: any[], ativos: AtivoImportado[]): PreviewLinha[] {
        return ativos.map(row => {
            const match = casarAtivo(existentes, row);
            return match
                ? { row, acao: 'ajustar', valorAnterior: match.valor_atual || 0 }
                : { row, acao: 'inserir' };
        });
    },

    /**
     * Importa/sincroniza ativos a partir do payload JSON:
     * - casou → SOBRESCREVE valor_atual (sincronização de saldo), preservando distribuicao_objetivos,
     *   status, classe e origem já cadastrados (campos classificatórios só preenchem se estiverem vazios);
     * - não casou → insere ativo novo (distribuição 100% independência, status Manter).
     * Ao final registra o snapshot mensal em historico_patrimonio (evolução/rentabilidade da carteira).
     */
    async importarAtivosJSON(clienteId: string, payload: PayloadImportacao): Promise<ResultadoImportacao> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');
        const empresaId = user.user_metadata?.empresa_id || user.id;

        const existentes = (await investimentoService.getAtivos(clienteId)) || [];
        let inseridos = 0;
        let atualizados = 0;

        for (const row of payload.ativos) {
            const match = casarAtivo(existentes, row);
            const ticker = row.ticker ? up(row.ticker) : undefined;
            const cnpj = row.cnpj ? formatarCNPJ(row.cnpj) : undefined;
            const origem = inferirOrigem(row);

            if (match) {
                // Sobrescreve o saldo; preenche classificatórios só se o ativo atual estiver sem eles.
                const patch: any = { valor_atual: row.valor_atual, atualizado_em: new Date().toISOString() };
                const preencherSeVazio = (campo: keyof AtivoImportado, valor: any) => {
                    if (valor !== undefined && valor !== '' && !match[campo]) patch[campo] = valor;
                };
                preencherSeVazio('ticker', ticker);
                preencherSeVazio('cnpj', cnpj);
                preencherSeVazio('tipo_ativo', row.tipo_ativo);
                preencherSeVazio('origem', origem);
                preencherSeVazio('tipo_especifico', row.tipo_especifico);
                preencherSeVazio('tipo_previdencia', row.tipo_previdencia);
                preencherSeVazio('regime_tributario', row.regime_tributario);
                preencherSeVazio('moeda_origem', row.moeda_origem);
                preencherSeVazio('valor_original', row.valor_original);
                preencherSeVazio('cotacao_conversao', row.cotacao_conversao);

                const { error } = await supabase.from('ativos').update(patch).eq('id', match.id);
                if (error) throw error;
                atualizados++;
            } else {
                const { error } = await supabase.from('ativos').insert([{
                    cliente_id: clienteId,
                    consultor_id: user.id,
                    empresa_id: empresaId,
                    nome: row.nome,
                    valor_atual: row.valor_atual,
                    ticker: ticker || null,
                    cnpj: cnpj || null,
                    tipo_ativo: row.tipo_ativo || 'Outros',
                    origem,
                    tipo_especifico: row.tipo_especifico || null,
                    tipo_previdencia: row.tipo_previdencia || null,
                    regime_tributario: row.regime_tributario || null,
                    moeda_origem: row.moeda_origem || 'BRL',
                    valor_original: row.valor_original ?? null,
                    cotacao_conversao: row.cotacao_conversao ?? null,
                    distribuicao_objetivos: [{ tipo: 'independencia', percentual: 100 }],
                    status: 'Manter',
                    atualizado_em: new Date().toISOString(),
                }]);
                if (error) throw error;
                inseridos++;
            }
        }

        // Registra a movimentação no histórico da carteira (mesmo mecanismo do salvar/aporte):
        // upsert mensal do patrimônio total; aporte_periodo evita superestimar a rentabilidade.
        const totalCarteira = await investimentoService.snapshotPatrimonioIndependencia(clienteId, payload.aporte_periodo || 0);

        return { inseridos, atualizados, totalCarteira };
    },
};
