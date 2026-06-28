
import React, { useMemo } from 'react';
import { FileText, MessageCircle, CheckCircle2, Pencil, Download } from 'lucide-react';
import { ClienteSeguro, DependenteSeguro, ParametrosCalculo } from '../../services/protecaoService';
import { protecaoService } from '../../services/protecaoService';
import { calcularCoberturaVida, calcularSucessao, calcularTaxaRealMensal } from '../../utils/calculosFinanceiros';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;
const fmtDataHoje = () => new Date().toLocaleDateString('pt-BR');

interface Props {
    dados: ClienteSeguro;
    dependentes: DependenteSeguro[];
    parametros: ParametrosCalculo;
    nomeCliente?: string;
    onEditar: () => void;
}

const PainelResumo: React.FC<Props> = ({ dados, dependentes, parametros, nomeCliente, onEditar }) => {
    const taxaRealMensal = calcularTaxaRealMensal(parametros.taxa_juros_aa, parametros.ipca_projetado_aa);

    const totalEducacao = useMemo(
        () => dependentes.reduce((acc, d) => acc + (d.total_calculado || 0), 0),
        [dependentes]
    );

    const coberturaVida = useMemo(() => calcularCoberturaVida(
        dados.renda_cliente || 0,
        dados.renda_conjuge || 0,
        (dados.despesas_obrigatorias || 0) + (dados.despesas_nao_obrigatorias || 0) + (dados.financiamentos || 0) + (dados.dividas_mensais || 0) + (dados.projetos_financeiros || 0),
        dados.periodo_cobertura_anos || 10,
        taxaRealMensal,
    ), [dados, taxaRealMensal]);

    const sucessao = useMemo(() => calcularSucessao(
        dados.funeral_cliente || 0, dados.funeral_conjuge || 0,
        dados.bens_cliente || 0, dados.bens_conjuge || 0,
        dados.investimentos_cliente || 0, dados.investimentos_conjuge || 0,
        dados.dividas_cliente || 0, dados.dividas_conjuge || 0,
        dados.pgbl_cliente || 0, dados.pgbl_conjuge || 0,
        dados.vgbl_cliente || 0, dados.vgbl_conjuge || 0,
        parametros.perc_custos_inventario,
    ), [dados, parametros]);

    const totalGeral = totalEducacao + coberturaVida.coberturaFamiliar + sucessao.coberturaSucessao;

    // ── Linha do resumo ──────────────────────────────────────────────────────────
    const linhas = [
        { label: 'Educação e Dependentes', valor: totalEducacao, cor: 'text-emerald-600' },
        { label: 'Padrão de Vida — Cliente', valor: coberturaVida.coberturaCliente, cor: 'text-emerald-600' },
        { label: 'Padrão de Vida — Cônjuge', valor: coberturaVida.coberturaConjuge, cor: 'text-emerald-600' },
        { label: 'Sucessão Patrimonial', valor: sucessao.coberturaSucessao, cor: 'text-rose-600' },
    ];

    // ── WhatsApp template ────────────────────────────────────────────────────────
    const gerarWhatsApp = () => {
        const texto = `*Levantamento de Necessidade de Proteção — ${dados.nome_cliente || nomeCliente || 'Cliente'}*

*Educação e Dependentes:* ${fmtMoeda(totalEducacao)}
*Padrão de Vida — Cliente:* ${fmtMoeda(coberturaVida.coberturaCliente)}
*Padrão de Vida — Cônjuge:* ${fmtMoeda(coberturaVida.coberturaConjuge)}
*Sucessão Patrimonial:* ${fmtMoeda(sucessao.coberturaSucessao)}

*TOTAL DE COBERTURA RECOMENDADA: ${fmtMoeda(totalGeral)}*

_Levantamento realizado via FinPlan Pro_`;
        navigator.clipboard.writeText(texto);
        alert('Texto copiado para a área de transferência! Cole no WhatsApp.');
    };

    // ── Gerar PDF para Corretor ────────────────────────────────────────────────
    const gerarPDF = () => {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const nomeExibido = dados.nome_cliente || nomeCliente || 'Cliente';
        const W = doc.internal.pageSize.getWidth();

        // ─── Cabeçalho ────────────────────────────────────────────────────────
        doc.setFillColor(16, 185, 129); // emerald-500
        doc.rect(0, 0, W, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('LEVANTAMENTO DE NECESSIDADE DE PROTEÇÃO', W / 2, 12, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Documento para cotação com corretor de seguros — FinPlan Pro', W / 2, 20, { align: 'center' });

        let y = 36;

        // ─── Dados do Cliente ─────────────────────────────────────────────────
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('DADOS DO CLIENTE', 14, y);
        y += 6;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105);

        const dadosCliente: [string, string][] = [
            ['Nome', nomeExibido],
            ['Data de Nascimento', dados.data_nascimento_cliente || '—'],
            ['Sexo', dados.sexo_cliente || '—'],
            ['Estado Civil', dados.estado_civil || '—'],
            ['CPF', dados.cpf_cliente || '—'],
            ['E-mail', dados.email_cliente || '—'],
            ['Telefone', dados.telefone_cliente || '—'],
            ['Fumante', dados.fumante_cliente ? 'Sim' : 'Não'],
            ['Praticante de Esportes de Risco', dados.esporte_risco_cliente ? 'Sim' : 'Não'],
            ['Período de Cobertura Desejado', `${dados.periodo_cobertura_anos || 10} anos`],
        ];

        const metade = Math.ceil(dadosCliente.length / 2);
        dadosCliente.slice(0, metade).forEach(([k, v], i) => {
            doc.setFont('helvetica', 'bold');
            doc.text(`${k}:`, 14, y + i * 5.5);
            doc.setFont('helvetica', 'normal');
            doc.text(v, 52, y + i * 5.5);
        });
        dadosCliente.slice(metade).forEach(([k, v], i) => {
            doc.setFont('helvetica', 'bold');
            doc.text(`${k}:`, 105, y + i * 5.5);
            doc.setFont('helvetica', 'normal');
            doc.text(v, 152, y + i * 5.5);
        });

        y += metade * 5.5 + 10;

        // ─── Cônjuge (se casado) ──────────────────────────────────────────────
        if (dados.casado_cliente && dados.nome_conjuge) {
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('DADOS DO CÔNJUGE', 14, y);
            y += 6;
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105);
            const dadosConj: [string, string][] = [
                ['Nome', dados.nome_conjuge || '—'],
                ['Data de Nascimento', dados.data_nascimento_conjuge || '—'],
                ['Sexo', dados.sexo_conjuge || '—'],
            ];
            dadosConj.forEach(([k, v], i) => {
                doc.setFont('helvetica', 'bold');
                doc.text(`${k}:`, 14, y + i * 5.5);
                doc.setFont('helvetica', 'normal');
                doc.text(v, 52, y + i * 5.5);
            });
            y += dadosConj.length * 5.5 + 8;
        }

        // ─── Dependentes ─────────────────────────────────────────────────────
        const depsValidos = dependentes.filter(d => d.nome_dependente?.trim());
        if (depsValidos.length > 0) {
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('DEPENDENTES', 14, y);
            y += 4;
            autoTable(doc, {
                startY: y,
                head: [['Nome', 'Parentesco', 'Data de Nascimento', 'Cobertura Educação']],
                body: depsValidos.map(d => [
                    d.nome_dependente || '—',
                    d.parentesco || '—',
                    d.data_nascimento_dep || '—',
                    fmtMoeda(d.total_calculado || 0),
                ]),
                headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
                alternateRowStyles: { fillColor: [240, 253, 244] },
                margin: { left: 14, right: 14 },
                tableWidth: W - 28,
            });
            y = (doc as any).lastAutoTable.finalY + 8;
        }

        // ─── Renda e Despesas ─────────────────────────────────────────────────
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('RENDA E DESPESAS MENSAIS', 14, y);
        y += 4;
        autoTable(doc, {
            startY: y,
            head: [['Item', 'Valor (R$)']],
            body: [
                ['Renda Bruta Mensal — Cliente', fmtMoeda(dados.renda_cliente || 0)],
                ['Renda Bruta Mensal — Cônjuge', fmtMoeda(dados.renda_conjuge || 0)],
                ['Despesas Obrigatórias', fmtMoeda(dados.despesas_obrigatorias || 0)],
                ['Despesas Não Obrigatórias', fmtMoeda(dados.despesas_nao_obrigatorias || 0)],
                ['Financiamentos', fmtMoeda(dados.financiamentos || 0)],
                ['Dívidas Mensais', fmtMoeda(dados.dividas_mensais || 0)],
                ['Projetos Financeiros', fmtMoeda(dados.projetos_financeiros || 0)],
            ],
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [240, 253, 244] },
            margin: { left: 14, right: 14 },
            tableWidth: W - 28,
        });
        y = (doc as any).lastAutoTable.finalY + 8;

        // ─── Coberturas Recomendadas ──────────────────────────────────────────
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('COBERTURAS RECOMENDADAS', 14, y);
        y += 4;
        autoTable(doc, {
            startY: y,
            head: [['Tipo de Cobertura', 'Valor Recomendado (R$)']],
            body: [
                ['Educação e Dependentes', fmtMoeda(totalEducacao)],
                ['Padrão de Vida — Cliente', fmtMoeda(coberturaVida.coberturaCliente)],
                ['Padrão de Vida — Cônjuge', fmtMoeda(coberturaVida.coberturaConjuge)],
                ['Sucessão Patrimonial', fmtMoeda(sucessao.coberturaSucessao)],
            ],
            foot: [['TOTAL DE COBERTURA RECOMENDADA', fmtMoeda(totalGeral)]],
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
            footStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            alternateRowStyles: { fillColor: [240, 253, 244] },
            margin: { left: 14, right: 14 },
            tableWidth: W - 28,
        });
        y = (doc as any).lastAutoTable.finalY + 10;

        // ─── Parâmetros de Cálculo ────────────────────────────────────────────
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139);
        doc.text(
            `Parâmetros: Taxa de juros ${parametros.taxa_juros_aa}% a.a. | IPCA projetado ${parametros.ipca_projetado_aa}% a.a. | Taxa real mensal ${(taxaRealMensal * 100).toFixed(4)}%`,
            14, y
        );
        y += 5;
        doc.text(`Documento gerado em ${fmtDataHoje()} via FinPlan Pro — Uso exclusivo para fins de cotação de seguros.`, 14, y);

        // ─── Rodapé ───────────────────────────────────────────────────────────
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFillColor(16, 185, 129);
        doc.rect(0, pageH - 10, W, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('FinPlan Pro — Planejamento Financeiro Pessoal', W / 2, pageH - 4, { align: 'center' });

        const nomeArquivo = `levantamento-protecao-${nomeExibido.replace(/\s/g, '-').toLowerCase()}-${fmtDataHoje().replace(/\//g, '-')}.pdf`;
        doc.save(nomeArquivo);
    };

    // ── Concluir ────────────────────────────────────────────────────────────────
    const concluir = async () => {
        try {
            await protecaoService.update(dados.cliente_id, {
                completo: true,
                cobertura_cliente: coberturaVida.coberturaCliente,
                cobertura_conjuge: coberturaVida.coberturaConjuge,
                cobertura_familiar_vida: coberturaVida.coberturaFamiliar,
                cobertura_sucessao: sucessao.coberturaSucessao,
            });
            alert('Levantamento salvo com sucesso!');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-8">
            {/* ── Header ─────────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between bg-surface p-4 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-subtle">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                        <CheckCircle2 className="text-emerald-500" size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Levantamento Concluído</p>
                        <h2 className="text-[20px] font-bold text-main tracking-tighter leading-none">
                            {dados.nome_cliente || nomeCliente}
                        </h2>
                    </div>
                </div>
            </div>

            {/* ── Tabela Resumo ──────────────────────────────────────────────────── */}
            <div className="bg-surface border border-subtle rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <div className="px-4 py-3 bg-surface border-b border-subtle">
                    <p className="text-[10px] font-bold text-faint uppercase tracking-wider">
                        Resumo de Coberturas Necessárias
                    </p>
                </div>
                <div className="divide-y divide-subtle">
                    {linhas.map((l, i) => (
                        <div key={i} className="flex justify-between items-center px-4 py-2.5 hover:bg-surface-2/50 transition-colors">
                            <span className="text-[13px] font-bold text-main tracking-tight">{l.label}</span>
                            <span className={`text-[14px] font-bold tracking-tighter ${l.cor}`}>{fmtMoeda(l.valor)}</span>
                        </div>
                    ))}
                    <div className="flex justify-between items-center px-4 py-3 bg-surface-3">
                        <span className="text-[10px] font-bold text-faint uppercase tracking-wider">Total Geral</span>
                        <span className="text-[20px] font-bold text-white leading-none tracking-tighter">{fmtMoeda(totalGeral)}</span>
                    </div>
                </div>
            </div>

            {/* ── Detalhes extras ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-surface border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-xl h-[90px] flex flex-col justify-between hover:border-emerald-300 transition-all">
                    <p className="text-[10px] font-bold text-faint uppercase tracking-wider leading-none">Dependentes</p>
                    <p className="text-[24px] font-bold text-main leading-none tracking-tighter">{dependentes.filter(d => d.nome_dependente?.trim()).length}</p>
                </div>
                <div className="p-4 bg-surface border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-xl h-[90px] flex flex-col justify-between hover:border-emerald-300 transition-all">
                    <p className="text-[10px] font-bold text-faint uppercase tracking-wider leading-none">Período de Cobertura</p>
                    <p className="text-[24px] font-bold text-main leading-none tracking-tighter">{dados.periodo_cobertura_anos || 10} anos</p>
                </div>
                <div className="p-4 bg-surface border border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-xl h-[90px] flex flex-col justify-between hover:border-emerald-300 transition-all">
                    <p className="text-[10px] font-bold text-faint uppercase tracking-wider leading-none">Estado do Levantamento</p>
                    <p className="text-[14px] font-bold text-emerald-600 flex items-center gap-1.5 tracking-tight"><CheckCircle2 size={16}/> Completo</p>
                </div>
            </div>

            {/* ── Botão de exportação em destaque ───────────────────────────────── */}
            <div className="bg-surface-3 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
                <div>
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">Pronto para cotação</p>
                    <p className="text-[14px] font-bold text-white tracking-tight mb-0.5">Gere o relatório completo para enviar ao corretor de seguros</p>
                    <p className="text-[10px] text-faint font-bold uppercase tracking-wider">Inclui dados pessoais, dependentes, renda, despesas e coberturas calculadas.</p>
                </div>
                <button
                    onClick={gerarPDF}
                    className="shrink-0 flex items-center gap-2 h-9 px-4 rounded-[8px] bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-500 transition-all shadow-sm whitespace-nowrap"
                >
                    <Download size={14} />
                    Baixar PDF para Corretor
                </button>
            </div>

            {/* ── Botões de ação ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={onEditar}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] border border-subtle text-muted font-bold text-[10px] uppercase tracking-wider hover:bg-surface-2 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                >
                    <Pencil size={14} />
                    Editar Levantamento
                </button>
                <button
                    onClick={gerarWhatsApp}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-surface border border-emerald-200 text-emerald-700 font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-50 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                >
                    <MessageCircle size={14} />
                    Gerar Template WhatsApp
                </button>
                <button
                    onClick={concluir}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-[8px] bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                >
                    <CheckCircle2 size={14} />
                    Salvar e Concluir
                </button>
            </div>
        </div>
    );
};

export default PainelResumo;
