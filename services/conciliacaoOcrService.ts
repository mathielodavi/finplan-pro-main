import { supabase } from './supabaseClient';
import { financeiroService, Parcela } from './financeiroService';
import { extrairArquivo } from '../utils/extracaoConciliacao';
import { gerarSugestoes, normalizarChaveAprendizado, ClienteResumo } from '../utils/matchingConciliacao';
import { LinhaExtraida } from '../utils/extracaoConciliacao';
import { toLocalDateString } from '../utils/formatadores';

export type Frente = 'planejamento' | 'extra';

/** Uma parcela alvo de uma linha extraída, com o valor a ser baixado nela (rateio de Dividir/Agregar). */
export interface AlvoBaixa {
    parcelaId: string;
    valorAlocado: number;
}

/** Item pronto para consolidação: a linha extraída, o cliente e suas parcelas-alvo (1 ou N). */
export interface LinhaConfirmacao {
    linha: LinhaExtraida;
    clienteId: string;
    alvos: AlvoBaixa[];
}

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
    async confirmarConciliacao(itens: LinhaConfirmacao[], frente: Frente, nomeArquivo: string): Promise<{ confirmadas: number }> {
        const { data: { user } } = await supabase.auth.getUser();
        const aceitas = itens.filter(i => i.clienteId && i.alvos.some(a => a.parcelaId));

        let parcelasBaixadas = 0;

        for (const item of aceitas) {
            const dataPagamento = converterDataOriginalParaISO(item.linha.dataOriginal);

            // Uma linha pode baixar 1 parcela (1:1), dividir o recebimento entre 2 ou
            // agregar N parcelas — cada alvo recebe seu valor rateado.
            for (const alvo of item.alvos) {
                if (!alvo.parcelaId) continue;
                await financeiroService.registrarPagamento(alvo.parcelaId, alvo.valorAlocado, dataPagamento);
                parcelasBaixadas++;
            }

            const chavesPorTipo: { chave: string; tipo: 'email' | 'documento' | 'nome_normalizado' }[] = [];
            if (item.linha.emailOriginal) chavesPorTipo.push({ chave: normalizarChaveAprendizado(item.linha.emailOriginal), tipo: 'email' });
            if (item.linha.documentoOriginal) chavesPorTipo.push({ chave: normalizarChaveAprendizado(item.linha.documentoOriginal), tipo: 'documento' });
            chavesPorTipo.push({ chave: normalizarChaveAprendizado(item.linha.nomeOriginal), tipo: 'nome_normalizado' });

            for (const { chave, tipo } of chavesPorTipo) {
                await supabase.from('conciliacao_aprendizado').upsert(
                    {
                        chave_identificacao: chave,
                        tipo_chave: tipo,
                        cliente_id: item.clienteId,
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
            total_linhas: itens.length,
            total_confirmadas: parcelasBaixadas,
        });

        return { confirmadas: parcelasBaixadas };
    },

    /**
     * "Replicar": corrige o valor esperado das parcelas SEGUINTES em aberto do mesmo contrato,
     * a partir do valor líquido (pós-repasse) apontado na conciliação — elimina ruído de cálculo/regra
     * para que as próximas conciliações batam limpo. Reconstrói o bruto (`valor_previsto`) pelo repasse
     * do contrato. Só afeta parcelas pendentes/atrasadas com vencimento POSTERIOR à parcela de referência.
     */
    async replicarValorLiquido(contratoId: string, aposVencimento: string, liquidoAlvo: number): Promise<{ atualizadas: number }> {
        const { data: contrato, error: contratoErr } = await supabase
            .from('contratos')
            .select('repasse_percentual')
            .eq('id', contratoId)
            .single();
        if (contratoErr) throw contratoErr;

        const repasse = (contrato?.repasse_percentual ?? 100) / 100;
        const brutoCorrigido = repasse > 0 ? liquidoAlvo / repasse : liquidoAlvo;

        const { data, error } = await supabase
            .from('financeiro_parcelas')
            .update({ valor_previsto: brutoCorrigido })
            .eq('contrato_id', contratoId)
            .in('status', ['pendente', 'atrasado'])
            .gt('data_vencimento', aposVencimento)
            .select('id');
        if (error) throw error;

        return { atualizadas: data?.length || 0 };
    },
};
