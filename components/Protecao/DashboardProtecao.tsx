
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Shield, Pencil, MessageCircle, Download, Settings, Activity
} from 'lucide-react';
import SidePanel from '../UI/SidePanel';
import { ClienteSeguro, DependenteSeguro, ParametrosCalculo, protecaoService } from '../../services/protecaoService';
import { calcularCoberturaVida, calcularSucessao, calcularTaxaRealMensal } from '../../utils/calculosFinanceiros';
import AcordeoReservaEmergencia from './AcordeoReservaEmergencia';
import AcordeoPlanoSaude from './AcordeoPlanoSaude';
import AcordeoSeguros from './AcordeoSeguros';
import AcordeoProtecaoPatrimonial from './AcordeoProtecaoPatrimonial';
import AcordeoProtecaoProfissional from './AcordeoProtecaoProfissional';
import RelatorioProtecaoDoc from './RelatorioProtecaoDoc';
import { supabase } from '../../services/supabaseClient';
import { baixarElementoComoPDFPaginado } from '../../utils/pdfFromElement';
import { toast } from '../../utils/toast';

const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;
const fmtDataHoje = () => new Date().toLocaleDateString('pt-BR');

interface Props {
    dados: ClienteSeguro;
    dependentes: DependenteSeguro[];
    parametros: ParametrosCalculo;
    nomeCliente?: string;
    onEditar: () => void;
}

