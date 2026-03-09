
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
  doc.text('Relatório de', pageWidth / 2, 100, { align: 'center' });
  doc.setFontSize(32);
  doc.text('Planejamento Financeiro', pageWidth / 2, 115, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Plano de Execução da Carteira', pageWidth / 2, 125, { align: 'center' });

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
    doc.text('RELATÓRIO DE PLANEJAMENTO FINANCEIRO', margin, 12);
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
    drawCard('Patrimônio Total', formatarMoeda(cliente.patrimonio_total), margin, startY);
    drawCard('Aporte Mensal', formatarMoeda(cliente.aporte_mensal), margin + cardWidth + 10, startY);
  }

  // 2. Plano de Rebalanceamento (DINÂMICO: CARREGA O ÚLTIMO SALVO)
  if (secoes.includes('rebalanceamento')) {
    addHeader('Plano de Rebalanceamento');

    try {
      const ultimoRebal = await investimentoService.getUltimoRebalanceamento(cliente.id);

      if (ultimoRebal) {
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.SECONDARY);
        doc.text('Abaixo o resumo da última decisão de alocação estratégica executada em ' + formatarData(ultimoRebal.data_rebalanceamento) + ':', margin, 55);
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
        doc.text('Nenhum histórico de aporte mensal registrado no motor de investimentos.', margin, 55);
      }
    } catch (err) {
      console.error("PDF Rebalanceamento Error:", err);
    }
  }

  if (secoes.includes('ativos')) {
    addHeader('Alocação por Ativos');
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
    doc.text(`Página ${i - 1} / ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  return doc;
};

interface ReportData {
  cliente: any;
  planejador: any;
  empresa?: any;
  estrategia: string;
  tese: string;
  faixa?: string;
  aporteTotal: number;
  distribuicao: {
    reserva: number;
    projetos: number;
    independencia: number;
    ativoReserva?: string;
    ativoProjetos?: string;
  };
  ordensCompra: any[];
  ordensVenda: any[];
  dataGeracao: string;
}

// ─── Liquid Glass helpers ───────────────────────────────────────────────────
const LG = {
  BG: [8, 15, 30] as const, // deep navy
  PANEL: [18, 28, 48] as const, // glass panel dark
  SURFACE: [26, 40, 66] as const, // surface card
  EMERALD: [16, 185, 129] as const, // emerald 500
  EMERALD_D: [5, 150, 105] as const, // emerald 600
  ROSE: [244, 63, 94] as const, // rose 500
  AMBER: [251, 146, 60] as const, // amber 400
  TEXT: [226, 232, 240] as const, // slate-200
  MUTED: [100, 116, 139] as const, // slate-500
  BORDER: [51, 65, 85] as const, // slate-700
  WHITE: [255, 255, 255] as const,
};

function glassCard(doc: any, x: number, y: number, w: number, h: number, colorRgb: readonly [number, number, number] = LG.SURFACE) {
  doc.setFillColor(colorRgb[0], colorRgb[1], colorRgb[2]);
  doc.roundedRect(x, y, w, h, 4, 4, 'F');
  doc.setDrawColor(LG.BORDER[0], LG.BORDER[1], LG.BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 4, 4, 'S');
}

function label(doc: any, text: string, x: number, y: number) {
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(LG.MUTED[0], LG.MUTED[1], LG.MUTED[2]);
  doc.text(text.toUpperCase(), x, y);
}

function value(doc: any, text: string, x: number, y: number, size = 11, color = LG.TEXT) {
  doc.setFontSize(size);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(text, x, y);
}

function emeraldBar(doc: any, x: number, y: number, w: number) {
  doc.setFillColor(LG.EMERALD[0], LG.EMERALD[1], LG.EMERALD[2]);
  doc.roundedRect(x, y, w, 1.5, 0.75, 0.75, 'F');
}

export const gerarRelatorioAportePDF = async (data: ReportData) => {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 16; // margin

  // ─── Global background ───────────────────────────────────────────────────
  const paintBg = () => {
    doc.setFillColor(LG.BG[0], LG.BG[1], LG.BG[2]);
    doc.rect(0, 0, pageW, pageH, 'F');
    // subtle gradient-like overlay at top
    doc.setFillColor(LG.PANEL[0], LG.PANEL[1], LG.PANEL[2]);
    doc.rect(0, 0, pageW, 55, 'F');
  };
  paintBg();

  // ─── PAGE 1 HEADER ───────────────────────────────────────────────────────
  // Logo / branding strip
  doc.setFillColor(LG.EMERALD[0], LG.EMERALD[1], LG.EMERALD[2]);
  doc.rect(0, 0, 4, 55, 'F'); // left accent stripe

  // Planner photo (circular placeholder or actual)
  const photoUrl = data.planejador?.user_metadata?.avatar_url || data.planejador?.avatar_url;
  const photoSize = 28;
  const photoX = M + 4;
  const photoY = 12;
  try {
    if (photoUrl) {
      // Use ui-avatars as fallback if we can't directly embed URL
      const plannerName = data.planejador?.user_metadata?.full_name || data.planejador?.full_name || 'P';
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(plannerName)}&background=10b981&color=fff&size=128`;
      doc.addImage(avatarUrl, 'PNG', photoX, photoY, photoSize, photoSize, '', 'FAST');
    } else {
      // Fallback circle
      doc.setFillColor(LG.EMERALD[0], LG.EMERALD[1], LG.EMERALD[2]);
      doc.circle(photoX + photoSize / 2, photoY + photoSize / 2, photoSize / 2, 'F');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      const initials = (data.planejador?.user_metadata?.full_name || data.planejador?.full_name || 'P').split(' ').map((n: string) => n[0]).join('').substring(0, 2);
      doc.text(initials.toUpperCase(), photoX + photoSize / 2, photoY + photoSize / 2 + 4, { align: 'center' });
    }
  } catch { }

  // Planner info block (next to photo)
  const infoX = photoX + photoSize + 8;
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(LG.TEXT[0], LG.TEXT[1], LG.TEXT[2]);
  doc.text(data.planejador?.user_metadata?.full_name || data.planejador?.full_name || 'Planejador', infoX, 24);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(LG.MUTED[0], LG.MUTED[1], LG.MUTED[2]);
  const planEmail = data.planejador?.email || data.planejador?.user_metadata?.email || '';
  const planPhone = data.planejador?.user_metadata?.phone || data.planejador?.phone || '';
  if (planEmail) doc.text(`✉  ${planEmail}`, infoX, 31);
  if (planPhone) doc.text(`✆  ${planPhone}`, infoX, 37);

  // Right side: document title & date
  doc.setFontSize(8);
  doc.setTextColor(LG.MUTED[0], LG.MUTED[1], LG.MUTED[2]);
  doc.text('PROTOCOLO DE ALOCAÇÃO', pageW - M, 20, { align: 'right' });
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(LG.EMERALD[0], LG.EMERALD[1], LG.EMERALD[2]);
  doc.text('MENSAL', pageW - M, 29, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(LG.MUTED[0], LG.MUTED[1], LG.MUTED[2]);
  doc.text(data.dataGeracao, pageW - M, 36, { align: 'right' });

  // divider
  emeraldBar(doc, M, 55, pageW - M * 2);

  let Y = 63;

  // ─── CLIENT + STRATEGY ───────────────────────────────────────────────────
  const halfW = (pageW - M * 2 - 6) / 2;

  // Client card
  glassCard(doc, M, Y, halfW, 32);
  label(doc, 'Cliente', M + 6, Y + 8);
  value(doc, data.cliente?.nome || 'N/A', M + 6, Y + 17, 12, LG.TEXT);

  // Strategy card
  const stratX = M + halfW + 6;
  glassCard(doc, stratX, Y, halfW, 32);
  label(doc, 'Estratégia', stratX + 6, Y + 8);
  value(doc, data.estrategia || 'N/A', stratX + 6, Y + 17, 10, LG.TEXT);
  if (data.faixa) {
    doc.setFontSize(7.5);
    doc.setTextColor(LG.EMERALD[0], LG.EMERALD[1], LG.EMERALD[2]);
    doc.setFont('helvetica', 'bold');
    doc.text(`FAIXA: ${data.faixa}`, stratX + 6, Y + 26);
  }

  Y += 38;

  // Tese card (full width)
  glassCard(doc, M, Y, pageW - M * 2, 20);
  label(doc, 'Tese de Investimento', M + 6, Y + 7);
  const teseLines = doc.splitTextToSize(data.tese || 'Não informada.', pageW - M * 2 - 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(LG.TEXT[0], LG.TEXT[1], LG.TEXT[2]);
  doc.text(teseLines.slice(0, 1), M + 6, Y + 15);

  Y += 26;

  // ─── FINANCIAL SUMMARY CARDS ─────────────────────────────────────────────
  // Calculate totals
  const totalVendas = (data.ordensVenda || []).reduce((s: number, o: any) => s + (o.valor || 0), 0);
  const aporteComVendas = data.aporteTotal + totalVendas;

  const cards = [
    { label: 'Aporte Disponível', val: formatarMoeda(data.aporteTotal), color: LG.EMERALD },
    { label: 'Saldo de Vendas', val: formatarMoeda(totalVendas), color: totalVendas > 0 ? LG.AMBER : LG.MUTED },
    { label: 'Total p/ Alocar', val: formatarMoeda(aporteComVendas), color: LG.EMERALD },
  ];
  const cardW = (pageW - M * 2 - 8) / 3;

  cards.forEach((c, i) => {
    const cx = M + i * (cardW + 4);
    glassCard(doc, cx, Y, cardW, 24, LG.PANEL);
    label(doc, c.label, cx + 6, Y + 8);
    value(doc, c.val, cx + 6, Y + 18, 11, c.color as any);
  });

  Y += 30;

  // ─── DISTRIBUTION CARDS ──────────────────────────────────────────────────
  const dists = [
    { label: 'Reserva Estratégica', val: data.distribuicao.reserva, ativo: data.distribuicao.ativoReserva },
    { label: 'Projetos de Vida', val: data.distribuicao.projetos, ativo: data.distribuicao.ativoProjetos },
    { label: 'Independência', val: data.distribuicao.independencia, ativo: undefined },
  ].filter(d => d.val > 0);

  if (dists.length > 0) {
    const dW = dists.length === 1 ? pageW - M * 2 : (pageW - M * 2 - (dists.length - 1) * 4) / dists.length;
    dists.forEach((d, i) => {
      const cx = M + i * (dW + 4);
      glassCard(doc, cx, Y, dW, 30, LG.SURFACE);
      label(doc, d.label, cx + 6, Y + 8);
      value(doc, formatarMoeda(d.val), cx + 6, Y + 18, 11, LG.EMERALD as any);
      if (d.ativo) {
        doc.setFontSize(7);
        doc.setTextColor(LG.MUTED[0], LG.MUTED[1], LG.MUTED[2]);
        doc.setFont('helvetica', 'normal');
        doc.text(`→ ${d.ativo}`, cx + 6, Y + 27);
      }
    });
    Y += 36;
  }

  // ─── BUY ORDERS — per class ───────────────────────────────────────────────
  if (data.ordensCompra && data.ordensCompra.length > 0) {
    emeraldBar(doc, M, Y, 30);
    Y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(LG.TEXT[0], LG.TEXT[1], LG.TEXT[2]);
    doc.text('ORDENS DE COMPRA', M, Y);
    Y += 6;

    // Group by class
    const classeMap: Record<string, any[]> = {};
    (data.ordensCompra || []).forEach((o: any) => {
      const k = o.classe || 'Outros';
      if (!classeMap[k]) classeMap[k] = [];
      classeMap[k].push(o);
    });

    for (const [classe, ordens] of Object.entries(classeMap)) {
      // Check page space
      if (Y > pageH - 60) {
        doc.addPage();
        paintBg();
        Y = M + 10;
      }

      // Class header
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(LG.EMERALD[0], LG.EMERALD[1], LG.EMERALD[2]);
      doc.text(classe.toUpperCase(), M, Y + 4);

      (doc as any).autoTable({
        startY: Y + 7,
        head: [['Ativo', 'Ticker / CNPJ', 'Valor Aporte', 'Cotas']],
        body: ordens.map((o: any) => [
          o.nome || 'N/A',
          o.ticker || o.cnpj || '—',
          formatarMoeda(o.valor),
          o.cotas ? o.cotas.toString() : '—',
        ]),
        theme: 'plain',
        headStyles: {
          fillColor: LG.PANEL,
          textColor: LG.MUTED,
          fontSize: 7.5,
          fontStyle: 'bold',
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        },
        bodyStyles: {
          fillColor: LG.SURFACE,
          textColor: LG.TEXT,
          fontSize: 8,
          cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
        },
        alternateRowStyles: {
          fillColor: LG.PANEL,
        },
        columnStyles: {
          2: { halign: 'right', textColor: LG.EMERALD, fontStyle: 'bold' },
          3: { halign: 'right' },
        },
        margin: { left: M, right: M },
        tableLineColor: LG.BORDER,
        tableLineWidth: 0.2,
      });

      Y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ─── SELL ORDERS ─────────────────────────────────────────────────────────
  if (data.ordensVenda && data.ordensVenda.length > 0) {
    if (Y > pageH - 60) {
      doc.addPage();
      paintBg();
      Y = M + 10;
    }

    doc.setFillColor(LG.ROSE[0], LG.ROSE[1], LG.ROSE[2]);
    doc.roundedRect(M, Y, 30, 1.5, 0.75, 0.75, 'F');
    Y += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(LG.ROSE[0], LG.ROSE[1], LG.ROSE[2]);
    doc.text('ORDENS DE VENDA / DESINVESTIMENTO', M, Y);
    Y += 6;

    (doc as any).autoTable({
      startY: Y,
      head: [['Classe', 'Ativo', 'Ticker / CNPJ', 'Valor Venda']],
      body: data.ordensVenda.map((o: any) => [
        o.classe || 'N/A',
        o.nome || 'N/A',
        o.ticker || o.cnpj || '—',
        formatarMoeda(o.valor),
      ]),
      theme: 'plain',
      headStyles: {
        fillColor: LG.PANEL,
        textColor: LG.MUTED,
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      },
      bodyStyles: {
        fillColor: LG.SURFACE,
        textColor: LG.TEXT,
        fontSize: 8,
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      },
      alternateRowStyles: {
        fillColor: LG.PANEL,
      },
      columnStyles: {
        3: { halign: 'right', textColor: [LG.ROSE[0], LG.ROSE[1], LG.ROSE[2]], fontStyle: 'bold' },
      },
      margin: { left: M, right: M },
      tableLineColor: LG.BORDER,
      tableLineWidth: 0.2,
    });

    Y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── FOOTER on all pages ─────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(LG.BORDER[0], LG.BORDER[1], LG.BORDER[2]);
    doc.setLineWidth(0.3);
    doc.line(M, pageH - 12, pageW - M, pageH - 12);
    doc.setFontSize(7);
    doc.setTextColor(LG.MUTED[0], LG.MUTED[1], LG.MUTED[2]);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${data.planejador?.user_metadata?.full_name || data.planejador?.full_name || ''} • ${planEmail || ''}`,
      M, pageH - 8
    );
    doc.text(`${i} / ${pageCount}`, pageW - M, pageH - 8, { align: 'right' });
  }

  doc.save(`Protocolo_Alocacao_${(data.cliente?.nome || 'cliente').replace(/\s+/g, '_')}_${data.dataGeracao.replace(/\//g, '-')}.pdf`);
};



