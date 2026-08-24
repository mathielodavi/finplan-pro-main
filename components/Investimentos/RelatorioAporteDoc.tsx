import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ComposedChart, Line, Area, XAxis, YAxis, ReferenceLine } from 'recharts';
import { formatarMoeda } from '../../utils/formatadores';

/**
 * Relatório de aporte no padrão editorial "DNA Financeiro": páginas A4 paisagem, fundo escuro
 * neutro, headline serifada creme, acento verde-menta, duas colunas nas páginas de dados e
 * contracapa verde com QR codes. Cada página é marcada com `data-pdf-page` (uma página = uma
 * folha no PDF) e links clicáveis usam `data-pdf-href` (reanotados por cima do raster).
 * Cores em hex fixo — html2canvas não entende oklch e o documento tem paleta própria, não a do app.
 */

export interface DadosRelatorioAporte {
  clienteNome: string;
  planejadorNome?: string | null;
  dataStr: string;
  perfilNome: string;
  teseNome: string;
  faixaNome: string;
  aporte: number;
  totalVendas: number;
  recursoDisponivel: number;
  distribuicao: { reserva: number; projetos: number; independencia: number };
  aporteMetaMensal: number | null;
  /** meses (real − planejado): positivo = atraso, negativo = antecipação, null = indisponível */
  deltaPrazoMeses: number | null;
  /** Patrimônio projetado aos 100 anos seguindo o plano à risca (data planejada, sem antecipar/postergar) — null sem idade cadastrada. */
  patrimonioSucessao: number | null;
  /** true quando `patrimonioSucessao` supera o piso de materialidade (ver LIMIAR_LIBERDADE_FINANCEIRA em independenciaUtils) — projeta sobra de patrimônio para sucessão, não só sustento. */
  liberdadeFinanceira: boolean;
  barData: { classe: string; alvo: number; atual: number; cor: string }[];
  curva: { label: string; plano: number; real: number | null; liberdade: number | null; target: number }[];
  reserva: { alvo: number; acumulado: number; aportarEm: { nome: string; valor: number }[] };
  projetos: { nome: string; alvo: number; acumulado: number }[];
  projetosAportarEm: { nome: string; valor: number }[];
  vendas: { nome: string; codigo: string; destino: string; valor: number; origem?: string; tipoEspecifico?: string }[];
  ordens: { classe: string; fundo: number; ativos: { nome: string; codigo: string; aporte: number; cotas: number }[] }[];
  whatsappUrl: string;
  instagramUrl: string;
}

// ─── Paleta editorial (referência DNA Financeiro) ─────────────────────────────
const C = {
  bg: '#131512',
  panel: '#1b1e1b',
  panelBorder: '#272b27',
  cream: '#f1eee7',
  body: '#b9bdb7',
  faint: '#878d86',
  accent: '#3ad6a0',
  warning: '#e0b15c',
  greenCard: '#11493576',
  greenCardBorder: '#1d6b4e',
  backCover: '#175243',
  danger: '#f08c8c',
  liberdade: '#b7a4f0',
};

// Sistema tipográfico do relatório: Archivo (variable) para títulos/destaques, Instrument Sans
// (variable) como fonte padrão do corpo — carregadas via Google Fonts, hospedadas fora do bundle
// (o documento é renderizado por html2canvas, que lê fontes já carregadas na página via
// `document.fonts`). ui-monospace fica reservado para números de pontuação de outros relatórios
// (não há esse elemento aqui, mas o padrão é o mesmo do restante do produto).
const FONT_DISPLAY = "'Archivo Variable', Archivo, sans-serif";
const FONT_SANS = "'Instrument Sans Variable', 'Instrument Sans', sans-serif";
const GOOGLE_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400..900&family=Instrument+Sans:wght@400..700&display=swap';

const PAGE_W = 1050;
const PAGE_H = 742; // proporção A4 paisagem (297×210)

// ─── Sinalização de possível DARF nas vendas ──────────────────────────────────
// Heurística informativa (não é apuração fiscal): sinaliza classes de ativo sem isenção mensal de
// IR (FIIs e ETFs de bolsa — tributados a 15/20% sobre eventual ganho em qualquer valor vendido) e
// classes com isenção por limite mensal (ações até R$20 mil, cripto até R$35 mil) quando a SOMA das
// vendas dessa classe NESTA operação ultrapassa o limite. Não considera outras vendas do cliente no
// mês fora desta simulação, nem se houve efetivamente ganho de capital — por isso o texto do
// relatório é explícito em recomendar conferência com o contador/corretora antes do recolhimento.
const LIMIAR_ISENCAO_ACOES = 20000;
const LIMIAR_ISENCAO_CRIPTO = 35000;

