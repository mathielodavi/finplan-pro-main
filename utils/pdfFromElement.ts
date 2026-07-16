import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Captura um elemento do DOM e gera um PDF A4 (multi-página) para download, preservando o layout
 * exato renderizado na tela. Fatia o canvas na altura da página SEM respeitar limites de conteúdo
 * — linhas de tabela podem ser cortadas ao meio. Prefira `baixarElementoComoPDFPaginado` quando o
 * elemento marcar seus blocos com `data-pdf-block`.
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

/**
 * Gera o PDF A4 paginando por BLOCOS: cada descendente marcado com `data-pdf-block` é capturado
 * como uma imagem independente e os blocos são empilhados página a página — um bloco que não
 * cabe no espaço restante desce inteiro para a página seguinte, em vez de ser cortado ao meio.
 *
 * Um bloco maior que uma página inteira (ex.: tabela com dezenas de linhas) é a única situação
 * em que ainda há fatiamento — inevitável sem re-renderizar a tabela, e sinalizado aqui como
 * fallback proposital.
 *
 * Sem nenhum `data-pdf-block` no elemento, cai no comportamento antigo (captura única).
 */
export async function baixarElementoComoPDFPaginado(el: HTMLElement, filename: string, bgHex = '#151823') {
  const blocos = Array.from(el.querySelectorAll<HTMLElement>('[data-pdf-block]'));
  if (blocos.length === 0) return baixarElementoComoPDF(el, filename, bgHex);

  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margem = 8;   // mm — respiro nas bordas da página
  const espacoEntreBlocos = 4; // mm
  const larguraUtil = pageW - margem * 2;
  const alturaUtil = pageH - margem * 2;

  const rgb = hexToRgb(bgHex);
  const pintarFundo = () => {
    pdf.setFillColor(rgb.r, rgb.g, rgb.b);
    pdf.rect(0, 0, pageW, pageH, 'F');
  };

  pintarFundo();
  let y = margem;

  for (const bloco of blocos) {
    const canvas = await html2canvas(bloco, {
      scale: 2,
      backgroundColor: bgHex,
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL('image/png');
    const h = (canvas.height * larguraUtil) / canvas.width;

    if (h <= alturaUtil) {
      // Bloco cabe em uma página: se não couber no espaço restante, desce inteiro para a próxima.
      if (y + h > pageH - margem) {
        pdf.addPage();
        pintarFundo();
        y = margem;
      }
      pdf.addImage(imgData, 'PNG', margem, y, larguraUtil, h);
      y += h + espacoEntreBlocos;
    } else {
      // Fallback: bloco maior que uma página — fatia em páginas dedicadas.
      if (y > margem) {
        pdf.addPage();
        pintarFundo();
      }
      let restante = h;
      let deslocamento = 0;
      while (restante > 0) {
        pdf.addImage(imgData, 'PNG', margem, margem - deslocamento, larguraUtil, h);
        restante -= alturaUtil;
        deslocamento += alturaUtil;
        if (restante > 0) {
          pdf.addPage();
          pintarFundo();
        }
      }
      pdf.addPage();
      pintarFundo();
      y = margem;
    }
  }

  pdf.save(filename);
}

/**
 * Gera um PDF A4 PAISAGEM onde cada descendente marcado com `data-pdf-page` vira exatamente uma
 * página (o elemento já deve ter a proporção A4 paisagem ~1.414:1 — ele é esticado para a página
 * inteira, sem margens). Usado pelos relatórios "editoriais" (capa/contracapa/duas colunas).
 *
 * Links clicáveis: qualquer descendente com `data-pdf-href="https://..."` ganha uma anotação de
 * link na área correspondente da página (html2canvas rasteriza tudo, então o link precisa ser
 * re-anotado por cima da imagem).
 */
export async function baixarPaginasComoPDF(container: HTMLElement, filename: string) {
  const paginas = Array.from(container.querySelectorAll<HTMLElement>('[data-pdf-page]'));
  if (paginas.length === 0) return baixarElementoComoPDF(container, filename);

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < paginas.length; i++) {
    const pagina = paginas[i];
    if (i > 0) pdf.addPage();

    const canvas = await html2canvas(pagina, {
      scale: 2,
      backgroundColor: null,
      useCORS: true,
      logging: false,
    });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, pageH);

    // Reanota os links por cima da imagem rasterizada.
    const pagRect = pagina.getBoundingClientRect();
    const fx = pageW / pagRect.width;
    const fy = pageH / pagRect.height;
    pagina.querySelectorAll<HTMLElement>('[data-pdf-href]').forEach(el => {
      const url = el.getAttribute('data-pdf-href');
      if (!url) return;
      const r = el.getBoundingClientRect();
      pdf.link((r.left - pagRect.left) * fx, (r.top - pagRect.top) * fy, r.width * fx, r.height * fy, { url });
    });
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