const DashboardProtecao: React.FC<Props> = ({ dados: dadosIniciais, dependentes, parametros, nomeCliente, onEditar }) => {
    const [dados, setDados] = useState<ClienteSeguro>(dadosIniciais);
    const [drawer, setDrawer] = useState<null | 'seguros' | 'reserva' | 'plano' | 'patrimonial' | 'profissional'>(null);
    const [score, setScore] = useState(0);
    const [saldoReserva, setSaldoReserva] = useState(0);
    const [segurosLista, setSegurosLista] = useState<any[]>([]);
    const [previdencia, setPrevidencia] = useState({ pgbl: 0, vgbl: 0 });
    const [reservaIdeal, setReservaIdeal] = useState(0);
    const [planosCount, setPlanosCount] = useState(0);
    const [patrimonialCount, setPatrimonialCount] = useState(0);
    const [profissionalCount, setProfissionalCount] = useState(0);
    const [planejadorEmail, setPlanejadorEmail] = useState('');
    const [planejadorNome, setPlanejadorNome] = useState('');
    const [gerandoPdf, setGerandoPdf] = useState(false);
    const relatorioRef = useRef<HTMLDivElement>(null);

    // Carrega saldo de reserva dos ativos da carteira
    useEffect(() => {
        const loadReserva = async () => {
            const { data } = await supabase
                .from('ativos')
                .select('valor_atual, distribuicao_objetivos')
                .eq('cliente_id', dados.cliente_id);

            const saldo = (data || []).reduce((acc, a) => {
                const link = (a.distribuicao_objetivos || []).find((o: any) => o.tipo === 'reserva');
                if (!link) return acc;
                return acc + a.valor_atual * (link.percentual / 100);
            }, 0);
            setSaldoReserva(saldo);
        };

        const loadPlanejador = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata?.email_comercial) setPlanejadorEmail(user.user_metadata.email_comercial);
            else if (user?.email) setPlanejadorEmail(user.email);
            if (user?.user_metadata?.full_name) setPlanejadorNome(user.user_metadata.full_name);
        };

        const loadSeguros = async () => {
            const seguros = await protecaoService.getSegurosVida(dados.cliente_id);
            setSegurosLista(seguros || []);
        };

        // Ativos de Previdência Privada cadastrados na Carteira — fonte única de
        // verdade para a Sucessão (substitui os campos manuais pgbl_*/vgbl_*).
        const loadPrevidencia = async () => {
            const { data } = await supabase
                .from('ativos')
                .select('valor_atual, tipo_previdencia')
                .eq('cliente_id', dados.cliente_id)
                .eq('origem', 'previdencia_privada');
            const pgbl = (data || []).filter(a => a.tipo_previdencia === 'PGBL').reduce((acc, a) => acc + (a.valor_atual || 0), 0);
            const vgbl = (data || []).filter(a => a.tipo_previdencia === 'VGBL').reduce((acc, a) => acc + (a.valor_atual || 0), 0);
            setPrevidencia({ pgbl, vgbl });
        };

        const TIPOS_PATRIMONIAL = ['Residencial', 'Automotivo'];
        const TIPOS_PROFISSIONAL = ['Empresarial', 'Responsabilidade Civil'];

        const loadPilares = async () => {
            const [{ data: cli }, planos, extras] = await Promise.all([
                supabase.from('clientes').select('reserva_recomendada').eq('id', dados.cliente_id).maybeSingle(),
                protecaoService.getPlanosSaude(dados.cliente_id),
                protecaoService.getSegurosExtras(dados.cliente_id),
            ]);
            setReservaIdeal(cli?.reserva_recomendada || 0);
            setPlanosCount((planos || []).length);
            setPatrimonialCount((extras || []).filter(e => TIPOS_PATRIMONIAL.includes(e.tipo_seguro || '')).length);
            setProfissionalCount((extras || []).filter(e => TIPOS_PROFISSIONAL.includes(e.tipo_seguro || '')).length);
        };

        const loadScore = async () => {
            try { setScore(await protecaoService.getScoreCliente(dados.cliente_id)); } catch { /* noop */ }
        };

        loadReserva();
        loadPlanejador();
        loadSeguros();
        loadPrevidencia();
        loadPilares();
        loadScore();
    }, [dados.cliente_id]);


    const handleUpdate = (campos: Partial<ClienteSeguro>) => {
        setDados(prev => ({ ...prev, ...campos }));
    };

    // ─── Cálculos ────────────────────────────────────────────────────────────────
    const taxaRealMensal = calcularTaxaRealMensal(parametros.taxa_juros_aa, parametros.ipca_projetado_aa);
    const totalDespesas = (dados.despesas_obrigatorias || 0) + (dados.despesas_nao_obrigatorias || 0) +
        (dados.financiamentos || 0) + (dados.dividas_mensais || 0) + (dados.projetos_financeiros || 0);

    const coberturaVida = useMemo(() => calcularCoberturaVida(
        dados.renda_cliente || 0, dados.renda_conjuge || 0, totalDespesas,
        dados.periodo_cobertura_anos || 10, taxaRealMensal
    ), [dados, taxaRealMensal]);

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

    // Contratado por grupo de coberturas (Seguro de Vida) — Sucessão (Morte + Funeral)
    // conta para Educação/Dependentes e Sucessão Patrimonial; Padrão de Vida (Doenças
    // Graves + Invalidez + Cirurgia + DIT) conta só para o pilar de Padrão de Vida.
    const contratadoSucessao = segurosLista.reduce((acc, s) => acc + (s.cobertura_morte || 0) + (s.cobertura_funeral || 0), 0);
    const contratadoPadraoVida = segurosLista.reduce((acc, s) => acc +
        (s.cobertura_doencas_graves || 0) + (s.cobertura_invalidez || 0) + (s.cobertura_cirurgia || 0) + (s.dit || 0), 0);
    const coberturaContratada = contratadoSucessao + contratadoPadraoVida;
    const lacunaTotal = Math.max(0, totalGeral - coberturaContratada);
    const sucessaoIdeal = totalEducacao + sucessao.coberturaSucessao;

    const pilares = [
        { label: 'Educação e dependentes', valor: totalEducacao, contratado: contratadoSucessao },
        { label: 'Padrão de vida', valor: coberturaVida.coberturaFamiliar, contratado: contratadoPadraoVida },
        { label: 'Sucessão patrimonial', valor: sucessao.coberturaSucessao, contratado: contratadoSucessao },
    ];

    // Panorama dos demais pilares (leitura) — mesma regra do acordeão de reserva.
    const pctReserva = reservaIdeal > 0 ? (saldoReserva / reservaIdeal) * 100 : 0;
    const statusReserva: 'protegido' | 'parcial' | 'desprotegido' =
        saldoReserva <= 0 ? 'desprotegido' : pctReserva >= 100 ? 'protegido' : pctReserva >= 25 ? 'parcial' : 'desprotegido';
    const statusMap = {
        protegido: { label: 'Protegido', cor: 'var(--primary)', bg: 'rgba(16,185,129,0.12)' },
        parcial: { label: 'Parcial', cor: 'var(--warning)', bg: 'rgba(251,191,36,0.12)' },
        desprotegido: { label: 'Desprotegido', cor: 'var(--danger)', bg: 'rgba(248,113,113,0.12)' },
    }[statusReserva];

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
    // Captura em blocos o documento renderizado fora da tela (RelatorioProtecaoDoc, abaixo) —
    // mesmo mecanismo do Relatório de Aporte Mensal: cada seção é uma unidade indivisível na
    // paginação, então nenhuma tabela/linha é cortada no meio de uma quebra de página.
    const gerarPDF = async () => {
        if (!relatorioRef.current) return;
        setGerandoPdf(true);
        try {
            const nomeCliente_ = dados.nome_cliente || nomeCliente || 'Cliente';
            const nomeArquivo = `levantamento-protecao-${nomeCliente_.replace(/\s/g, '-').toLowerCase()}-${fmtDataHoje().replace(/\//g, '-')}.pdf`;
            await baixarElementoComoPDFPaginado(relatorioRef.current, nomeArquivo);
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
                            <p className="text-[12px] text-faint mt-1">Avaliação do tripé de proteção financeira</p>
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

            {/* ── Reserva de Emergência + Plano de Saúde (pilares de base, lado a lado) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-surface rounded-xl border border-subtle p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[13px] font-semibold text-main">Reserva de emergência</h3>
                        <button onClick={() => setDrawer('reserva')} title="Configurar" className="p-1.5 text-faint hover:text-[color:var(--primary)] hover:bg-surface-2 rounded-lg transition-colors"><Settings size={15} /></button>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: statusMap.cor, backgroundColor: statusMap.bg }}>{statusMap.label}</span>
                    <p className="text-[13px] font-semibold text-main mt-2">{fmtMoeda(saldoReserva)} <span className="text-faint font-normal">/ {fmtMoeda(reservaIdeal)}</span></p>
                </div>

                <div className="bg-surface rounded-xl border border-subtle p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[13px] font-semibold text-main">Plano de saúde</h3>
                        <button onClick={() => setDrawer('plano')} title="Gerenciar" className="p-1.5 text-faint hover:text-[color:var(--primary)] hover:bg-surface-2 rounded-lg transition-colors"><Pencil size={13} /></button>
                    </div>
                    <p className="text-[13px] font-semibold text-main mt-2">{planosCount > 0 ? `${planosCount} contratado(s)` : 'Nenhum'}</p>
                </div>
            </div>

            {/* ── Seguro de Vida (necessidade × contratado × lacuna) ── */}
            <div className="bg-surface rounded-xl border border-subtle p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-[13px] font-semibold text-main">Seguro de vida</h3>
                        <span className="text-[11px] text-faint">necessidade × contratado</span>
                    </div>
                    <button onClick={() => setDrawer('seguros')} className="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-colors">
                        <Pencil size={12} /> Gerenciar apólices
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-surface-2 rounded-lg border border-subtle p-3">
                        <p className="text-[11px] text-faint">Necessidade</p>
                        <p className="text-[20px] font-bold text-main leading-none mt-1">{fmtMoeda(totalGeral)}</p>
                    </div>
                    <div className="bg-surface-2 rounded-lg border border-subtle p-3">
                        <p className="text-[11px] text-faint">Cobertura atual</p>
                        <p className="text-[20px] font-bold text-[color:var(--primary)] leading-none mt-1">{fmtMoeda(coberturaContratada)}</p>
                    </div>
                    <div className="rounded-lg border p-3" style={{ backgroundColor: 'rgba(248,113,113,0.10)', borderColor: 'rgba(248,113,113,0.25)' }}>
                        <p className="text-[11px] text-[color:var(--danger)]">Lacuna a cobrir</p>
                        <p className="text-[20px] font-bold text-[color:var(--danger)] leading-none mt-1">{fmtMoeda(lacunaTotal)}</p>
                    </div>
                </div>

                <div className="border border-subtle rounded-lg overflow-hidden">
                    <div className="flex justify-between items-center px-3 py-2 bg-surface-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Pilar da necessidade</span>
                        <div className="flex items-center gap-4">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint w-24 text-right">Recomendado</span>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint w-24 text-right">Contratado</span>
                        </div>
                    </div>
                    {pilares.map((p, i) => (
                        <div key={i} className="flex justify-between items-center px-3 py-2.5 text-[13px] border-t border-subtle">
                            <span className="text-muted">{p.label}</span>
                            <div className="flex items-center gap-4">
                                <span className="font-semibold text-main w-24 text-right">{fmtMoeda(p.valor)}</span>
                                <span className="font-semibold text-[color:var(--primary)] w-24 text-right">{fmtMoeda(p.contratado)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Proteção Patrimonial / Profissional ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-surface rounded-xl border border-subtle p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[13px] font-semibold text-main">Proteção patrimonial</h3>
                        <button onClick={() => setDrawer('patrimonial')} title="Gerenciar" className="p-1.5 text-faint hover:text-[color:var(--primary)] hover:bg-surface-2 rounded-lg transition-colors"><Pencil size={13} /></button>
                    </div>
                    <p className="text-[13px] font-semibold text-main">{patrimonialCount > 0 ? `${patrimonialCount} apólice(s)` : 'Nenhuma'}</p>
                </div>
                <div className="bg-surface rounded-xl border border-subtle p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[13px] font-semibold text-main">Proteção profissional/empresarial</h3>
                        <button onClick={() => setDrawer('profissional')} title="Gerenciar" className="p-1.5 text-faint hover:text-[color:var(--primary)] hover:bg-surface-2 rounded-lg transition-colors"><Pencil size={13} /></button>
                    </div>
                    <p className="text-[13px] font-semibold text-main">{profissionalCount > 0 ? `${profissionalCount} apólice(s)` : 'Nenhuma'}</p>
                </div>
            </div>

            {/* ── Drawers de edição por pilar ── */}
            <SidePanel open={drawer === 'seguros'} onClose={() => setDrawer(null)} title="Seguro de vida" subtitle="Necessidade e apólices contratadas" widthClass="max-w-2xl">
                <AcordeoSeguros dados={dados} dependentes={dependentes} parametros={parametros} sucessaoIdeal={sucessaoIdeal} defaultAberto />
            </SidePanel>

            <SidePanel open={drawer === 'reserva'} onClose={() => setDrawer(null)} title="Reserva de emergência" widthClass="max-w-2xl">
                <AcordeoReservaEmergencia dados={dados} parametros={parametros} onUpdate={handleUpdate} saldoReserva={saldoReserva} defaultAberto />
            </SidePanel>

            <SidePanel open={drawer === 'plano'} onClose={() => setDrawer(null)} title="Plano de saúde" widthClass="max-w-2xl">
                <AcordeoPlanoSaude dados={dados} dependentes={dependentes} defaultAberto />
            </SidePanel>

            <SidePanel open={drawer === 'patrimonial'} onClose={() => setDrawer(null)} title="Proteção patrimonial" widthClass="max-w-2xl">
                <AcordeoProtecaoPatrimonial dados={dados} defaultAberto />
            </SidePanel>

            <SidePanel open={drawer === 'profissional'} onClose={() => setDrawer(null)} title="Proteção profissional/empresarial" widthClass="max-w-2xl">
                <AcordeoProtecaoProfissional dados={dados} defaultAberto />
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
                    segurosData={segurosLista}
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
