import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { normalizarTexto } from './formatadores';

// Worker do pdf.js — Vite empacota como asset separado via new URL(...).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export interface LinhaExtraida {
    nomeOriginal: string;
    valor: number;
    dataOriginal?: string;
    emailOriginal?: string;
    documentoOriginal?: string;
}

// Sinônimos de cabeçalho, em ordem de prioridade (o primeiro que combinar vence).
const SINONIMOS_NOME = ['cliente', 'nome', 'beneficiario', 'segurado', 'titular'];
const SINONIMOS_VALOR = ['repasse', 'comissao', 'liquido recebido', 'valor liquido', 'valor venda', 'valor'];
const SINONIMOS_EMAIL = ['email', 'e-mail'];
const SINONIMOS_DOCUMENTO = ['documento', 'cpf', 'cnpj'];
const SINONIMOS_DATA = ['data', 'vencimento', 'transacao'];

const ehCandidatoValor = (texto: string): boolean => /r?\$?\s*-?\d[\d.,]*\d|-?\d+,\d{2}/.test(texto);

export const parseValorMonetario = (raw: any): number => {
    if (typeof raw === 'number') return raw;
    if (!raw) return 0;
    const limpo = String(raw).replace(/[R$\s]/gi, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = parseFloat(limpo);
    return isNaN(n) ? 0 : n;
};

// Para cada sinônimo, NA ORDEM DE PRIORIDADE, tenta exato e depois parcial antes de passar ao
// próximo sinônimo — assim um sinônimo de prioridade mais alta com match só parcial (ex.:
// "repasse" em "Repasse (R$)") não perde para um de prioridade mais baixa que combine
// exatamente (ex.: "comissao" === "Comissão").
const encontrarColuna = (headers: string[], sinonimos: string[]): string | null => {
    const normalizados = headers.map(h => ({ original: h, norm: normalizarTexto(h) }));
    for (const sin of sinonimos) {
        const match = normalizados.find(h => h.norm === sin) || normalizados.find(h => h.norm.includes(sin));
        if (match) return match.original;
    }
    return null;
};

// ==========================================
// Planilha (.xlsx / .csv) — mapeamento de colunas por sinônimo de cabeçalho.
// ==========================================
export const extrairDePlanilha = async (file: File): Promise<LinhaExtraida[]> => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);
    if (rows.length === 0) return [];

    const headers = Object.keys(rows[0]);
    const colNome = encontrarColuna(headers, SINONIMOS_NOME);
    const colValor = encontrarColuna(headers, SINONIMOS_VALOR);
    const colEmail = encontrarColuna(headers, SINONIMOS_EMAIL);
    const colDocumento = encontrarColuna(headers, SINONIMOS_DOCUMENTO);
    const colData = encontrarColuna(headers, SINONIMOS_DATA);

    if (!colNome || !colValor) {
        throw new Error('Não foi possível identificar as colunas de nome do cliente e valor na planilha.');
    }

    return rows
        .map(r => ({
            nomeOriginal: String(r[colNome] || '').trim(),
            valor: parseValorMonetario(r[colValor]),
            emailOriginal: colEmail ? (String(r[colEmail] || '').trim() || undefined) : undefined,
            documentoOriginal: colDocumento ? (String(r[colDocumento] || '').trim() || undefined) : undefined,
            dataOriginal: colData ? (String(r[colData] || '').trim() || undefined) : undefined,
        }))
        .filter(l => l.nomeOriginal && l.valor > 0);
};

// ==========================================
// PDF — reconstrução de tabela a partir de posições de texto (x, y), página a página.
// ==========================================
interface CelulaPdf { x: number; y: number; texto: string; }

const extrairPaginasDoPdf = async (file: File): Promise<CelulaPdf[][]> => {
    const buffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    const paginas: CelulaPdf[][] = [];
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const celulas: CelulaPdf[] = [];
        content.items.forEach((item: any) => {
            if (item.str && item.str.trim()) {
                celulas.push({ x: item.transform[4], y: item.transform[5], texto: item.str.trim() });
            }
        });
        paginas.push(celulas);
    }
    return paginas;
};

/** Acha, num conjunto de células normalizadas, a que melhor combina com os sinônimos — respeitando a ORDEM de prioridade da lista. */
const melhorCelulaPorSinonimo = <T extends { norm: string }>(cels: T[], sinonimos: string[]): T | undefined => {
    for (const sin of sinonimos) {
        const match = cels.find(c => c.norm === sin) || cels.find(c => c.norm.includes(sin));
        if (match) return match;
    }
    return undefined;
};

// Distância horizontal máxima (pontos do PDF) entre uma célula de dados e a coluna do cabeçalho.
const TOLERANCIA_COLUNA_PT = 80;
// Células do cabeçalho podem estar em alturas ligeiramente diferentes (títulos com quebra de linha).
const TOLERANCIA_Y_HEADER_PT = 26;
// Distância vertical máxima entre uma célula e a âncora (valor) da mesma linha de dados —
// cobre nomes que quebram em duas linhas dentro da mesma célula da tabela.
const TOLERANCIA_Y_LINHA_PT = 14;