interface VendaComAtencaoFiscal { nome: string; codigo: string; valor: number; motivo: string }

const analisarAtencaoFiscal = (vendas: DadosRelatorioAporte['vendas']): VendaComAtencaoFiscal[] => {
  const ehAcao = (v: DadosRelatorioAporte['vendas'][0]) => v.origem === 'bolsa' && (!v.tipoEspecifico || v.tipoEspecifico === 'Ações');
  const ehCripto = (v: DadosRelatorioAporte['vendas'][0]) => v.tipoEspecifico === 'Criptomoedas';

  const totalAcoes = vendas.filter(ehAcao).reduce((s, v) => s + v.valor, 0);
  const totalCripto = vendas.filter(ehCripto).reduce((s, v) => s + v.valor, 0);

  const out: VendaComAtencaoFiscal[] = [];
  vendas.forEach(v => {
    let motivo: string | null = null;
    if (v.origem === 'bolsa' && v.tipoEspecifico === 'FIIs') {
      motivo = 'FII — sem isenção de R$ 20 mil; havendo ganho na venda, o IR (20%) é recolhido via DARF.';
    } else if (v.origem === 'bolsa' && v.tipoEspecifico === 'ETFs') {
      motivo = 'ETF — sem isenção de R$ 20 mil; havendo ganho na venda, o IR (15%) é recolhido via DARF.';
    } else if (ehAcao(v) && totalAcoes > LIMIAR_ISENCAO_ACOES) {
      motivo = `Ações — total vendido nesta operação (${formatarMoeda(totalAcoes)}) ultrapassa a isenção mensal de R$ 20 mil; havendo ganho, recolhimento via DARF.`;
    } else if (ehCripto(v) && totalCripto > LIMIAR_ISENCAO_CRIPTO) {
      motivo = `Criptoativo — total vendido nesta operação (${formatarMoeda(totalCripto)}) ultrapassa a isenção mensal de R$ 35 mil; havendo ganho, recolhimento via DARF.`;
    }
    if (motivo) out.push({ nome: v.nome, codigo: v.codigo, valor: v.valor, motivo });
  });
  return out;
};

const formatarAnosMeses = (m: number) => {
  const anos = Math.floor(m / 12);
  const meses = m % 12;
  const pa = anos > 0 ? `${anos} ${anos === 1 ? 'ano' : 'anos'}` : '';
  const pm = meses > 0 ? `${meses} ${meses === 1 ? 'mês' : 'meses'}` : '';
  return pa && pm ? `${pa} e ${pm}` : (pa || pm || '0 meses');
};

// ─── Blocos base ──────────────────────────────────────────────────────────────
const Pagina: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = C.bg }) => (
  <div
    data-pdf-page
    className="relative overflow-hidden shrink-0"
    style={{ width: PAGE_W, height: PAGE_H, backgroundColor: bg, fontFamily: 'inherit' }}
  >
    {children}
  </div>
);

// Largura máxima de ~50% da página (menos as margens) — o texto nunca cruza a linha central,
// então continua legível mesmo com o nome do cliente longo, sem disputar espaço com o número.
const Rodape: React.FC<{ num: string; cliente: string; data: string }> = ({ num, cliente, data }) => (
  <div className="absolute bottom-0 left-0 right-0 flex justify-between items-center" style={{ padding: '0 64px 26px' }}>
    <span style={{
      color: C.faint, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
      lineHeight: 1.4, maxWidth: PAGE_W / 2 - 64, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      // Folga vertical no clip: overflow:hidden (necessário p/ o ellipsis de 1 linha) faz o
      // html2canvas cortar o topo/base dos glifos; o padding entra dentro da caixa de clip e
      // a margem negativa compensa a posição, evitando o corte sem alterar o layout.
      paddingTop: 3, paddingBottom: 3, marginTop: -3, marginBottom: -3,
    }}>
      Simulação de Alocação Estratégica · {cliente} · {data}
    </span>
    <span style={{ color: C.faint, fontSize: 10.5, fontWeight: 700 }}>{num}</span>
  </div>
);

