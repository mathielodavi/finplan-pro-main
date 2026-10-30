
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Shield, Pencil, MessageCircle, Download, Activity
} from 'lucide-react';
import SidePanel from '../UI/SidePanel';
import { ClienteSeguro, DependenteSeguro, ParametrosCalculo, PlanoSaude, SeguroExtra, SeguroVida, protecaoService } from '../../services/protecaoService';
import { calcularCoberturaVida, calcularSucessao } from '../../utils/calculosFinanceiros';
import { calcularReservaIdeal } from '../../utils/protecaoUtils';
import { EntradaProtecao, LinhaProtecao, MembroProtecao, TIPO_SEGURO_PROFISSIONAL, linhasFamilia, linhasMembro } from '../../utils/protecaoTabela';
import { patrimonioService, BemPatrimonial } from '../../services/patrimonioService';
import { toLocalDateString } from '../../utils/formatadores';
import TabelaProtecao, { NovaCobertura } from './TabelaProtecao';
import ModalCoberturas, { ApoliceParaExcluir } from './ModalCoberturas';
import AcordeoReservaEmergencia from './AcordeoReservaEmergencia';
import FormPlanoSaude from './FormPlanoSaude';
import FormSeguroVida from './FormSeguroVida';
import FormSeguroExtra from './FormSeguroExtra';
import Confirmacao from '../Confirmacao';
import RelatorioProtecaoDoc from './RelatorioProtecaoDoc';
import { supabase } from '../../services/supabaseClient';
import { baixarPaginasComoPDF } from '../../utils/pdfFromElement';
import { toast } from '../../utils/toast';

const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;
const fmtDataHoje = () => new Date().toLocaleDateString('pt-BR');

interface Props {
    dados: ClienteSeguro;
    dependentes: DependenteSeguro[];
    parametros: ParametrosCalculo;
    nomeCliente?: string;
    onEditar: () => void;
    /** Titular, cônjuge e familiares. */
    membros: MembroProtecao[];
    /** Visão aberta no submenu: chave do membro, ou null para a família. */
    membroAtivo: string | null;
    /** Reflete no levantamento o que foi alterado na configuração da reserva. */
    onAtualizar: (campos: Partial<ClienteSeguro>) => void;
}

type Editor =
    | { tipo: 'plano'; apolice: Partial<PlanoSaude> }
    | { tipo: 'vida'; apolice: Partial<SeguroVida> }
    | { tipo: 'extra'; apolice: Partial<SeguroExtra> };

const TIPO_SEGURO_DA_COBERTURA: Partial<Record<NovaCobertura, string>> = {
    imobiliario: 'Residencial',
    veicular: 'Automotivo',
    empresarial: 'Empresarial',
    profissional: TIPO_SEGURO_PROFISSIONAL,
};

const EXCLUIR_APOLICE: Record<ApoliceParaExcluir['tipo'], (id: string) => Promise<void>> = {
    plano: id => protecaoService.deletePlanoSaude(id),
    vida: id => protecaoService.deleteSeguroVida(id),
    extra: id => protecaoService.deleteSeguroExtra(id),
};

