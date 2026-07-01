
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { formatarMoeda, formatarData } from './formatadores';
import { investimentoService } from '../services/investimentoService';

// Estilos de cores Vibe
const COLORS = {
  PRIMARY: [37, 99, 235] as const,
  SECONDARY: [15, 23, 42] as const,
  TEXT_MUTED: [148, 163, 184] as const,
  BG_LIGHT: [248, 250, 252] as const,
  BORDER: [226, 232, 240] as const
};

export const gerarPDFRelatorio = async (dados: any) => {
  const { cliente, contratos, ativos, projetos, reunioes, secoes, periodo } = dados;
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;

  // --- CAPA ---
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('RelatÃ³rio de', pageWidth / 2, 100, { align: 'center' });
  doc.setFontSize(32);
  doc.text('Planejamento Financeiro', pageWidth / 2, 115, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Plano de ExecuÃ§Ã£o da Carteira', pageWidth / 2, 125, { align: 'center' });

  doc.setTextColor(255, 215, 0);
  doc.setFontSize(16);
  doc.text('Elaborado para', pageWidth / 2, 150, { align: 'center' });
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(cliente.nome, pageWidth / 2, 162, { align: 'center' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(periodo, pageWidth / 2, pageHeight - 30, { align: 'center' });

  const addHeader = (title: string) => {
    doc.addPage();
    doc.setFillColor(...COLORS.BG_LIGHT);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(...COLORS.SECONDARY);
    doc.setFontSize(10);
    doc.text('RELATÃ“RIO DE PLANEJAMENTO FINANCEIRO', margin, 12);
    doc.setTextColor(...COLORS.TEXT_MUTED);
    doc.text(`Cliente: ${cliente.nome}`, pageWidth - margin, 12, { align: 'right' });
    doc.text(periodo, pageWidth - margin, 17, { align: 'right' });

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.PRIMARY);
    doc.text(title.toUpperCase(), margin, 40);
    doc.setDrawColor(...COLORS.PRIMARY);
    doc.setLineWidth(1);
    doc.line(margin, 43, margin + 10, 43);
  };

  if (secoes.includes('resumo')) {
    addHeader('Resumo Executivo');
    const startY = 55;
    const cardWidth = (pageWidth - (margin * 2) - 10) / 2;
    const drawCard = (label: string, value: string, x: number, y: number) => {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...COLORS.BORDER);
      doc.roundedRect(x, y, cardWidth, 25, 3, 3, 'FD');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.TEXT_MUTED);
      doc.text(label.toUpperCase(), x + 5, y + 8);
      doc.setFontSize(14);
      doc.setTextColor(...COLORS.SECONDARY);
      doc.text(value, x + 5, y + 18);
    };
    drawCard('PatrimÃ´nio Total', formatarMoeda(cliente.patrimonio_total), margin, startY);
    drawCard('Aporte Mensal', formatarMoeda(cliente.aporte_mensal), margin + cardWidth + 10, startY);
  }

  // 2. Plano de Rebalanceamento (DINÃ‚MICO: CARREGA O ÃšLTIMO SALVO)
  if (secoes.includes('rebalanceamento')) {
    addHeader('Plano de Rebalanceamento');

    try {
      const ultimoRebal = await investimentoService.getUltimoRebalanceamento(cliente.id);

      if (ultimoRebal) {
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.SECONDARY);
        doc.text('Abaixo o resumo da Ãºltima decisÃ£o de alocaÃ§Ã£o estratÃ©gica executada em ' + formatarData(ultimoRebal.data_rebalanceamento) + ':', margin, 55);
        doc.text('Valor total do aporte: ' + formatarMoeda(ultimoRebal.valor_aporte), margin, 60);

        (doc as any).autoTable({
          startY: 65,
          head: [['DESTINO DO APORTE', 'VALOR ANTERIOR', 'VALOR APORTADO', 'VALOR NOVO']],
          body: ultimoRebal.itens.map((s: any) => [
            s.ativo_nome_avulso,
            formatarMoeda(s.valor_anterior),
            formatarMoeda(s.valor_distribuido),
            formatarMoeda(s.valor_novo)
          ]),
          headStyles: { fillColor: [...COLORS.PRIMARY], textColor: [255, 255, 255] },
          margin: { left: margin, right: margin }
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.TEXT_MUTED);
        doc.text('Nenhum histÃ³rico de aporte mensal registrado no motor de investimentos.', margin, 55);
      }
    } catch (err) {
      console.error("PDF Rebalanceamento Error:", err);
    }
  }

  if (secoes.includes('ativos')) {
    addHeader('AlocaÃ§Ã£o por Ativos');
    (doc as any).autoTable({
      startY: 50,
      head: [['TICKER', 'PRODUTO', 'VALOR ATUAL', 'PART. %', 'STATUS']],
      body: ativos.map((a: any) => [
        a.ticker || '---',
        a.nome,
        formatarMoeda(a.valor_atual),
        `${((a.valor_atual / (cliente.patrimonio_total || 1)) * 100).toFixed(1)}%`,
        a.status
      ]),
      headStyles: { fillColor: [...COLORS.BG_LIGHT], textColor: [...COLORS.TEXT_MUTED], fontSize: 8 },
      margin: { left: margin, right: margin }
    });
  }

  const pageCount = doc.internal.pages.length - 1;
  for (let i = 2; i <= pageCount + 1; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.TEXT_MUTED);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    doc.text(`PÃ¡gina ${i - 1} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  return doc;
};
