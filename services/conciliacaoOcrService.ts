import { supabase } from './supabaseClient';
import { financeiroService, Parcela } from './financeiroService';
import { extrairArquivo, extrairDeJson, Frente, LinhaExtraida } from '../utils/extracaoConciliacao';
import { gerarSugestoes, normalizarChaveAprendizado, ClienteResumo, SugestaoMatch } from '../utils/matchingConciliacao';
import { toLocalDateString } from '../utils/formatadores';

export type { Frente };

/** Uma parcela alvo de uma linha extraída, com o valor a ser baixado nela (rateio de Dividir/Agregar). */
export interface AlvoBaixa {
    parcelaId: string;
    valorAlocado: number;
}

/** Item pronto para consolidação: a linha extraída, o cliente e suas parcelas-alvo (1 ou N).
 * `frente` vem da própria linha no import JSON (cada linha pode ter a sua); nos fluxos antigos
 * de arquivo/OCR, sempre a única frente escolhida no drawer antes do upload. */
export interface LinhaConfirmacao {
    linha: LinhaExtraida;
    clienteId: string;
    alvos: AlvoBaixa[];
    frente: Frente;
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
     * Faz o parse do JSON colado e gera as sugestões de match — cada recebimento pode ter sua
     * própria frente (planejamento ou extra), ao contrário do upload de arquivo, que usa uma
     * frente só para o lote inteiro. Por isso carrega o contexto de matching (parcelas em aberto
     * + histórico de aprendizado) separadamente por frente e roda `gerarSugestoes` uma vez para
     * cada grupo, preservando o isolamento (um recebimento de "extra" nunca sugere uma parcela
     * de "planejamento", e vice-versa).
     */
    async processarJson(jsonTexto: string) {
        const { linhas, erros } = extrairDeJson(jsonTexto);
        if (linhas.length === 0) return { sugestoes: [] as SugestaoMatch[], clientes: [] as ClienteResumo[], parcelasPorClienteFrente: {} as Record<Frente, Map<string, Parcela[]>>, erros };

        const frentesPresentes = Array.from(new Set(linhas.map(l => l.frente as Frente)));
        const contextosPorFrente = new Map<Frente, Awaited<ReturnType<typeof this.carregarContextoMatching>>>();
        for (const f of frentesPresentes) {
            contextosPorFrente.set(f, await this.carregarContextoMatching(f));
        }

        // Clientes são os mesmos independente da frente (não são filtrados por ela) — usa o
        // primeiro contexto carregado como fonte.
        const clientes = contextosPorFrente.get(frentesPresentes[0])!.clientes;

        const parcelasPorClienteFrente = {} as Record<Frente, Map<string, Parcela[]>>;
        let sugestoes: SugestaoMatch[] = [];
        for (const f of frentesPresentes) {
            const ctx = contextosPorFrente.get(f)!;
            parcelasPorClienteFrente[f] = ctx.parcelasPorCliente;
            const linhasDaFrente = linhas.filter(l => l.frente === f);
            sugestoes = sugestoes.concat(gerarSugestoes(linhasDaFrente, clientes, ctx.parcelasPorCliente, ctx.historico));
        }

        return { sugestoes, clientes, parcelasPorClienteFrente, erros };
    },

    /**
     * Consolida as sugestões aceitas pelo usuário: registra o pagamento de cada parcela
     * (reaproveitando `financeiroService.registrarPagamento`, com toda a lógica de extensão de
     * contrato ilimitado já existente), grava a seguradora/plano quando a linha trouxer uma
     * (import JSON, frente "extra"), e grava/reforça as associações confirmadas na tabela de
     * aprendizado, além de um registro de auditoria da importação.
     *
     * `frente` é lida de cada item (`item.frente`), não recebida como parâmetro único — um mesmo
     * lote (import JSON) pode misturar planejamento e extras. A tabela de auditoria
     * (`conciliacao_importacoes`) exige uma frente só por linha, então um registro é gravado por
     * frente distinta presente no lote confirmado.
     */
    async confirmarConciliacao(itens: LinhaConfirmacao[], nomeArquivo: string): Promise<{ confirmadas: number }> {
        const { data: { user } } = await supabase.auth.getUser();
        const aceitas = itens.filter(i => i.clienteId && i.alvos.some(a => a.parcelaId));

        let parcelasBaixadas = 0;
        const porFrente = new Map<Frente, number>();

        for (const item of aceitas) {
            const dataPagamento = converterDataOriginalParaISO(item.linha.dataOriginal);
            porFrente.set(item.frente, (porFrente.get(item.frente) || 0) + 1);

            // Uma linha pode baixar 1 parcela (1:1), dividir o recebimento entre 2 ou
            // agregar N parcelas — cada alvo recebe seu valor rateado.
            for (const alvo of item.alvos) {
                if (!alvo.parcelaId) continue;
                await financeiroService.registrarPagamento(alvo.parcelaId, alvo.valorAlocado, dataPagamento, item.linha.seguradora);
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
                        frente: item.frente,
                        confirmado_por: user?.id,
                    },
                    { onConflict: 'chave_identificacao,frente' }
                );
            }
        }

        for (const [f, totalConfirmadasFrente] of porFrente.entries()) {
            const totalLinhasFrente = itens.filter(i => i.frente === f).length;
            await supabase.from('conciliacao_importacoes').insert({
                usuario_id: user?.id,
                frente: f,
                nome_arquivo: nomeArquivo,
                total_linhas: totalLinhasFrente,
                total_confirmadas: totalConfirmadasFrente,
            });
        }

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
