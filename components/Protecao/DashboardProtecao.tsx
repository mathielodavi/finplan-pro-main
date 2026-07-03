
import React, { useState, useEffect, useMemo } from 'react';
import {
    Shield, Pencil, MessageCircle, Download
} from 'lucide-react';
import { ClienteSeguro, DependenteSeguro, ParametrosCalculo, protecaoService } from '../../services/protecaoService';
import { calcularCoberturaVida, calcularSucessao, calcularTaxaRealMensal } from '../../utils/calculosFinanceiros';
import AcordeoReservaEmergencia from './AcordeoReservaEmergencia';
import AcordeoPlanoSaude from './AcordeoPlanoSaude';
import AcordeoSeguros from './AcordeoSeguros';
import AcordeoExtras from './AcordeoExtras';
import { supabase } from '../../services/supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;
const fmtDataHoje = () => new Date().toLocaleDateString('pt-BR');
const fmtData = (d?: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

interface Props {
    dados: ClienteSeguro;
    dependentes: DependenteSeguro[];
    parametros: ParametrosCalculo;
    nomeCliente?: string;
    onEditar: () => void;
}

const DashboardProtecao: React.FC<Props> = ({ dados: dadosIniciais, dependentes, parametros, nomeCliente, onEditar }) => {
    const [dados, setDados] = useState<ClienteSeguro>(dadosIniciais);
    const [saldoReserva, setSaldoReserva] = useState(0);
    const [coberturaContratada, setCoberturaContratada] = useState(0);
    const [reservaIdeal, setReservaIdeal] = useState(0);
    const [planosCount, setPlanosCount] = useState(0);
    const [extrasCount, setExtrasCount] = useState(0);
    const [planejadorEmail, setPlanejadorEmail] = useState('');
    const [planejadorNome, setPlanejadorNome] = useState('');

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
            const soma = (seguros || []).reduce((acc, s) => acc + (Number(s.cobertura_morte) || 0), 0);
            setCoberturaContratada(soma);
        };

        const loadPilares = async () => {
            const [{ data: cli }, planos, extras] = await Promise.all([
                supabase.from('clientes').select('reserva_recomendada').eq('id', dados.cliente_id).maybeSingle(),
                protecaoService.getPlanosSaude(dados.cliente_id),
                protecaoService.getSegurosExtras(dados.cliente_id),
            ]);
            setReservaIdeal(cli?.reserva_recomendada || 0);
            setPlanosCount((planos || []).length);
            setExtrasCount((extras || []).length);
        };

        loadReserva();
        loadPlanejador();
        loadSeguros();
        loadPilares();
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
        dados.pgbl_cliente || 0, dados.pgbl_conjuge || 0,
        dados.vgbl_cliente || 0, dados.vgbl_conjuge || 0,
        parametros.perc_custos_inventario,
        dados.honorarios_perc,
        dados.itcmd_perc,
    ), [dados, parametros]);

    const totalEducacao = dependentes.reduce((acc, d) => acc + (d.total_calculado || 0), 0);
    const totalGeral = totalEducacao + coberturaVida.coberturaFamiliar + sucessao.coberturaSucessao;
    const lacunaTotal = Math.max(0, totalGeral - coberturaContratada);

    // Pilares da necessidade recomendada (o "contratado" não é etiquetado por pilar).
    const pilares = [
        { label: 'Educação e dependentes', valor: totalEducacao },
        { label: 'Padrão de vida', valor: coberturaVida.coberturaFamiliar },
        { label: 'Sucessão patrimonial', valor: sucessao.coberturaSucessao },
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
        alert('Texto copiado para a área de transferência!');
    };

    // ─── PDF Completo com todos os dados do Wizard ──────────────────────────────
    const gerarPDF = async () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const W = doc.internal.pageSize.getWidth();
        const nomeCliente_ = dados.nome_cliente || nomeCliente || 'Cliente';
        const nomeConjuge = dados.nome_conjuge || 'Cônjuge';
        const temConjuge = !!dados.casado_cliente && !!dados.nome_conjuge;

        // Busca seguros registrados
        const segurosData = await protecaoService.getSegurosVida(dados.cliente_id);

        const headerSection = (label: string, y: number) => {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            doc.text(label, 14, y);
            doc.setDrawColor(16, 185, 129);
            doc.setLineWidth(0.5);
            doc.line(14, y + 1, W - 14, y + 1);
        };

        const subHeader = (label: string, y: number) => {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 116, 139);
            doc.text(label.toUpperCase(), 14, y);
            return y + 5;
        };

        const addInfoGrid = (rows: [string, string][], y: number): number => {
            const colW = (W - 28) / 2;
            const labelW = 42;   // largura reservada para o rótulo esquerdo
            const labelWR = 48;  // largura reservada para o rótulo direito (labels mais longos)
            doc.setFontSize(8);
            const half = Math.ceil(rows.length / 2);
            rows.slice(0, half).forEach(([k, v], i) => {
                doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
                doc.text(k + ':', 14, y + i * 5.5);
                doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
                doc.text(String(v || '—'), 14 + labelW, y + i * 5.5);
            });
            rows.slice(half).forEach(([k, v], i) => {
                doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
                doc.text(k + ':', 14 + colW, y + i * 5.5);
                doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
                doc.text(String(v || '—'), 14 + colW + labelWR, y + i * 5.5);
            });
            return y + Math.ceil(rows.length / 2) * 5.5 + 6;
        };

        const checkPage = (needed: number, _y: number): number => {
            if (_y + needed > 270) { doc.addPage(); return 20; }
            return _y;
        };

        // ── Capa ────────────────────────────────────────────────────────────────
        doc.setFillColor(16, 185, 129);
        doc.rect(0, 0, W, 30, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text('LEVANTAMENTO DE NECESSIDADE DE PROTEÇÃO', W / 2, 13, { align: 'center' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('Documento para cotação com corretor de seguros', W / 2, 22, { align: 'center' });

        let y = 40;

        // ── Planejador ──────────────────────────────────────────────────────────
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
        const planejadorInfo = [planejadorNome, planejadorEmail].filter(Boolean).join('  |  ');
        doc.text(`Planejador: ${planejadorInfo || '—'}   |   Data: ${fmtDataHoje()}`, W / 2, y, { align: 'center' });
        y += 10;

        // ── 1. Dados Pessoais CLIENTE ───────────────────────────────────────────
        headerSection('1. DADOS PESSOAIS', y); y += 8;

        // Identificação
        y = subHeader('Identificação — ' + nomeCliente_, y);
        y = addInfoGrid([
            ['Nome', nomeCliente_],
            ['Data de Nascimento', fmtData(dados.data_nascimento_cliente)],
            ['CPF', dados.cpf_cliente || '—'],
            ['Estado Civil', dados.casado_cliente ? 'Casado(a)' : 'Solteiro(a)'],
            ['E-mail', dados.email_cliente || '—'],
            ['Telefone', dados.telefone_cliente || '—'],
            ['Estado', dados.estado_cliente || '—'],
            ['Profissão', dados.profissao_cliente || '—'],
            ['Regime de Contratação', dados.regime_contratacao_cliente || '—'],
        ], y);

        // Saúde
        y = checkPage(30, y);
        y = subHeader('Saúde & Estilo de Vida — ' + nomeCliente_, y);
        y = addInfoGrid([
            ['Fumante', dados.fumante_cliente ? 'Sim' : 'Não'],
            ['Peso (kg)', dados.peso_cliente ? String(dados.peso_cliente) : '—'],
            ['Altura (cm)', dados.altura_cliente ? String(dados.altura_cliente) : '—'],
            ['Esporte/Hobby', dados.esporte_hobby_cliente || '—'],
            ['Medicamento Contínuo', dados.medicamento_continuo_cliente || '—'],
            ['Doença Crônica', dados.doenca_cronica_cliente || '—'],
            ['Cirurgia Complexa', dados.cirurgia_complexa_cliente || '—'],
        ], y);

        // Cônjuge
        if (temConjuge) {
            y = checkPage(50, y);
            y = subHeader('Identificação — ' + nomeConjuge, y);
            y = addInfoGrid([
                ['Nome', nomeConjuge],
                ['Data de Nascimento', fmtData(dados.data_nascimento_conjuge)],
                ['CPF', dados.cpf_conjuge || '—'],
                ['E-mail', dados.email_conjuge || '—'],
                ['Telefone', dados.telefone_conjuge || '—'],
                ['Profissão', dados.profissao_conjuge || '—'],
                ['Regime de Contratação', dados.regime_contratacao_conjuge || '—'],
            ], y);
            y = checkPage(30, y);
            y = subHeader('Saúde & Estilo de Vida — ' + nomeConjuge, y);
            y = addInfoGrid([
                ['Fumante', dados.fuma_conjuge ? 'Sim' : 'Não'],
                ['Peso (kg)', dados.peso_conjuge ? String(dados.peso_conjuge) : '—'],
                ['Altura (cm)', dados.altura_conjuge ? String(dados.altura_conjuge) : '—'],
                ['Esporte/Hobby', dados.esporte_hobby_conjuge || '—'],
                ['Medicamento Contínuo', dados.medicamento_continuo_conjuge || '—'],
                ['Doença Crônica', dados.doenca_cronica_conjuge || '—'],
                ['Cirurgia Complexa', dados.cirurgia_complexa_conjuge || '—'],
            ], y);
        }

        // ── 2. Dependentes ──────────────────────────────────────────────────────
        const depsValidos = dependentes.filter(d => d.nome_dependente?.trim());
        y = checkPage(40, y);
        headerSection('2. DEPENDENTES', y); y += 6;
        if (depsValidos.length > 0) {
            autoTable(doc, {
                startY: y,
                head: [['Nome', 'Parentesco', 'Nasc.', 'Cobertura (anos)', 'Auxílio Mensal', 'Total Calc.']],
                body: depsValidos.map(d => [
                    d.nome_dependente || '—',
                    d.parentesco || '—',
                    fmtData(d.data_nascimento_dep),
                    String(d.cobertura_anos || 0),
                    fmtMoeda(d.auxilio_mensal || 0),
                    fmtMoeda(d.total_calculado || 0),
                ]),
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 7 },
                bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
                alternateRowStyles: { fillColor: [240, 253, 244] },
                margin: { left: 14, right: 14 }, tableWidth: W - 28,
            });
            y = (doc as any).lastAutoTable.finalY + 8;
        } else {
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
            doc.text('Não possui dependentes cadastrados.', 14, y);
            y += 8;
        }

        // ── 3. Padrão de Vida ───────────────────────────────────────────────────
        y = checkPage(50, y);
        headerSection('3. PADRÃO DE VIDA E RENDA', y); y += 6;
        const headPVida = temConjuge
            ? ['Item', nomeCliente_, nomeConjuge, 'Família']
            : ['Item', nomeCliente_];
        const rowPVida = (label: string, vc: any, vconj: any, vfam: any) =>
            temConjuge ? [label, String(vc), String(vconj), String(vfam)] : [label, String(vc)];
        autoTable(doc, {
            startY: y,
            head: [headPVida],
            body: [
                rowPVida('Renda Mensal', fmtMoeda(dados.renda_cliente || 0), fmtMoeda(dados.renda_conjuge || 0), fmtMoeda((dados.renda_cliente || 0) + (dados.renda_conjuge || 0))),
                rowPVida('Declaração IR', dados.declaracao_ir_cliente || '—', dados.declaracao_ir_conjuge || '—', '—'),
                rowPVida('Regime', dados.regime_contratacao_cliente || '—', dados.regime_contratacao_conjuge || '—', '—'),
                rowPVida(`Período de Cobertura`, `${dados.periodo_cobertura_anos || 10} anos`, '—', '—'),
                rowPVida(`Taxa Real Anual`, `${dados.taxa_real_anual ?? 4}%`, '—', '—'),
                rowPVida('Despesas Obrigatórias', fmtMoeda(dados.despesas_obrigatorias || 0), '—', '—'),
                rowPVida('Despesas Não Obrigatórias', fmtMoeda(dados.despesas_nao_obrigatorias || 0), '—', '—'),
                rowPVida('Financiamentos', fmtMoeda(dados.financiamentos || 0), '—', '—'),
                rowPVida('Dívidas Mensais', fmtMoeda(dados.dividas_mensais || 0), '—', '—'),
                rowPVida('Projetos Financeiros', fmtMoeda(dados.projetos_financeiros || 0), '—', '—'),
            ],
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 7 },
            bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [240, 253, 244] },
            margin: { left: 14, right: 14 }, tableWidth: W - 28,
        });
        y = (doc as any).lastAutoTable.finalY + 8;

        // ── 4. Sucessão Patrimonial ─────────────────────────────────────────────
        y = checkPage(60, y);
        headerSection('4. SUCESSÃO PATRIMONIAL', y); y += 6;
        const percEfetivo = (dados.honorarios_perc !== undefined && dados.itcmd_perc !== undefined)
            ? dados.honorarios_perc + dados.itcmd_perc
            : parametros.perc_custos_inventario;
        const headSucessao = temConjuge
            ? ['Item', nomeCliente_, nomeConjuge, 'Família']
            : ['Item', nomeCliente_];
        const rowSucessao = (label: string, vc: any, vconj: any, vfam: any) =>
            temConjuge ? [label, String(vc), String(vconj), String(vfam)] : [label, String(vc)];
        autoTable(doc, {
            startY: y,
            head: [headSucessao],
            body: [
                rowSucessao('Funeral / Luto', fmtMoeda(dados.funeral_cliente || 0), fmtMoeda(dados.funeral_conjuge || 0), fmtMoeda(sucessao.totalFuneral)),
                rowSucessao(`Bens (inv. ${percEfetivo.toFixed(1)}%)`, fmtMoeda(dados.bens_cliente || 0), fmtMoeda(dados.bens_conjuge || 0), fmtMoeda(sucessao.custoInventario)),
                rowSucessao('Investimentos Líquidos', fmtMoeda(dados.investimentos_cliente || 0), fmtMoeda(dados.investimentos_conjuge || 0), fmtMoeda((dados.investimentos_cliente || 0) + (dados.investimentos_conjuge || 0))),
                rowSucessao('Dívidas', fmtMoeda(dados.dividas_cliente || 0), fmtMoeda(dados.dividas_conjuge || 0), fmtMoeda((dados.dividas_cliente || 0) + (dados.dividas_conjuge || 0))),
                rowSucessao('Previdência PGBL', fmtMoeda(dados.pgbl_cliente || 0), fmtMoeda(dados.pgbl_conjuge || 0), fmtMoeda((dados.pgbl_cliente || 0) + (dados.pgbl_conjuge || 0))),
                rowSucessao('Previdência VGBL', fmtMoeda(dados.vgbl_cliente || 0), fmtMoeda(dados.vgbl_conjuge || 0), fmtMoeda((dados.vgbl_cliente || 0) + (dados.vgbl_conjuge || 0))),
                rowSucessao('Honorários', `${dados.honorarios_perc || 0}%`, '—', '—'),
                rowSucessao('ITCMD', `${dados.itcmd_perc || 0}%`, '—', '—'),
            ],
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 7 },
            bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [240, 253, 244] },
            margin: { left: 14, right: 14 }, tableWidth: W - 28,
        });
        y = (doc as any).lastAutoTable.finalY + 8;

        // ── 5. Coberturas Recomendadas ──────────────────────────────────────────
        y = checkPage(60, y);
        headerSection('5. COBERTURAS DE VIDA RECOMENDADAS', y); y += 6;

        const linhasCobertura: [string, string, string][] = [
            ['Educação e Dependentes', 'Família', totalEducacao > 0 ? fmtMoeda(totalEducacao) : 'Não aplicável (sem dependentes)'],
            ['Padrão de Vida', nomeCliente_, coberturaVida.coberturaCliente > 0 ? fmtMoeda(coberturaVida.coberturaCliente) : 'Não aplicável'],
        ];
        if (temConjuge) {
            linhasCobertura.push(['Padrão de Vida', nomeConjuge, coberturaVida.coberturaConjuge > 0 ? fmtMoeda(coberturaVida.coberturaConjuge) : 'Não aplicável']);
        }
        linhasCobertura.push(['Sucessão Patrimonial', 'Herdeiros', sucessao.coberturaSucessao > 0 ? fmtMoeda(sucessao.coberturaSucessao) : 'Não aplicável']);

        autoTable(doc, {
            startY: y,
            head: [['Tipo de Cobertura', 'Beneficiário', 'Valor Recomendado']],
            body: linhasCobertura,
            foot: [['TOTAL DE COBERTURA RECOMENDADA', '', fmtMoeda(totalGeral)]],
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
            footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            alternateRowStyles: { fillColor: [240, 253, 244] },
            margin: { left: 14, right: 14 }, tableWidth: W - 28,
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        // ── 6. Coberturas Cadastradas ───────────────────────────────────────────
        if (segurosData && segurosData.length > 0) {
            y = checkPage(50, y);
            headerSection('6. COBERTURAS DE SEGURO CADASTRADAS', y); y += 6;
            autoTable(doc, {
                startY: y,
                head: [['Membro', 'Seguradora', 'Cob. Morte', 'Cob. Funeral', 'Invalidez', 'DIT (diária)', 'Mensalidade', 'Vigência']],
                body: segurosData.map(s => [
                    s.membro === 'cliente' ? nomeCliente_ : nomeConjuge,
                    s.seguradora || '—',
                    fmtMoeda(s.cobertura_morte || 0),
                    fmtMoeda(s.cobertura_funeral || 0),
                    fmtMoeda(s.cobertura_invalidez || 0),
                    fmtMoeda(s.dit || 0),
                    fmtMoeda(s.mensalidade || 0),
                    s.inicio_vigencia && s.fim_vigencia
                        ? `${fmtData(s.inicio_vigencia)} a ${fmtData(s.fim_vigencia)}`
                        : (s.inicio_vigencia ? `Desde ${fmtData(s.inicio_vigencia)}` : '—'),
                ]),
                headStyles: { fillColor: [109, 40, 217], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
                bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
                alternateRowStyles: { fillColor: [245, 243, 255] },
                margin: { left: 14, right: 14 }, tableWidth: W - 28,
            });
            y = (doc as any).lastAutoTable.finalY + 8;
        }

        // ── Rodapé em todas as páginas ──────────────────────────────────────────
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            const pageH = doc.internal.pageSize.getHeight();
            doc.setFillColor(16, 185, 129);
            doc.rect(0, pageH - 10, W, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(7); doc.setFont('helvetica', 'normal');
            doc.text(
                `${planejadorNome ? planejadorNome + '  |  ' : ''}${planejadorEmail || '—'}   |   Emitido em ${fmtDataHoje()}   |   Pág. ${p}/${totalPages}`,
                W / 2, pageH - 4, { align: 'center' }
            );
        }

        const nomeArquivo = `levantamento-protecao-${nomeCliente_.replace(/\s/g, '-').toLowerCase()}-${fmtDataHoje().replace(/\//g, '-')}.pdf`;
        doc.save(nomeArquivo);
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
                    <button
                        onClick={onEditar}
                        className="shrink-0 flex items-center gap-2 px-3 h-9 rounded-lg border border-subtle text-muted font-semibold text-[12px] hover:bg-surface-2 transition-all"
                    >
                        <Pencil size={12} />
                        Editar levantamento
                    </button>
                </div>
            </div>

            {/* ── Resumo: necessidade × cobertura atual × lacuna ── */}
            <div className="bg-surface rounded-xl border border-subtle p-4 space-y-4">
                <div className="flex items-baseline gap-2">
                    <h3 className="text-[13px] font-semibold text-main">Necessidade de proteção</h3>
                    <span className="text-[11px] text-faint">recomendado × contratado</span>
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
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Valor recomendado</span>
                    </div>
                    {pilares.map((p, i) => (
                        <div key={i} className="flex justify-between items-center px-3 py-2.5 text-[13px] border-t border-subtle">
                            <span className="text-muted">{p.label}</span>
                            <span className="font-semibold text-main">{fmtMoeda(p.valor)}</span>
                        </div>
                    ))}
                </div>

                <p className="text-[11px] text-faint">A cobertura atual soma os seguros de vida contratados (cobertura por morte). O comparativo é no total — o detalhamento do contratado por pilar depende de etiquetar cada apólice.</p>
            </div>

            {/* ── Panorama dos pilares (leitura) ── */}
            <div className="bg-surface rounded-xl border border-subtle p-4 space-y-3">
                <h3 className="text-[13px] font-semibold text-main">Panorama dos pilares</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-surface-2 rounded-lg border border-subtle p-3">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] text-faint">Reserva de emergência</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: statusMap.cor, backgroundColor: statusMap.bg }}>{statusMap.label}</span>
                        </div>
                        <p className="text-[13px] font-semibold text-main">{fmtMoeda(saldoReserva)} <span className="text-faint font-normal">/ {fmtMoeda(reservaIdeal)}</span></p>
                    </div>
                    <div className="bg-surface-2 rounded-lg border border-subtle p-3">
                        <span className="text-[11px] text-faint block mb-1.5">Plano de saúde</span>
                        <p className="text-[13px] font-semibold text-main">{planosCount > 0 ? `${planosCount} contratado(s)` : 'Nenhum'}</p>
                    </div>
                    <div className="bg-surface-2 rounded-lg border border-subtle p-3">
                        <span className="text-[11px] text-faint block mb-1.5">Proteções extras</span>
                        <p className="text-[13px] font-semibold text-main">{extrasCount > 0 ? `${extrasCount} apólice(s)` : 'Nenhuma'}</p>
                    </div>
                </div>
            </div>

            {/* ── Acordeões ──────────────────────────────────────────── */}
            <div className="space-y-3">
                <AcordeoReservaEmergencia dados={dados} parametros={parametros} onUpdate={handleUpdate} saldoReserva={saldoReserva} />
                <AcordeoPlanoSaude dados={dados} dependentes={dependentes} />
                <AcordeoSeguros dados={dados} dependentes={dependentes} parametros={parametros} />
                <AcordeoExtras dados={dados} />
            </div>

            {/* ── Faixa de exportação ─────────────────────────────────── */}
            <div className="bg-surface-3 rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap shadow-lg">
                <div>
                    <p className="text-[10px] font-bold text-[color:var(--primary)] uppercase tracking-wider mb-1">Pronto para cotação</p>
                    <p className="text-[14px] font-bold text-white tracking-tight">Compartilhe o levantamento com seu corretor</p>
                    <p className="text-[10px] text-faint mt-1 font-bold uppercase tracking-wider">Inclui todos os dados do levantamento com visão cliente/cônjuge.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={gerarWhatsApp}
                        className="flex items-center gap-1.5 px-3 h-9 rounded-[8px] bg-surface/5 text-white border border-white/10 font-bold text-[10px] uppercase tracking-wider hover:bg-surface/10 transition-all"
                    >
                        <MessageCircle size={14} />
                        WhatsApp
                    </button>
                    <button
                        onClick={gerarPDF}
                        className="flex items-center gap-1.5 px-3 h-9 rounded-[8px] bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider hover:opacity-90 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                    >
                        <Download size={14} />
                        Baixar PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardProtecao;