const DashboardProtecao: React.FC<Props> = ({ dados: dadosIniciais, dependentes, parametros, nomeCliente, onEditar, membros, membroAtivo, onAtualizar }) => {
    const [dados, setDados] = useState<ClienteSeguro>(dadosIniciais);
    const [configurandoReserva, setConfigurandoReserva] = useState(false);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [paraExcluir, setParaExcluir] = useState<ApoliceParaExcluir | null>(null);
    const [excluindo, setExcluindo] = useState(false);
    const [linhaAberta, setLinhaAberta] = useState<LinhaProtecao | null>(null);
    const [score, setScore] = useState(0);
    const [ativos, setAtivos] = useState<any[]>([]);
    const [seguros, setSeguros] = useState<SeguroVida[]>([]);
    const [planos, setPlanos] = useState<PlanoSaude[]>([]);
    const [extras, setExtras] = useState<SeguroExtra[]>([]);
    const [bens, setBens] = useState<BemPatrimonial[]>([]);
    const [reservaRecomendada, setReservaRecomendada] = useState(0);
    const [planejadorEmail, setPlanejadorEmail] = useState('');
    const [planejadorNome, setPlanejadorNome] = useState('');
    const [gerandoPdf, setGerandoPdf] = useState(false);
    const relatorioRef = useRef<HTMLDivElement>(null);

    const carregar = useCallback(async () => {
        const clienteId = dados.cliente_id;
        const [{ data: ativosData }, { data: cli }, segurosData, planosData, extrasData, bensData, scoreCliente] = await Promise.all([
            supabase.from('ativos').select('nome, valor_atual, distribuicao_objetivos, origem, tipo_previdencia').eq('cliente_id', clienteId),
            supabase.from('clientes').select('reserva_recomendada').eq('id', clienteId).maybeSingle(),
            protecaoService.getSegurosVida(clienteId),
            protecaoService.getPlanosSaude(clienteId),
            protecaoService.getSegurosExtras(clienteId),
            patrimonioService.getBens(clienteId),
            protecaoService.getScoreCliente(clienteId).catch(() => 0),
        ]);
        setAtivos(ativosData || []);
        setReservaRecomendada(cli?.reserva_recomendada || 0);
        setSeguros(segurosData || []);
        setPlanos(planosData || []);
        setExtras(extrasData || []);
        setBens(bensData);
        setScore(scoreCliente);
    }, [dados.cliente_id]);

    useEffect(() => { carregar().catch(err => console.error('Erro ao carregar proteção:', err)); }, [carregar]);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.user_metadata?.email_comercial) setPlanejadorEmail(user.user_metadata.email_comercial);
            else if (user?.email) setPlanejadorEmail(user.email);
            if (user?.user_metadata?.full_name) setPlanejadorNome(user.user_metadata.full_name);
        });
    }, []);

    // Ativos de Previdência Privada cadastrados na Carteira — fonte única de
    // verdade para a Sucessão (substitui os campos manuais pgbl_*/vgbl_*).
    const previdencia = useMemo(() => {
        const soma = (tipo: string) => ativos
            .filter(a => a.origem === 'previdencia_privada' && a.tipo_previdencia === tipo)
            .reduce((acc, a) => acc + (a.valor_atual || 0), 0);
        return { pgbl: soma('PGBL'), vgbl: soma('VGBL') };
    }, [ativos]);

    const saldoReserva = useMemo(() => ativos.reduce((acc, a) => {
        const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'reserva');
        return link ? acc + a.valor_atual * (link.percentual / 100) : acc;
    }, 0), [ativos]);

    const handleUpdate = (campos: Partial<ClienteSeguro>) => {
        setDados(prev => ({ ...prev, ...campos }));
        onAtualizar(campos);
    };

    // ─── Cálculos ────────────────────────────────────────────────────────────────
    // Base de despesas da cobertura de vida — precisa espelhar EXATAMENTE a EtapaPadraoVida do
    // wizard: só entram as despesas com o toggle cobertura_incluir_* ligado (padrão: obrigatórias
    // + financiamentos). Antes o dashboard somava TODAS as despesas, inflando a cobertura.
    const totalDespesasCobertura =
        ((dados.cobertura_incluir_obrigatorias ?? true) ? (dados.despesas_obrigatorias || 0) : 0) +
        ((dados.cobertura_incluir_nao_obrigatorias ?? false) ? (dados.despesas_nao_obrigatorias || 0) : 0) +
        ((dados.cobertura_incluir_financiamentos ?? true) ? (dados.financiamentos || 0) : 0) +
        ((dados.cobertura_incluir_dividas ?? false) ? (dados.dividas_mensais || 0) : 0) +
        ((dados.cobertura_incluir_projetos ?? false) ? (dados.projetos_financeiros || 0) : 0);

    // calcularCoberturaVida espera a taxa real ANUAL em percentual (faz (1 + taxa/100)^período).
    // Antes recebia a taxa real MENSAL (~0,0015), zerando o fator de crescimento da cobertura.
    const taxaRealAnual = dados.taxa_real_anual ?? 4;

    const coberturaVida = useMemo(() => calcularCoberturaVida(
        dados.renda_cliente || 0, dados.renda_conjuge || 0, totalDespesasCobertura,
        dados.periodo_cobertura_anos || 10, taxaRealAnual
    ), [dados]);

    const sucessao = useMemo(() => calcularSucessao(
        dados.funeral_cliente || 0, dados.funeral_conjuge || 0,
        dados.bens_cliente || 0, dados.bens_conjuge || 0,
        dados.investimentos_cliente || 0, dados.investimentos_conjuge || 0,
        dados.dividas_cliente || 0, dados.dividas_conjuge || 0,
        previdencia.pgbl, 0,
        previdencia.vgbl, 0,
        parametros.perc_custos_inventario,
        dados.honorarios_perc,
        dados.itcmd_perc,
    ), [dados, parametros, previdencia]);

    const totalEducacao = dependentes.reduce((acc, d) => acc + (d.total_calculado || 0), 0);
    const totalGeral = totalEducacao + coberturaVida.coberturaFamiliar + sucessao.coberturaSucessao;

    const hoje = toLocalDateString(new Date());
    const entrada: EntradaProtecao = {
        hoje, membros, saldoReserva, planos, seguros, extras, bens,
        reservaIdeal: calcularReservaIdeal(dados, reservaRecomendada),
        necessidade: {
            educacao: totalEducacao,
            padraoVidaCliente: coberturaVida.coberturaCliente,
            padraoVidaConjuge: coberturaVida.coberturaConjuge,
            sucessao: sucessao.coberturaSucessao,
        },
    };
    const linhas = membroAtivo ? linhasMembro(entrada, membroAtivo) : linhasFamilia(entrada);
    const tituloTabela = membroAtivo
        ? `Proteção de ${membros.find(m => m.chave === membroAtivo)?.nome || 'familiar'}`
        : 'Proteção global da família';

    const adicionarCobertura = (tipo: NovaCobertura) => {
        const membro = membroAtivo || 'cliente';
        if (tipo === 'plano') setEditor({ tipo: 'plano', apolice: { membro } });
        else if (tipo === 'vida') setEditor({ tipo: 'vida', apolice: { membro } });
        else setEditor({ tipo: 'extra', apolice: { tipo_seguro: TIPO_SEGURO_DA_COBERTURA[tipo], membro: tipo === 'profissional' ? membroAtivo : null } });
    };

    const fecharReserva = () => {
        setConfigurandoReserva(false);
        carregar().catch(console.error);
    };

    const aposSalvar = () => {
        setEditor(null);
        carregar().catch(console.error);
    };

    const excluirApolice = async () => {
        if (!paraExcluir) return;
        setExcluindo(true);
        try {
            await EXCLUIR_APOLICE[paraExcluir.tipo](paraExcluir.id);
            setParaExcluir(null);
            await carregar();
        } catch (err: any) {
            toast.error('Erro ao excluir: ' + (err?.message || 'tente novamente.'));
        } finally {
            setExcluindo(false);
        }
    };

    const corScore = score >= 70 ? 'var(--primary)' : score >= 40 ? 'var(--warning)' : 'var(--danger)';

    // ─── WhatsApp ─────────────────────────────────────────────────────────────────
    const gerarWhatsApp = () => {
        const nomeExibido = dados.nome_cliente || nomeCliente || 'Cliente';
        const texto = `*Levantamento de Necessidade de Proteção — ${nomeExibido}*

*Educação e Dependentes:* ${fmtMoeda(totalEducacao)}

*Padrão de Vida — ${nomeExibido}:* ${fmtMoeda(coberturaVida.coberturaCliente)}
*Padrão de Vida — ${dados.nome_conjuge || 'Cônjuge'}:* ${fmtMoeda(coberturaVida.coberturaConjuge)}

*Sucessão Patrimonial:* ${fmtMoeda(sucessao.coberturaSucessao)}

*TOTAL DE COBERTURA RECOMENDADA: ${fmtMoeda(totalGeral)}*

Planejador: ${planejadorEmail || '—'}`;
        navigator.clipboard.writeText(texto);
        toast.success('Texto copiado para a área de transferência!');
    };

    // ─── PDF (Levantamento de Necessidade de Proteção) ──────────────────────────
    // Documento editorial A4 paisagem (mesmo layout do Relatório de Alocação do Simulador Tático):
    // cada `data-pdf-page` do RelatorioProtecaoDoc vira exatamente uma folha do PDF.
    const gerarPDF = async () => {
        if (!relatorioRef.current) return;
        setGerandoPdf(true);
        try {
            const nomeCliente_ = dados.nome_cliente || nomeCliente || 'Cliente';
            const nomeArquivo = `levantamento-protecao-${nomeCliente_.replace(/\s/g, '-').toLowerCase()}-${fmtDataHoje().replace(/\//g, '-')}.pdf`;
            await document.fonts.ready;
            await baixarPaginasComoPDF(relatorioRef.current, nomeArquivo);
        } catch (err: any) {
            toast.error('Erro ao gerar o PDF: ' + (err?.message || 'tente novamente.'));
        } finally {
            setGerandoPdf(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="bg-surface rounded-xl border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] p-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--primary-soft)' }}>
                            <Shield size={20} className="text-[color:var(--primary)]" />
                        </div>
                        <div>
                            <p className="text-[14px] font-semibold text-main leading-none">Painel de Proteção</p>
                            <p className="text-[12px] text-faint mt-1">Recomendado × contratado da família e de cada familiar</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-2 px-3 h-9 rounded-lg bg-surface-2 border border-subtle" title="Score de proteção (0–100)">
                            <Activity size={14} style={{ color: corScore }} />
                            <span className="text-[12px] text-muted hidden sm:inline">Score</span>
                            <span className="text-[14px] font-bold" style={{ color: corScore }}>{Math.round(score)}%</span>
                        </div>
                        <button
                            onClick={onEditar}
                            className="flex items-center gap-2 px-3 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-all"
                        >
                            <Pencil size={12} />
                            <span className="hidden md:inline">Editar levantamento</span>
                        </button>
                        <div className="w-px h-6 bg-subtle mx-0.5" />
                        <button
                            onClick={gerarWhatsApp}
                            title="Compartilhar via WhatsApp"
                            className="flex items-center gap-2 px-3 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-all"
                        >
                            <MessageCircle size={14} />
                            <span className="hidden md:inline">WhatsApp</span>
                        </button>
                        <button
                            onClick={gerarPDF}
                            disabled={gerandoPdf}
                            title="Baixar PDF do levantamento"
                            className="flex items-center gap-2 px-3 h-9 rounded-lg text-white font-semibold text-[12px] hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: 'var(--primary)' }}
                        >
                            <Download size={14} />
                            <span className="hidden md:inline">{gerandoPdf ? 'Gerando PDF...' : 'Baixar PDF'}</span>
                        </button>
                    </div>
                </div>
            </div>

            <TabelaProtecao
                titulo={tituloTabela}
                linhas={linhas}
                onAdicionar={adicionarCobertura}
                onVisualizar={setLinhaAberta}
            />

            {/* A lista some enquanto um formulário está aberto e volta atualizada ao fechar. */}
            <ModalCoberturas
                linha={editor ? null : linhaAberta}
                onClose={() => setLinhaAberta(null)}
                onConfigurarReserva={() => { setLinhaAberta(null); setConfigurandoReserva(true); }}
                onEditarPlano={apolice => setEditor({ tipo: 'plano', apolice })}
                onEditarSeguro={apolice => setEditor({ tipo: 'vida', apolice })}
                onEditarExtra={apolice => setEditor({ tipo: 'extra', apolice })}
                onExcluir={setParaExcluir}
                membro={membroAtivo}
                membros={membros}
                hoje={hoje}
                planos={planos}
                seguros={seguros}
                extras={extras}
                ativos={ativos}
            />

            {editor?.tipo === 'plano' && (
                <FormPlanoSaude clienteId={dados.cliente_id} membros={membros} plano={editor.apolice} onCancelar={() => setEditor(null)} onSalvo={aposSalvar} />
            )}
            {editor?.tipo === 'vida' && (
                <FormSeguroVida clienteId={dados.cliente_id} membros={membros} seguro={editor.apolice} onCancelar={() => setEditor(null)} onSalvo={aposSalvar} />
            )}
            {editor?.tipo === 'extra' && (
                <FormSeguroExtra clienteId={dados.cliente_id} membros={membros} seguro={editor.apolice} onCancelar={() => setEditor(null)} onSalvo={aposSalvar} />
            )}

            <Confirmacao
                isOpen={!!paraExcluir}
                onClose={() => setParaExcluir(null)}
                onConfirm={excluirApolice}
                loading={excluindo}
                title="Excluir apólice"
                message={`Deseja excluir "${paraExcluir?.descricao}"?`}
            />

            <SidePanel open={configurandoReserva} onClose={fecharReserva} title="Reserva de emergência" widthClass="max-w-2xl">
                <AcordeoReservaEmergencia dados={dados} parametros={parametros} onUpdate={handleUpdate} saldoReserva={saldoReserva} defaultAberto />
            </SidePanel>

            {/* Documento do relatório — renderizado fora da tela, só para captura do PDF (ver gerarPDF).
               Sem overflow/clipping no wrapper: html2canvas precisa do layout natural do elemento. */}
            <div className="fixed top-0 pointer-events-none" style={{ left: '-9999px' }} aria-hidden="true">
                <RelatorioProtecaoDoc
                    ref={relatorioRef}
                    dados={dados}
                    dependentes={dependentes}
                    parametros={parametros}
                    nomeCliente={nomeCliente}
                    planejadorNome={planejadorNome}
                    planejadorEmail={planejadorEmail}
                    segurosData={seguros}
                    coberturaVida={coberturaVida}
                    sucessao={sucessao}
                    previdencia={previdencia}
                    totalEducacao={totalEducacao}
                    totalGeral={totalGeral}
                />
            </div>
        </div>
    );
};

export default DashboardProtecao;