/** Página de duas colunas com divisor vertical central sutil (padrão da referência). */
const DuasColunas: React.FC<{ esquerda: React.ReactNode; direita: React.ReactNode }> = ({ esquerda, direita }) => (
  <div className="flex h-full">
    <div className="w-1/2 h-full" style={{ padding: '56px 44px 64px 64px' }}>{esquerda}</div>
    <div className="w-px h-full" style={{ backgroundColor: '#232723' }} />
    <div className="w-1/2 h-full" style={{ padding: '56px 64px 64px 44px' }}>{direita}</div>
  </div>
);

const TituloColuna: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ fontFamily: FONT_DISPLAY, color: C.cream, fontSize: 27, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.01em', marginBottom: 24 }}>{children}</h2>
);

const LabelVerde: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ color: C.accent, fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' }}>{children}</p>
);

const BarraProgresso: React.FC<{ pct: number }> = ({ pct }) => (
  <div style={{ height: 8, borderRadius: 99, backgroundColor: '#262a26', overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, borderRadius: 99, backgroundColor: C.accent }} />
  </div>
);

// Ícones das marcas (lucide não traz ícones de marca) — glifos inline nas cores oficiais.
const IconeWhatsApp = () => (
  <div style={{ width: 52, height: 52, borderRadius: 99, backgroundColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="30" height="30" viewBox="0 0 24 24" fill="#ffffff">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
    </svg>
  </div>
);

const IconeInstagram = () => (
  <div style={{ width: 52, height: 52, borderRadius: 99, backgroundColor: '#c13584', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="17.6" cy="6.4" r="1.3" fill="#ffffff" stroke="none" />
    </svg>
  </div>
);

// ─── Documento ────────────────────────────────────────────────────────────────
const RelatorioAporteDoc: React.FC<{ dados: DadosRelatorioAporte; innerRef?: React.Ref<HTMLDivElement> }> = ({ dados, innerRef }) => {
  const [qrWhats, setQrWhats] = useState<string | null>(null);
  const [qrInsta, setQrInsta] = useState<string | null>(null);

  useEffect(() => {
    const opts = { errorCorrectionLevel: 'H' as const, margin: 1, width: 400, color: { dark: '#0f3d2e', light: '#ffffff' } };
    QRCode.toDataURL(dados.whatsappUrl, opts).then(setQrWhats).catch(() => {});
    QRCode.toDataURL(dados.instagramUrl, opts).then(setQrInsta).catch(() => {});
  }, [dados.whatsappUrl, dados.instagramUrl]);

  // Paginação das ordens por classe: cada classe é uma "coluna"; quando não há vendas, a primeira
  // classe ocupa a coluna 2 da página 3; o restante flui em páginas de 2 colunas.
  const temVendas = dados.vendas.length > 0;
  const ordensRestantes = temVendas ? dados.ordens : dados.ordens.slice(1);
  const paginasOrdens: typeof dados.ordens[] = [];
  for (let i = 0; i < ordensRestantes.length; i += 2) paginasOrdens.push(ordensRestantes.slice(i, i + 2));

  const atencaoFiscal = temVendas ? analisarAtencaoFiscal(dados.vendas) : [];
  const temAtencaoFiscal = atencaoFiscal.length > 0;

  // Numeração: 01 = sumário; 02 = resumo executivo; 03 = reserva/projetos; 04.. = ordens;
  // (opcional) atenção fiscal; última = contato.
  const numPagOrdens = temVendas || dados.ordens.length > 1 ? `${String(4).padStart(2, '0')}` : '03';
  const numPagAtencaoFiscal = 4 + paginasOrdens.length;
  const totalPaginasNumeradas = 3 + paginasOrdens.length + (temAtencaoFiscal ? 1 : 0);

  const sumario: { titulo: string; pagina: string }[] = [
    { titulo: 'Resumo Executivo', pagina: '02' },
    { titulo: 'Alocação e Curva de Independência', pagina: '02' },
    { titulo: 'Reserva de Emergência e Projetos', pagina: '03' },
    ...(temVendas ? [{ titulo: 'Vendas e Desinvestimentos', pagina: '03' }] : []),
    { titulo: 'Distribuição de Ativos por Classe', pagina: temVendas ? numPagOrdens : '03' },
    ...(temAtencaoFiscal ? [{ titulo: 'Atenção Fiscal — Possível DARF', pagina: String(numPagAtencaoFiscal).padStart(2, '0') }] : []),
    { titulo: 'Contato e Compartilhamento', pagina: String(totalPaginasNumeradas + 1).padStart(2, '0') },
  ];

  const delta = dados.deltaPrazoMeses;
  const rodape = (num: number) => <Rodape num={String(num).padStart(2, '0')} cliente={dados.clienteNome} data={dados.dataStr} />;

  const linhaResumo = (rotulo: string, valor: string, destaque = false) => (
    <div className="flex justify-between items-baseline" style={{ padding: '9px 0', borderBottom: `1px solid ${C.panelBorder}` }}>
      <span style={{ color: C.faint, fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{rotulo}</span>
      <span style={{ color: destaque ? C.accent : C.cream, fontSize: 14.5, fontWeight: 700 }}>{valor}</span>
    </div>
  );

  const cardOrdens = (classe: typeof dados.ordens[0]) => (
    <div key={classe.classe}>
      <div className="flex justify-between items-baseline" style={{ marginBottom: 14 }}>
        <h3 style={{ fontFamily: FONT_DISPLAY, color: C.cream, fontSize: 19, fontWeight: 700, lineHeight: 1.35 }}>{classe.classe}</h3>
        <span style={{ color: C.accent, fontSize: 12, fontWeight: 700 }}>{formatarMoeda(classe.fundo)}</span>
      </div>
      <div style={{ backgroundColor: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 14, overflow: 'hidden' }}>
        {classe.ativos.map((at, i) => (
          <div key={i} className="flex justify-between items-center" style={{ padding: '11px 18px', borderTop: i > 0 ? `1px solid ${C.panelBorder}` : 'none' }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              {/* Sem overflow:hidden/ellipsis: o html2canvas corta glifos altos (maiúsculas em
                  negrito) na vertical quando há overflow:hidden no elemento de texto — o nome
                  quebra em duas linhas em vez de truncar, evitando o corte no PDF. */}
              <p style={{ color: C.cream, fontSize: 11.5, fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word' }}>{at.nome}</p>
              <p style={{ color: C.faint, fontSize: 9.5, lineHeight: 1.5, marginTop: 2 }}>{at.codigo || '—'}</p>
            </div>
            <div className="text-right shrink-0">
              <p style={{ color: C.accent, fontSize: 12, fontWeight: 700, lineHeight: 1.5 }}>{formatarMoeda(at.aporte)}</p>
              <p style={{ color: C.faint, fontSize: 9.5, lineHeight: 1.5, marginTop: 2 }}>{at.cotas > 0 ? `${at.cotas} cota${at.cotas > 1 ? 's' : ''}` : 'valor financeiro'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const secaoMeta = (titulo: string, alvo: number, acumulado: number) => {
    const pct = alvo > 0 ? (acumulado / alvo) * 100 : 0;
    return (
      <div style={{ marginBottom: 18 }}>
        <div className="flex justify-between items-baseline" style={{ marginBottom: 7 }}>
          <span style={{ color: C.body, fontSize: 12, fontWeight: 600 }}>{titulo}</span>
          <span style={{ color: C.cream, fontSize: 11.5, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
        </div>
        <BarraProgresso pct={pct} />
        <p style={{ color: C.faint, fontSize: 10.5, marginTop: 6 }}>
          Acumulado {formatarMoeda(acumulado)} · Alvo {formatarMoeda(alvo)}
        </p>
      </div>
    );
  };

  const listaAportarEm = (itens: { nome: string; valor: number }[]) => (
    itens.length === 0 ? (
      <p style={{ color: C.faint, fontSize: 11 }}>Sem aporte direcionado neste mês.</p>
    ) : (
      <div style={{ backgroundColor: C.greenCard, border: `1px solid ${C.greenCardBorder}`, borderRadius: 12, padding: '12px 16px' }}>
        <p style={{ color: C.accent, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>Aportar em</p>
        {itens.map((it, i) => (
          <div key={i} className="flex justify-between" style={{ padding: '4px 0' }}>
            <span style={{ color: C.cream, fontSize: 11.5, fontWeight: 600 }}>{it.nome}</span>
            <span style={{ color: C.cream, fontSize: 11.5, fontWeight: 700 }}>{formatarMoeda(it.valor)}</span>
          </div>
        ))}
      </div>
    )
  );

  return (
    <div ref={innerRef} className="flex flex-col items-center gap-6" style={{ fontFamily: FONT_SANS }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
      <link rel="preload" as="image" href="/relatorio-capa.jpg" />

      {/* ═══ CAPA ═══ */}
      <Pagina>
        <div className="flex h-full items-center" style={{ padding: '0 64px' }}>
          <div style={{ width: '58%', paddingRight: 48 }}>
            <LabelVerde>Simulação de Alocação Estratégica</LabelVerde>
            <h1 style={{ fontFamily: FONT_DISPLAY, color: C.cream, fontSize: 52, fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.015em', margin: '22px 0 26px' }}>
              {dados.clienteNome}
            </h1>
            <p style={{ color: C.faint, fontSize: 14 }}>Emitido em {dados.dataStr}</p>
          </div>
          <div className="flex justify-end" style={{ width: '42%' }}>
            {/* Foto ocupa ~1/3 da página, em P&B (asset já convertido), cantos arredondados como na
                referência. `background-image` em vez de `<img>` com object-fit: o html2canvas não
                aplica object-fit/object-position de forma confiável, mas respeita background-size/
                position — evita a foto sair distorcida ou em branco no PDF gerado. */}
            <div
              role="img"
              aria-label=""
              style={{
                width: PAGE_W / 3, height: 520, borderRadius: 24,
                backgroundImage: 'url(/relatorio-capa.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center 18%',
              }}
            />
          </div>
        </div>
      </Pagina>

      {/* ═══ 01 — SUMÁRIO + DISCLAIMER ═══ */}
      <Pagina>
        <DuasColunas
          esquerda={
            <>
              <TituloColuna>Sumário</TituloColuna>
              <div>
                {sumario.map((s, i) => (
                  <div key={i} className="flex items-baseline" style={{ padding: '13px 0', borderBottom: `1px solid ${C.panelBorder}` }}>
                    <span style={{ color: C.accent, fontSize: 11, fontWeight: 700, width: 34, fontFamily: 'ui-monospace, monospace' }}>{s.pagina}</span>
                    <span style={{ color: C.body, fontSize: 13.5, fontWeight: 600 }}>{s.titulo}</span>
                  </div>
                ))}
              </div>
            </>
          }
          direita={
            <div className="flex flex-col h-full">
              <TituloColuna>Sobre esta simulação</TituloColuna>
              <p style={{ color: C.body, fontSize: 13, lineHeight: 1.75 }}>
                Esta simulação não representa uma indicação pessoal de compra ou venda de ativos, mas sim um cálculo
                das distribuições dos valores disponíveis para aportes frente às necessidade que a sua alocação
                personalizada frente a carteira recomendada demandam. Os aportes simulados consideram a soma das
                necessidades por Reserva de Emergência, Projetos e Independência Financeira, conforme levantados em
                planejamento.
              </p>
              <p style={{ color: C.body, fontSize: 13, lineHeight: 1.75, marginTop: 14 }}>
                Os valores simulados não constituem garantia de rentabilidade futura: representam o comportamento
                esperado do plano sob as premissas vigentes na data de emissão. Revisões de perfil, mudanças de
                estratégia ou novos objetivos alteram os resultados — e devem ser refletidos em uma nova simulação.
              </p>
              <div style={{ marginTop: 'auto', paddingBottom: 8 }}>
                <p style={{ color: C.faint, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Carteira Recomendada utilizada</p>
                <a href="https://finclass.com" target="_blank" rel="noreferrer" data-pdf-href="https://finclass.com" className="inline-block">
                  <span style={{ fontFamily: FONT_DISPLAY, color: C.cream, fontSize: 30, fontWeight: 700, letterSpacing: '-0.01em' }}>
                    Finclass<span style={{ color: C.accent }}>.</span>
                  </span>
                </a>
              </div>
            </div>
          }
        />
        {rodape(1)}
      </Pagina>

      {/* ═══ 02 — RESUMO EXECUTIVO + GRÁFICOS ═══ */}
      <Pagina>
        <DuasColunas
          esquerda={
            <>
              <TituloColuna>Resumo Executivo</TituloColuna>
              {linhaResumo('Perfil do investidor', dados.perfilNome)}
              {linhaResumo('Tese', dados.teseNome)}
              {linhaResumo('Faixa', dados.faixaNome)}
              {linhaResumo('Aporte no mês', formatarMoeda(dados.aporte))}
              {linhaResumo('Saldo de vendas', formatarMoeda(dados.totalVendas))}
              {linhaResumo('Recurso disponível', formatarMoeda(dados.recursoDisponivel), true)}

              <div style={{ backgroundColor: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 14, padding: '16px 20px', marginTop: 22 }}>
                <p style={{ color: C.faint, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Distribuição dos recursos</p>
                {[
                  { rotulo: 'Reserva de emergência', valor: dados.distribuicao.reserva },
                  { rotulo: 'Projetos e objetivos', valor: dados.distribuicao.projetos },
                  { rotulo: 'Independência financeira', valor: dados.distribuicao.independencia },
                ].map((d, i) => (
                  <div key={i} className="flex justify-between" style={{ padding: '5px 0' }}>
                    <span style={{ color: C.body, fontSize: 12.5, fontWeight: 600 }}>{d.rotulo}</span>
                    <span style={{ color: C.cream, fontSize: 12.5, fontWeight: 700 }}>{formatarMoeda(d.valor)}</span>
                  </div>
                ))}
              </div>

              <p style={{ color: C.body, fontSize: 12, lineHeight: 1.7, marginTop: 20 }}>
                {dados.aporteMetaMensal !== null ? (
                  dados.aporte >= dados.aporteMetaMensal
                    ? <>Neste mês, o aporte está <span style={{ color: C.accent, fontWeight: 700 }}>{formatarMoeda(dados.aporte - dados.aporteMetaMensal)} acima</span> da meta de {formatarMoeda(dados.aporteMetaMensal)}/mês. </>
                    : <>Neste mês, o aporte está <span style={{ color: C.danger, fontWeight: 700 }}>{formatarMoeda(dados.aporteMetaMensal - dados.aporte)} abaixo</span> da meta de {formatarMoeda(dados.aporteMetaMensal)}/mês. </>
                ) : null}
                {delta !== null && Math.abs(delta) >= 1 ? (
                  delta < 0
                    ? <>No ritmo de carteira desta simulação, o plano de independência pode ser <span style={{ color: C.accent, fontWeight: 700 }}>antecipado em {formatarAnosMeses(Math.abs(delta))}</span>.</>
                    : <>No ritmo de carteira desta simulação, o plano de independência tende a <span style={{ color: C.danger, fontWeight: 700 }}>atrasar {formatarAnosMeses(delta)}</span>.</>
                ) : delta !== null ? <>No ritmo de carteira desta simulação, o plano de independência segue dentro do prazo planejado.</> : null}
              </p>
              {dados.patrimonioSucessao !== null && (
                <p style={{ color: C.body, fontSize: 12, lineHeight: 1.7, marginTop: 10 }}>
                  {dados.liberdadeFinanceira
                    ? <>No ritmo atual, a projeção aponta <span style={{ color: C.warning, fontWeight: 700 }}>Liberdade Financeira</span>: aos 100 anos, o patrimônio estimado para sucessão é de <span style={{ color: C.warning, fontWeight: 700 }}>{formatarMoeda(dados.patrimonioSucessao)}</span>.</>
                    : <>No ritmo atual, a projeção aponta <span style={{ color: C.cream, fontWeight: 700 }}>Independência Financeira</span>: o patrimônio sustenta a renda-alvo, sem sobra relevante projetada para sucessão aos 100 anos.</>}
                </p>
              )}
            </>
          }
          direita={
            <>
              <TituloColuna>Alocação e Independência</TituloColuna>
              <p style={{ color: C.faint, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 14 }}>Alocação · alvo vs carteira</p>
              <div>
                {dados.barData.map((d, i) => (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div className="flex justify-between" style={{ marginBottom: 9 }}>
                      <span style={{ color: C.cream, fontSize: 11, fontWeight: 600 }}>{d.classe}</span>
                      <span style={{ color: C.faint, fontSize: 10.5 }}>Alvo {d.alvo.toFixed(1)}% · Carteira {d.atual.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, backgroundColor: '#262a26', overflow: 'hidden', marginBottom: 3 }}>
                      <div style={{ height: '100%', width: `${Math.min(d.alvo, 100)}%`, backgroundColor: C.accent, opacity: 0.35, borderRadius: 99 }} />
                    </div>
                    <div style={{ height: 6, borderRadius: 99, backgroundColor: '#262a26', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(d.atual, 100)}%`, backgroundColor: C.accent, borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>

              <p style={{ color: C.faint, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', margin: '22px 0 10px' }}>Curva da independência</p>
              <ComposedChart width={415} height={195} data={dados.curva} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
                <XAxis dataKey="label" tick={{ fill: C.faint, fontSize: 8 }} tickLine={false} axisLine={{ stroke: '#2a2e2a' }} interval="preserveStartEnd" minTickGap={60} />
                <YAxis tick={{ fill: C.faint, fontSize: 8 }} tickLine={false} axisLine={false} width={44}
                  tickFormatter={(v: number) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${Math.round(v / 1000)}k`)} />
                <ReferenceLine y={dados.curva[0]?.target || 0} stroke={C.cream} strokeOpacity={0.55} strokeDasharray="4 4" ifOverflow="extendDomain" />
                <Line type="monotone" dataKey="plano" stroke={C.warning} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="real" stroke={C.accent} strokeWidth={2.2} dot={false} connectNulls isAnimationActive={false} />
                {dados.liberdadeFinanceira && (
                  <Area type="monotone" dataKey="liberdade" stroke={C.liberdade} strokeWidth={1.8} strokeDasharray="4 3" fill={C.liberdade} fillOpacity={0.14} dot={false} connectNulls isAnimationActive={false} />
                )}
              </ComposedChart>
              <div className="flex gap-4" style={{ marginTop: 8 }}>
                <span className="flex items-center gap-1.5" style={{ color: C.faint, fontSize: 9.5 }}><span style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: C.warning, display: 'inline-block' }} /> Plano</span>
                <span className="flex items-center gap-1.5" style={{ color: C.faint, fontSize: 9.5 }}><span style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: C.accent, display: 'inline-block' }} /> Trajetória real</span>
                <span className="flex items-center gap-1.5" style={{ color: C.faint, fontSize: 9.5 }}><span style={{ width: 8, height: 2, backgroundColor: C.cream, opacity: 0.55, display: 'inline-block' }} /> Capital de liberdade</span>
                {dados.liberdadeFinanceira && (
                  <span className="flex items-center gap-1.5" style={{ color: C.faint, fontSize: 9.5 }}><span style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: C.liberdade, display: 'inline-block' }} /> Patrimônio de liberdade</span>
                )}
              </div>
            </>
          }
        />
        {rodape(2)}
      </Pagina>

      {/* ═══ 03 — RESERVA/PROJETOS + VENDAS OU DISTRIBUIÇÃO ═══ */}
      <Pagina>
        <DuasColunas
          esquerda={
            <>
              <TituloColuna>Reserva e Projetos</TituloColuna>
              <LabelVerde>Reserva de emergência</LabelVerde>
              <div style={{ marginTop: 14 }}>
                {secaoMeta('Atingimento do alvo', dados.reserva.alvo, dados.reserva.acumulado)}
                {listaAportarEm(dados.reserva.aportarEm)}
              </div>

              <div style={{ marginTop: 30 }}>
                <LabelVerde>Projetos e objetivos</LabelVerde>
                <div style={{ marginTop: 14 }}>
                  {dados.projetos.length === 0 && <p style={{ color: C.faint, fontSize: 11 }}>Nenhum projeto com meta cadastrada.</p>}
                  {dados.projetos.map((p, i) => <React.Fragment key={i}>{secaoMeta(p.nome, p.alvo, p.acumulado)}</React.Fragment>)}
                  {listaAportarEm(dados.projetosAportarEm)}
                </div>
              </div>
            </>
          }
          direita={
            temVendas ? (
              <>
                <TituloColuna>Vendas e Desinvestimentos</TituloColuna>
                <div style={{ backgroundColor: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 14, overflow: 'hidden' }}>
                  {dados.vendas.map((v, i) => (
                    <div key={i} className="flex justify-between items-center" style={{ padding: '12px 18px', borderTop: i > 0 ? `1px solid ${C.panelBorder}` : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                        {/* Sem overflow:hidden/ellipsis (ver nota em cardOrdens): evita o corte
                            vertical de glifos pelo html2canvas — o nome quebra em duas linhas. */}
                        <p style={{ color: C.cream, fontSize: 12, fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word' }}>{v.nome}</p>
                        <p style={{ color: C.faint, fontSize: 10, lineHeight: 1.5, marginTop: 2 }}>{v.codigo || '—'} · destino: {v.destino}</p>
                      </div>
                      <span style={{ color: C.danger, fontSize: 12.5, fontWeight: 700 }} className="shrink-0">{formatarMoeda(v.valor)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between" style={{ marginTop: 14, padding: '0 4px' }}>
                  <span style={{ color: C.faint, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total das vendas</span>
                  <span style={{ color: C.cream, fontSize: 13, fontWeight: 700 }}>{formatarMoeda(dados.totalVendas)}</span>
                </div>
              </>
            ) : (
              <>
                <TituloColuna>Distribuição por Classe</TituloColuna>
                {dados.ordens.length > 0 ? cardOrdens(dados.ordens[0]) : <p style={{ color: C.faint, fontSize: 11 }}>Sem ordens de compra nesta simulação.</p>}
              </>
            )
          }
        />
        {rodape(3)}
      </Pagina>

      {/* ═══ 04.. — DISTRIBUIÇÃO DE ATIVOS POR CLASSE ═══ */}
      {paginasOrdens.map((dupla, pIdx) => (
        <Pagina key={pIdx}>
          <div className="flex" style={{ padding: '72px 64px 0', gap: 40 }}>
            <div className="w-1/2 space-y-6">{dupla[0] && cardOrdens(dupla[0])}</div>
            <div className="w-1/2 space-y-6">{dupla[1] && cardOrdens(dupla[1])}</div>
          </div>
          {rodape(4 + pIdx)}
        </Pagina>
      ))}

      {/* ═══ ATENÇÃO FISCAL — POSSÍVEL DARF (só quando há venda sujeita) ═══ */}
      {temAtencaoFiscal && (
        <Pagina>
          <div style={{ padding: '64px 64px 0' }}>
            <TituloColuna>Atenção Fiscal — Possível DARF</TituloColuna>
            <p style={{ color: C.body, fontSize: 12.5, lineHeight: 1.75, maxWidth: 800, marginBottom: 26 }}>
              As vendas abaixo pertencem a classes de ativo sem isenção mensal de Imposto de Renda, ou
              ultrapassaram o limite de isenção considerando apenas as vendas desta operação. Havendo
              ganho de capital, o recolhimento é feito por DARF até o último dia útil do mês seguinte à
              venda. Esta é uma sinalização informativa com base na classificação do ativo — a apuração
              definitiva (ganho efetivo, base de cálculo e demais vendas do mês fora desta simulação)
              deve ser confirmada com o contador ou a corretora responsável.
            </p>
            <div style={{ backgroundColor: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 14, overflow: 'hidden', maxWidth: 800 }}>
              {atencaoFiscal.map((v, i) => (
                <div key={i} style={{ padding: '14px 20px', borderTop: i > 0 ? `1px solid ${C.panelBorder}` : 'none' }}>
                  <div className="flex justify-between items-baseline" style={{ gap: 12 }}>
                    <p style={{ color: C.cream, fontSize: 13, fontWeight: 700, lineHeight: 1.5, wordBreak: 'break-word' }}>
                      {v.nome}{v.codigo ? ` · ${v.codigo}` : ''}
                    </p>
                    <span style={{ color: C.warning, fontSize: 13, fontWeight: 700 }} className="shrink-0">{formatarMoeda(v.valor)}</span>
                  </div>
                  <p style={{ color: C.faint, fontSize: 10.5, lineHeight: 1.5, marginTop: 5 }}>{v.motivo}</p>
                </div>
              ))}
            </div>
          </div>
          {rodape(numPagAtencaoFiscal)}
        </Pagina>
      )}

      {/* ═══ CONTRACAPA (verde, QR codes clicáveis) ═══ */}
      <Pagina bg={C.backCover}>
        <div className="flex flex-col items-center justify-center h-full" style={{ padding: '0 120px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: FONT_DISPLAY, color: C.cream, fontSize: 36, fontWeight: 700, lineHeight: 1.2, maxWidth: 640 }}>
            Um bom aporte muda o mês. A estratégia certa muda o plano.
          </h2>
          <p style={{ color: '#d5e4dd', fontSize: 15, lineHeight: 1.7, maxWidth: 560, marginTop: 18 }}>
            Conhece alguém que precise de um direcionamento assim? Compartilhe o meu contato.
          </p>
          <div className="flex" style={{ gap: 72, marginTop: 44 }}>
            {[
              { qr: qrWhats, url: dados.whatsappUrl, icone: <IconeWhatsApp />, rotulo: 'Fale no WhatsApp' },
              { qr: qrInsta, url: dados.instagramUrl, icone: <IconeInstagram />, rotulo: 'Siga no Instagram' },
            ].map((item, i) => (
              <a key={i} href={item.url} target="_blank" rel="noreferrer" data-pdf-href={item.url} className="flex flex-col items-center no-underline">
                <div className="relative" style={{ backgroundColor: '#ffffff', borderRadius: 26, padding: 16 }}>
                  {item.qr ? <img src={item.qr} alt="" style={{ width: 176, height: 176, display: 'block' }} /> : <div style={{ width: 176, height: 176 }} />}
                  <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>{item.icone}</div>
                </div>
                <span style={{ color: C.cream, fontSize: 14, fontWeight: 700, marginTop: 16 }}>{item.rotulo}</span>
              </a>
            ))}
          </div>
        </div>
      </Pagina>
    </div>
  );
};

export default RelatorioAporteDoc;
