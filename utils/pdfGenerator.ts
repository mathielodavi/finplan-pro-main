
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
  totalVendas?: number;
  reservaAlloc?: any[];
  projetosAlloc?: any[];
  distribuicao: {
    reserva: number;
    projetos: number;
    independencia: number;
    ativoReserva?: string;
    ativoProjetos?: string;
    acumuladoReserva?: number;
    acumuladoProjetos?: number;
  };
  assetMix?: {
    classe: string;
    saldo_atual: number;
    alvo_perc: number;
    aporte_sugerido: number;
    cor?: string;
  }[];
  ordensCompra: any[];
  ordensVenda: any[];
  dataGeracao: string;
}

// ─── Theme helpers ───────────────────────────────────────────────────
const LG = {
  BG: [255, 255, 255] as const, // white
  PANEL: [248, 250, 252] as const, // slate-50 (light panel)
  SURFACE: [255, 255, 255] as const, // white card
  EMERALD: [16, 185, 129] as const, // emerald 500
  EMERALD_D: [5, 150, 105] as const, // emerald 600
  ROSE: [244, 63, 94] as const, // rose 500
  AMBER: [251, 146, 60] as const, // amber 400
  TEXT: [30, 41, 59] as const, // slate-800
  MUTED: [100, 116, 139] as const, // slate-500
  BORDER: [226, 232, 240] as const, // slate-200
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
    // Top primary header banner
    doc.setFillColor(LG.EMERALD[0], LG.EMERALD[1], LG.EMERALD[2]);
    doc.rect(0, 0, pageW, 28, 'F');
  };

  const addPageHeader = () => {
    paintBg();
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PROTOCOLO DE ALOCAÇÃO MENSAL', 14, 18);
  };

  paintBg();

  // ─── PAGE 1 HEADER ───────────────────────────────────────────────────────
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PROTOCOLO DE ALOCAÇÃO MENSAL', pageW / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório Estratégico de Investimentos — FinPlan Pro', pageW / 2, 20, { align: 'center' });

  // Planner photo (circular placeholder or actual)
  const photoUrl = data.planejador?.user_metadata?.avatar_url || data.planejador?.avatar_url;
  const photoSize = 14;
  const photoX = M;
  let Y = 36;

  try {
    if (photoUrl) {
      // Use fallback se preferir
      const plannerName = data.planejador?.user_metadata?.full_name || data.planejador?.nome || data.planejador?.full_name || 'P';
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(plannerName)}&background=10b981&color=fff&size=128`;
      doc.addImage(avatarUrl, 'PNG', photoX, Y, photoSize, photoSize, '', 'FAST');
    } else {
      // Fallback circle
      doc.setFillColor(LG.EMERALD[0], LG.EMERALD[1], LG.EMERALD[2]);
      doc.circle(photoX + photoSize / 2, Y + photoSize / 2, photoSize / 2, 'F');
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      const initials = (data.planejador?.user_metadata?.full_name || data.planejador?.nome || data.planejador?.full_name || 'P').split(' ').map((n: string) => n[0]).join('').substring(0, 2);
      doc.text(initials.toUpperCase(), photoX + photoSize / 2, Y + photoSize / 2 + 2, { align: 'center' });
    }
  } catch { }

  // Planner info block (next to photo)
  const infoX = photoX + photoSize + 4;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(LG.TEXT[0], LG.TEXT[1], LG.TEXT[2]);
  doc.text(data.planejador?.user_metadata?.full_name || data.planejador?.nome || data.planejador?.full_name || 'Planejador', infoX, Y + 5);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(LG.MUTED[0], LG.MUTED[1], LG.MUTED[2]);
  // Use 'email_contato' if present, otherwise just email
  const planEmail = data.planejador?.email_contato || data.planejador?.email || data.planejador?.user_metadata?.email || '';
  const planPhone = data.planejador?.telefone || data.planejador?.user_metadata?.phone || data.planejador?.phone || '';
  if (planEmail || planPhone) doc.text(`${planEmail}  |  ${planPhone}`, infoX, Y + 11);

  Y += 24;

  // ─── DADOS DO CLIENTE & ESTRATÉGIA ───────────────────────────────────────
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTRATÉGIA DEFINIDA', 14, Y);
  Y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  const dadosEstrategia: [string, string][] = [
    ['CLIENTE', (data.cliente?.nome || 'N/A').toUpperCase()],
    ['ESTRATÉGIA BASE', (data.estrategia || 'N/A').toUpperCase()],
    ['TESE DE INVESTIMENTO', (data.tese || 'N/A').toUpperCase()],
    ['FAIXA DE ALOCAÇÃO', (data.faixa || 'N/A').toUpperCase()],
  ];

  dadosEstrategia.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${k}:`, 14, Y + i * 5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(v, 58, Y + i * 5.5);
  });

  Y += dadosEstrategia.length * 5.5 + 8;



  // ─── RESUMO DE APORTES E VENDAS ──────────────────────────────────────────
  const totalVendas = data.totalVendas || 0;
  const aporteComVendas = data.aporteTotal + totalVendas;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RECURSOS DISPONÍVEIS PARA ALOCAÇÃO', 14, Y);
  Y += 4;

  const boxesAvailable = [
    { label: 'Aporte Novo', val: formatarMoeda(data.aporteTotal), color: LG.EMERALD_D },
    { label: 'Saldo de Vendas', val: formatarMoeda(totalVendas), color: totalVendas > 0 ? LG.ROSE : LG.MUTED },
    { label: 'Total Disponível', val: formatarMoeda(aporteComVendas), color: LG.TEXT },
  ];
  const boxW = (pageW - M * 2 - 8) / 3;

  boxesAvailable.forEach((b, i) => {
    const cx = M + i * (boxW + 4);
    glassCard(doc, cx, Y, boxW, 20, LG.PANEL); // A lighter background
    label(doc, b.label, cx + 4, Y + 6);
    value(doc, b.val, cx + 4, Y + 15, 11, b.color as any);
  });

  Y += 28;

  // ─── DISTRIBUIÇÃO POR OBJETIVO ──────────────────────────────────────────
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DISTRIBUIÇÃO POR OBJETIVO', 14, Y);
  Y += 4;

  const dists = [
    { label: 'Reserva Estratégica', val: data.distribuicao.reserva, list: data.reservaAlloc || [] },
    { label: 'Projetos de Vida', val: data.distribuicao.projetos, list: data.projetosAlloc || [] },
    { label: 'Independência', val: data.distribuicao.independencia, list: (data.assetMix || []).filter(c => c.aporte_sugerido > 0).map(c => ({ nome: c.classe, valor: c.aporte_sugerido })) },
  ].filter(d => d.val > 0);

  if (dists.length > 0) {
    const dW = dists.length === 1 ? pageW - M * 2 : (pageW - M * 2 - (dists.length - 1) * 4) / dists.length;
    let maxLines = 0;
    dists.forEach(d => { if (d.list.length > maxLines) maxLines = d.list.length; });

    // Altura dinâmica baseada na quantidade de itens listados
    const cardH = 26 + (Math.min(maxLines, 8) * 4); // Limitamos a 8 itens na box

    dists.forEach((d, i) => {
      const cx = M + i * (dW + 4);
      glassCard(doc, cx, Y, dW, cardH, LG.PANEL);
      label(doc, d.label, cx + 4, Y + 6);
      value(doc, formatarMoeda(d.val), cx + 4, Y + 14, 10, LG.EMERALD as any);

      // List resources
      let ly = Y + 20;
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');

      d.list.slice(0, 8).forEach((item: any) => {
        doc.setTextColor(100, 116, 139);
        const nm = (item.nome || item.classe || '').substring(0, 15).toUpperCase();
        doc.text(nm, cx + 4, ly);
        doc.setTextColor(16, 185, 129);
        doc.text(formatarMoeda(item.valor || 0), cx + dW - 4, ly, { align: 'right' });
        ly += 4;
      });
      if (d.list.length > 8) {
        doc.setTextColor(100, 116, 139);
        doc.text(`+ ${d.list.length - 8} itens`, cx + 4, ly);
      }
    });
    Y += cardH + 12;
  }

  // ─── PROGRESSO: RESERVA E PROJETOS ──────────────────────────────────────
  if (data.distribuicao.reserva > 0 || data.distribuicao.projetos > 0) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ACOMPANHAMENTO DE PROGRESSO', 14, Y);
    Y += 6;

    if (data.distribuicao.reserva > 0) {
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold');
      doc.text('Reserva de Emergência', M, Y + 4);

      const accRes = data.distribuicao.acumuladoReserva || 0;
      const alvoRes = data.distribuicao.reserva;
      const percRes = Math.min(100, (accRes / alvoRes) * 100);

      doc.text(`${formatarMoeda(accRes)}  /  ${formatarMoeda(alvoRes)}`, pageW - M, Y + 4, { align: 'right' });
      Y += 6;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(M, Y, pageW - M * 2, 4, 2, 2, 'F');
      if (percRes > 0) {
        doc.setFillColor(16, 185, 129);
        doc.roundedRect(M, Y, (pageW - M * 2) * (percRes / 100), 4, 2, 2, 'F');
      }
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`${percRes.toFixed(1)}%`, pageW - M, Y + 8, { align: 'right' });
      Y += 10;
    }

    if (data.distribuicao.projetos > 0) {
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'bold');
      doc.text('Projetos de Vida', M, Y + 4);

      const accProj = data.distribuicao.acumuladoProjetos || 0;
      const alvoProj = data.distribuicao.projetos;
      const percProj = Math.min(100, (accProj / alvoProj) * 100);

      doc.text(`${formatarMoeda(accProj)}  /  ${formatarMoeda(alvoProj)}`, pageW - M, Y + 4, { align: 'right' });
      Y += 6;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(M, Y, pageW - M * 2, 4, 2, 2, 'F');
      if (percProj > 0) {
        doc.setFillColor(16, 185, 129);
        doc.roundedRect(M, Y, (pageW - M * 2) * (percProj / 100), 4, 2, 2, 'F');
      }
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`${percProj.toFixed(1)}%`, pageW - M, Y + 8, { align: 'right' });
      Y += 10;
    }
  }

  // ─── ASSET MIX CHART ──────────────────────────────────────────────────
  if (data.assetMix && data.assetMix.length > 0) {
    if (Y > pageH - 45) {
      doc.addPage();
      addPageHeader();
      Y = 40;
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ASSET MIX: ESTRATÉGIA VS ATUAL', 14, Y);
    Y += 6;

    const chartW = pageW - M * 2;
    const rowH = 10;
    const chartH = data.assetMix.length * rowH + 10;

    if (Y + chartH > pageH - 25) {
      doc.addPage();
      addPageHeader();
      Y = 40;
    }

    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(M, Y, chartW, chartH, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.2);
    doc.roundedRect(M, Y, chartW, chartH, 2, 2, 'S');

    let barY = Y + 6;

    const totalIf = data.assetMix.reduce((sum: number, c: any) => sum + (c.saldo_atual || 0) + (c.aporte_sugerido || 0), 0);

    data.assetMix.forEach((c: any) => {
      const alvo = c.alvo_perc || 0;
      const atualValor = (c.saldo_atual || 0) + (c.aporte_sugerido || 0);
      const atualPerc = totalIf > 0 ? (atualValor / totalIf) * 100 : 0;

      // Label
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85); // slate-700
      doc.text(c.classe.substring(0, 18).toUpperCase(), M + 4, barY + 3.5);

      // Bars area starts at X = M + 45
      const barAreaX = M + 50;
      const barMaxW = chartW - 75;

      // Draw Target (hollow border)
      const alvoW = barMaxW * (alvo / 100);
      if (alvoW > 0) {
        doc.setDrawColor(148, 163, 184); // slate-400
        doc.setLineWidth(0.3);
        doc.roundedRect(barAreaX, barY, alvoW, 3.5, 0.5, 0.5, 'S');
      }

      // Draw Current (filled)
      const atualW = barMaxW * (atualPerc / 100);
      if (atualW > 0) {
        doc.setFillColor(16, 185, 129); // emerald-500
        doc.roundedRect(barAreaX, barY + 0.5, atualW, 2.5, 0.5, 0.5, 'F');
      }

      // Value text
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(`${atualPerc.toFixed(1)}% (Alvo: ${alvo}%)`, barAreaX + Math.max(alvoW, atualW) + 2, barY + 2.5);

      barY += rowH;
    });

    Y += chartH + 12;
  }

  // ─── BUY ORDERS — per class ───────────────────────────────────────────────
  if (data.ordensCompra && data.ordensCompra.length > 0) {
    doc.addPage();
    addPageHeader();
    Y = 40;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(LG.TEXT[0], LG.TEXT[1], LG.TEXT[2]);
    doc.text('ORDENS DE COMPRA', M, Y);
    Y += 8;

    // Group by class
    const classeMap: Record<string, any[]> = {};
    (data.ordensCompra || []).forEach((o: any) => {
      const k = o.classe || 'Outros';
      if (!classeMap[k]) classeMap[k] = [];
      classeMap[k].push(o);
    });

    for (const [classe, ordens] of Object.entries(classeMap)) {
      // Check page space
      if (Y > pageH - 45) {
        doc.addPage();
        addPageHeader();
        Y = 40;
      }

      // Class header
      doc.setFontSize(9);
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
          fillColor: LG.EMERALD,
          textColor: LG.WHITE,
          fontSize: 8,
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
          2: { halign: 'right', textColor: LG.TEXT, fontStyle: 'bold' },
          3: { halign: 'right' },
        },
        margin: { left: M, right: M },
        tableLineColor: LG.PANEL,
        tableLineWidth: 0,
      });

      Y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ─── SELL ORDERS ─────────────────────────────────────────────────────────
  if (data.ordensVenda && data.ordensVenda.length > 0) {
    doc.addPage();
    addPageHeader();
    Y = 40;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(LG.TEXT[0], LG.TEXT[1], LG.TEXT[2]);
    doc.text('ORDENS DE VENDA / DESINVESTIMENTO', M, Y);
    Y += 8;

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
        fillColor: LG.ROSE,
        textColor: LG.WHITE,
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
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
        3: { halign: 'right', textColor: LG.TEXT, fontStyle: 'bold' },
      },
      margin: { left: M, right: M },
      tableLineColor: LG.PANEL,
      tableLineWidth: 0,
    });

    Y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ─── FOOTER on all pages ─────────────────────────────────────────────────
  const pageCountLocal = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCountLocal; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240); // LG.BORDER light
    doc.setLineWidth(0.3);
    doc.line(M, pageH - 12, pageW - M, pageH - 12);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // LG.MUTED light
    doc.setFont('helvetica', 'normal');

    const email = data.planejador?.email_contato || data.planejador?.email || data.planejador?.user_metadata?.email || '';
    const plannerName = data.planejador?.user_metadata?.full_name || data.planejador?.nome || data.planejador?.full_name || '';

    if (plannerName || email) {
      doc.text(`${plannerName} • ${email}`, M, pageH - 8);
    }

    doc.text(`${i} / ${pageCountLocal}`, pageW - M, pageH - 8, { align: 'right' });
  }

  doc.save(`Protocolo_Alocacao_${(data.cliente?.nome || 'cliente').replace(/\s+/g, '_')}_${data.dataGeracao.replace(/\//g, '-')}.pdf`);
};



