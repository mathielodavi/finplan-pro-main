import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Captura um elemento do DOM e gera um PDF A4 (multi-página) para download, preservando o layout
 * exato renderizado na tela. Usado para o Relatório de Aporte (segue o layout da tela de Revisão),
 * substituindo a geração programática antiga.
 *
 * `bgHex` preenche o fundo de cada página (evita faixas brancas no tema escuro).
 */
export async function baixarElementoComoPDF(el: HTMLElement, filename: string, bgHex = '#151823') {
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: bgHex,
    useCORS: true,
    logging: false,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  const rgb = hexToRgb(bgHex);

  let heightLeft = imgH;
  let position = 0;
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
  pdf.rect(0, 0, pageW, pageH, 'F');
  pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
  heightLeft -= pageH;

  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.setFillColor(rgb.r, rgb.g, rgb.b);
    pdf.rect(0, 0, pageW, pageH, 'F');
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;
  }

  pdf.save(filename);
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}
