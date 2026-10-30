
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Shield, Pencil, MessageCircle, Download, Activity
} from 'lucide-react';
import SidePanel from '../UI/SidePanel';
import { ClienteSeguro, DependenteSeguro, ParametrosCalculo, PlanoSaude, SeguroExtra, SeguroVida, protecaoService } from '../../services/protecaoService';
import { calcularCoberturaVida, calcularSucessao } from '../../utils/calculosFinanceiros';
import { calcularReservaIdeal } from '../../utils/protecaoUtils';
import { EntradaProtecao, LinhaProtecao, MembroProtecao, linhasFamilia, linhasMembro } from '../../utils/protecaoTabela';
import { patrimonioService, BemPatrimonial } from '../../services/patrimonioService';
import { toLocalDateString } from '../../utils/formatadores';
import TabelaProtecao, { NovaCobertura } from './TabelaProtecao';
import ModalCoberturas from './ModalCoberturas';
import AcordeoReservaEmergencia from './AcordeoReservaEmergencia';
import AcordeoPlanoSaude from './AcordeoPlanoSaude';
import AcordeoSeguros from './AcordeoSeguros';
import AcordeoProtecaoPatrimonial from './AcordeoProtecaoPatrimonial';
import AcordeoProtecaoProfissional from './AcordeoProtecaoProfissional';
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
    /** Reflete no levantamento o que foi alterado nos drawers (ex.: reserva). */
    onAtualizar: (campos: Partial<ClienteSeguro>) => void;
}

type Drawer = 'seguros' | 'reserva' | 'plano' | 'patrimonial' | 'profissional';
interface DrawerAberto { tipo: Drawer; novo?: boolean; tipoSeguro?: string }

const DRAWER_DA_LINHA: Record<LinhaProtecao['detalhe'], Drawer> = {
    reserva: 'reserva', plano: 'plano', vida: 'seguros',
    imobiliario: 'patrimonial', veicular: 'patrimonial', empresarial: 'profissional', profissional: 'profissional',
};

const DashboardProtecao: React.FC<Props> = ({ dados: dadosIniciais, dependentes, parametros, nomeCliente, onEditar, membros, membroAtivo, onAtualizar }) => {
    const [dados, setDados] = useState<ClienteSeguro>(dadosIniciais);
    const [drawer, setDrawer] = useState<DrawerAberto | null>(null);
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

    const sucessaoIdeal = totalEducacao + sucessao.coberturaSucessao;

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
        if (tipo === 'plano') setDrawer({ tipo: 'plano', novo: true });
        else if (tipo === 'vida') setDrawer({ tipo: 'seguros', novo: true });
        else if (tipo === 'imobiliario') setDrawer({ tipo: 'patrimonial', tipoSeguro: 'Residencial' });
        else if (tipo === 'veicular') setDrawer({ tipo: 'patrimonial', tipoSeguro: 'Automotivo' });
        else if (tipo === 'empresarial') setDrawer({ tipo: 'profissional', tipoSeguro: 'Empresarial' });
        else setDrawer({ tipo: 'profissional', tipoSeguro: 'Responsabilidade Civil' });
    };

    // Os drawers gravam por conta própria: recarrega ao fechar para a tabela refletir as mudanças.
    const fecharDrawer = () => {
        setDrawer(null);
        carregar().catch(console.error);
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

            <ModalCoberturas
                linha={linhaAberta}
                onClose={() => setLinhaAberta(null)}
                onGerenciar={l => { setLinhaAberta(null); setDrawer({ tipo: DRAWER_DA_LINHA[l.detalhe] }); }}
                membro={membroAtivo}
                membros={membros}
                hoje={hoje}
                planos={planos}
                seguros={seguros}
                extras={extras}
                ativos={ativos}
            />

            {/* ── Drawers de edição por pilar ── */}
            <SidePanel open={drawer?.tipo === 'seguros'} onClose={fecharDrawer} title="Seguro de vida" subtitle="Necessidade e apólices contratadas" widthClass="max-w-2xl">
                <AcordeoSeguros dados={dados} dependentes={dependentes} parametros={parametros} sucessaoIdeal={sucessaoIdeal} defaultAberto abrirNovo={drawer?.novo} />
            </SidePanel>

            <SidePanel open={drawer?.tipo === 'reserva'} onClose={fecharDrawer} title="Reserva de emergência" widthClass="max-w-2xl">
                <AcordeoReservaEmergencia dados={dados} parametros={parametros} onUpdate={handleUpdate} saldoReserva={saldoReserva} defaultAberto />
            </SidePanel>

            <SidePanel open={drawer?.tipo === 'plano'} onClose={fecharDrawer} title="Plano de saúde" widthClass="max-w-2xl">
                <AcordeoPlanoSaude dados={dados} dependentes={dependentes} defaultAberto abrirNovo={drawer?.novo} />
            </SidePanel>

            <SidePanel open={drawer?.tipo === 'patrimonial'} onClose={fecharDrawer} title="Proteção patrimonial" subtitle="Seguros imobiliário e veicular" widthClass="max-w-2xl">
                <AcordeoProtecaoPatrimonial dados={dados} defaultAberto tipoNovo={drawer?.tipoSeguro} />
            </SidePanel>

            <SidePanel open={drawer?.tipo === 'profissional'} onClose={fecharDrawer} title="Proteção profissional/empresarial" widthClass="max-w-2xl">
                <AcordeoProtecaoProfissional dados={dados} defaultAberto tipoNovo={drawer?.tipoSeguro} membros={membros} />
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
