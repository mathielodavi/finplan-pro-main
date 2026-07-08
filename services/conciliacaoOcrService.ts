import { supabase } from './supabaseClient';
import { financeiroService, Parcela } from './financeiroService';
import { extrairArquivo } from '../utils/extracaoConciliacao';
import { gerarSugestoes, normalizarChaveAprendizado, ClienteResumo, SugestaoMatch } from '../utils/matchingConciliacao';
import { toLocalDateString } from '../utils/formatadores';

export type Frente = 'planejamento' | 'extra';

/** Aceita "dd/mm/aaaa" (comum em planilhas/PDFs BR) ou ISO; cai para hoje se não reconhecer. */
const converterDataOriginalParaISO = (dataOriginal?: string): string => {
    if (!dataOriginal) return toLocalDateString(new Date());
    const br = dataOriginal.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) {
        const [, d, m, y] = br;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const iso = dataOriginal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
    const data = new Date(dataOriginal);
    return isNaN(data.getTime()) ? toLocalDateString(new Date()) : toLocalDateString(data);
};

export const conciliacaoOcrService = {
    /** Carrega clientes, parcelas em aberto (na frente escolhida, ordenadas por vencimento) e histórico de aprendizado. */
    async carregarContextoMatching(frente: Frente) {
        const [clientesRes, parcelasRes, historicoRes] = await Promise.all([
            supabase.from('clientes').select('id, nome, email'),
            supabase
                .from('financeiro_parcelas')
                .select('*, contratos!inner(descricao, tipo, repasse_percentual, prazo_recebimento_dias)')
                .in('status', ['pendente', 'atrasado'])
                .eq('contratos.tipo', frente)
                .order('data_vencimento', { ascending: true }),
            supabase.from('conciliacao_aprendizado').select('chave_identificacao, cliente_id').eq('frente', frente),
        ]);

        if (clientesRes.error) throw clientesRes.error;
        if (parcelasRes.error) throw parcelasRes.error;
        if (historicoRes.error) throw historicoRes.error;

        const clientes: ClienteResumo[] = (clientesRes.data || []).map((c: any) => ({ id: c.id, nome: c.nome, email: c.email }));

        const parcelasPorCliente = new Map<string, Parcela[]>();
        ((parcelasRes.data as unknown as Parcela[]) || []).forEach(p => {
            const lista = parcelasPorCliente.get(p.cliente_id) || [];
            lista.push(p);
            parcelasPorCliente.set(p.cliente_id, lista);
        });

        const historico = new Map<string, string>();
        (historicoRes.data || []).forEach((h: any) => historico.set(h.chave_identificacao, h.cliente_id));

        return { clientes, parcelasPorCliente, historico };
    },

    /** Extrai as linhas de todos os arquivos enviados e gera as sugestões de match para revisão. */
    async processarArquivos(files: File[], frente: Frente) {
        const linhasPorArquivo = await Promise.all(files.map(f => extrairArquivo(f)));
        const linhas = linhasPorArquivo.flat();
        const { clientes, parcelasPorCliente, historico } = await this.carregarContextoMatching(frente);
        const sugestoes = gerarSugestoes(linhas, clientes, parcelasPorCliente, historico);
        return { sugestoes, clientes, parcelasPorCliente };
    },

    /**
     * Consolida as sugestões aceitas pelo usuário: registra o pagamento de cada parcela
     * (reaproveitando `financeiroService.registrarPagamento`, com toda a lógica de extensão de
     * contrato ilimitado já existente) e grava/reforça as associações confirmadas na tabela de
     * aprendizado, além de um registro de auditoria da importação.
     */
    async confirmarConciliacao(sugestoes: SugestaoMatch[], frente: Frente, nomeArquivo: string): Promise<{ confirmadas: number }> {
        const { data: { user } } = await supabase.auth.getUser();
        const aceitas = sugestoes.filter(s => s.parcelaId && s.clienteId);

        for (const s of aceitas) {
            const dataPagamento = converterDataOriginalParaISO(s.linha.dataOriginal);
            await financeiroService.registrarPagamento(s.parcelaId!, s.linha.valor, dataPagamento);

            const chavesPorTipo: { chave: string; tipo: 'email' | 'documento' | 'nome_normalizado' }[] = [];
            if (s.linha.emailOriginal) chavesPorTipo.push({ chave: normalizarChaveAprendizado(s.linha.emailOriginal), tipo: 'email' });
            if (s.linha.documentoOriginal) chavesPorTipo.push({ chave: normalizarChaveAprendizado(s.linha.documentoOriginal), tipo: 'documento' });
            chavesPorTipo.push({ chave: normalizarChaveAprendizado(s.linha.nomeOriginal), tipo: 'nome_normalizado' });

            for (const { chave, tipo } of chavesPorTipo) {
                await supabase.from('conciliacao_aprendizado').upsert(
                    {
                        chave_identificacao: chave,
                        tipo_chave: tipo,
                        cliente_id: s.clienteId,
                        frente,
                        confirmado_por: user?.id,
                    },
                    { onConflict: 'chave_identificacao,frente' }
                );
            }
        }

        await supabase.from('conciliacao_importacoes').insert({
            usuario_id: user?.id,
            frente,
            nome_arquivo: nomeArquivo,
            total_linhas: sugestoes.length,
            total_confirmadas: aceitas.length,
        });

        return { confirmadas: aceitas.length };
    },
};