const extrairTabelaDaPagina = (celulas: CelulaPdf[]): LinhaExtraida[] => {
    const cels = celulas.map(c => ({ ...c, norm: normalizarTexto(c.texto) }));

    // 1. Cabeçalho: célula de "nome" e de "valor" (por prioridade de sinônimo — ex.: "repasse"
    //    vence "comissão") que estejam aproximadamente na mesma altura, mesmo que não idêntica.
    const nomeHeader = melhorCelulaPorSinonimo(cels.filter(c => c.norm.length < 30), SINONIMOS_NOME);
    if (!nomeHeader) return [];
    const candidatosValor = cels.filter(c => c.norm.length < 30 && Math.abs(c.y - nomeHeader.y) <= TOLERANCIA_Y_HEADER_PT && c !== nomeHeader);
    const valorHeader = melhorCelulaPorSinonimo(candidatosValor, SINONIMOS_VALOR);
    if (!valorHeader) return [];

    const cabecalhoY = Math.min(nomeHeader.y, valorHeader.y);
    const mesmaAltura = (c: { y: number }) => Math.abs(c.y - nomeHeader.y) <= TOLERANCIA_Y_HEADER_PT;
    const emailHeader = melhorCelulaPorSinonimo(candidatosValor.filter(mesmaAltura), SINONIMOS_EMAIL);
    const docHeader = melhorCelulaPorSinonimo(candidatosValor.filter(mesmaAltura), SINONIMOS_DOCUMENTO);
    const dataHeader = melhorCelulaPorSinonimo(candidatosValor.filter(mesmaAltura), SINONIMOS_DATA);

    // 2. Âncoras de linha: células monetárias na coluna do valor, abaixo do cabeçalho
    //    (no PDF o eixo Y cresce para cima, então "abaixo" = y menor).
    const abaixoDoHeader = cels.filter(c => c.y < cabecalhoY - 2);
    const ancoras = abaixoDoHeader
        .filter(c => Math.abs(c.x - valorHeader.x) <= TOLERANCIA_COLUNA_PT && parseValorMonetario(c.texto) > 0)
        .sort((a, b) => b.y - a.y);

    // 3. Para cada âncora, junta as células da mesma linha (mesma faixa de Y) e lê cada coluna.
    const textoDaColuna = (linha: typeof abaixoDoHeader, xAlvo: number): string | undefined => {
        const daColuna = linha
            .filter(c => Math.abs(c.x - xAlvo) <= TOLERANCIA_COLUNA_PT)
            .sort((a, b) => b.y - a.y || a.x - b.x);
        if (daColuna.length === 0) return undefined;
        return daColuna.map(c => c.texto).join(' ').trim();
    };

    const resultado: LinhaExtraida[] = [];
    ancoras.forEach(ancora => {
        const linha = abaixoDoHeader.filter(c => Math.abs(c.y - ancora.y) <= TOLERANCIA_Y_LINHA_PT && c !== ancora);
        const nome = textoDaColuna(linha, nomeHeader.x);
        if (!nome || nome.length < 3) return;

        resultado.push({
            nomeOriginal: nome,
            valor: parseValorMonetario(ancora.texto),
            emailOriginal: emailHeader ? textoDaColuna(linha, emailHeader.x) : undefined,
            documentoOriginal: docHeader ? textoDaColuna(linha, docHeader.x) : undefined,
            dataOriginal: dataHeader ? textoDaColuna(linha, dataHeader.x) : undefined,
        });
    });
    return resultado;
};

// ==========================================
// OCR (fallback para PDF escaneado / imagem) — sem estrutura de tabela; usa regex por linha.
// ==========================================
const extrairViaOcrTexto = (textoBruto: string): LinhaExtraida[] => {
    const linhas = textoBruto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const resultado: LinhaExtraida[] = [];

    linhas.forEach(linha => {
        const matches = Array.from(linha.matchAll(/R?\$?\s*(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+\.\d{2})/g));
        if (matches.length === 0) return;

        // Em tabelas de repasse, o valor efetivamente recebido é convencionalmente a ÚLTIMA
        // coluna monetária da linha (ex.: "... Comissão 211,84 Repasse 56,05" → 56,05).
        const valor = parseValorMonetario(matches[matches.length - 1][1]);
        if (valor <= 0) return;

        // O nome vem antes do PRIMEIRO valor monetário da linha.
        const nome = linha.slice(0, matches[0].index).replace(/[|:;\-–]+\s*$/, '').trim();
        if (nome.length < 3) return;
        resultado.push({ nomeOriginal: nome, valor });
    });

    return resultado;
};

const ocrDeImagemOuCanvas = async (source: HTMLCanvasElement | File): Promise<string> => {
    const Tesseract = await import('tesseract.js');
    const { data } = await Tesseract.recognize(source as any, 'por');
    return data.text;
};

export const extrairDePdf = async (file: File): Promise<LinhaExtraida[]> => {
    const paginas = await extrairPaginasDoPdf(file);

    const tabela = paginas.flatMap(celulas => extrairTabelaDaPagina(celulas));
    if (tabela.length > 0) return tabela;

    // Sem texto embutido (ou tabela não reconhecida) — provável PDF escaneado: renderiza páginas e roda OCR.
    const buffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    let textoCompleto = '';
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
        textoCompleto += '\n' + await ocrDeImagemOuCanvas(canvas);
    }
    return extrairViaOcrTexto(textoCompleto);
};

export const extrairDeImagem = async (file: File): Promise<LinhaExtraida[]> => {
    const texto = await ocrDeImagemOuCanvas(file);
    return extrairViaOcrTexto(texto);
};

// ==========================================
// Dispatcher por tipo de arquivo.
// ==========================================
export const extrairArquivo = async (file: File): Promise<LinhaExtraida[]> => {
    const nome = file.name.toLowerCase();
    if (nome.endsWith('.xlsx') || nome.endsWith('.xls') || nome.endsWith('.csv')) {
        return extrairDePlanilha(file);
    }
    if (nome.endsWith('.pdf')) {
        return extrairDePdf(file);
    }
    if (nome.endsWith('.png') || nome.endsWith('.jpg') || nome.endsWith('.jpeg')) {
        return extrairDeImagem(file);
    }
    throw new Error(`Formato de arquivo não suportado: ${file.name}`);
};
