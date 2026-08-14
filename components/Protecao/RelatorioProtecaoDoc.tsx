import React from 'react';
import { ClienteSeguro, DependenteSeguro, ParametrosCalculo, SeguroVida } from '../../services/protecaoService';

/**
 * Relatório de Proteção (Levantamento de Necessidade de Proteção) no mesmo padrão editorial
 * "DNA Financeiro" do Relatório de Alocação (Simulador Tático): páginas A4 paisagem, fundo
 * escuro neutro, headline serifada creme, acento verde-menta e páginas de duas colunas.
 * Cada página é marcada com `data-pdf-page` (uma página = uma folha) e capturada por
 * `baixarPaginasComoPDF` (utils/pdfFromElement.ts). Cores em hex fixo — html2canvas não entende
 * oklch e o documento tem paleta própria, não a do app.
 *
 * Capa tipográfica (sem foto). Seções sem dados cadastrais (ex.: dependentes) não são exibidas —
 * as páginas de conteúdo são montadas dinamicamente a partir dos blocos presentes. Sem contracapa
 * de marketing: encerra nas coberturas, pois é gerado para cotação com corretor.
 */

const fmtMoeda = (v: number) => `R$ ${Math.round(v || 0).toLocaleString('pt-BR')}`;
const fmtData = (d?: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

// ─── Paleta editorial (referência DNA Financeiro, espelha o Relatório de Alocação) ────────────
const C = {
  bg: '#131512',
  panel: '#1b1e1b',
  panelBorder: '#272b27',
  cream: '#f1eee7',
  body: '#b9bdb7',
  faint: '#878d86',
  accent: '#3ad6a0',
  greenCard: '#11493576',
  greenCardBorder: '#1d6b4e',
};

const FONT_DISPLAY = "'Archivo Variable', Archivo, sans-serif";
const FONT_SANS = "'Instrument Sans Variable', 'Instrument Sans', sans-serif";
const GOOGLE_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400..900&family=Instrument+Sans:wght@400..700&display=swap';

const PAGE_W = 1050;
const PAGE_H = 742; // proporção A4 paisagem (297×210)

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

const Rodape: React.FC<{ num: string; cliente: string }> = ({ num, cliente }) => (
  <div className="absolute bottom-0 left-0 right-0 flex justify-between items-center" style={{ padding: '0 64px 30px' }}>
    <span style={{ color: C.faint, fontSize: 9, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' }}>
      Levantamento de Proteção · {cliente.length > 34 ? cliente.slice(0, 33).trimEnd() + '…' : cliente}
    </span>
    <span style={{ color: C.faint, fontSize: 10, fontWeight: 700 }}>{num}</span>
  </div>
);

/** Página de duas colunas com divisor vertical central sutil (padrão da referência). */
const DuasColunas: React.FC<{ esquerda: React.ReactNode; direita: React.ReactNode }> = ({ esquerda, direita }) => (
  <div className="flex h-full">
    <div className="w-1/2 h-full overflow-hidden" style={{ padding: '52px 40px 64px 64px' }}>{esquerda}</div>
    <div className="w-px h-full" style={{ backgroundColor: '#232723' }} />
    <div className="w-1/2 h-full overflow-hidden" style={{ padding: '52px 64px 64px 40px' }}>{direita}</div>
  </div>
);

const TituloColuna: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ fontFamily: FONT_DISPLAY, color: C.cream, fontSize: 26, fontWeight: 700, lineHeight: 1.3, letterSpacing: '-0.01em', marginBottom: 20 }}>{children}</h2>
);

const LabelVerde: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <p style={{ color: C.accent, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', ...style }}>{children}</p>
);

/** Linha rótulo → valor compacta (densa), com divisor inferior sutil. */
const LinhaKV: React.FC<{ rotulo: string; valor: string }> = ({ rotulo, valor }) => (
  <div className="flex justify-between items-center" style={{ padding: '5.5px 0', borderBottom: `1px solid ${C.panelBorder}`, gap: 16 }}>
    <span style={{ color: C.faint, fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{rotulo}</span>
    <span style={{ color: C.cream, fontSize: 12, fontWeight: 700, textAlign: 'right', wordBreak: 'break-word' }}>{valor || '—'}</span>
  </div>
);

/** Bloco segmentado: sub-rótulo verde + lista de linhas KV. */
const BlocoKV: React.FC<{ titulo: string; campos: [string, string][]; style?: React.CSSProperties }> = ({ titulo, campos, style }) => (
  <div style={style}>
    <LabelVerde style={{ marginBottom: 8 }}>{titulo}</LabelVerde>
    <div>{campos.map(([r, v]) => <LinhaKV key={r} rotulo={r} valor={v} />)}</div>
  </div>
);

interface TabelaProps {
  cabecalho: string[];
  linhas: string[][];
  total?: { rotulo: string; valor: string };
  compacta?: boolean;
}

/** Tabela no estilo editorial: painel escuro, cabeçalho discreto, células centradas na vertical. */
const TabelaEditorial: React.FC<TabelaProps> = ({ cabecalho, linhas, total, compacta }) => {
  const fs = compacta ? 9.5 : 11;
  const pad = compacta ? '9px 12px' : '11px 16px';
  return (
    <div style={{ backgroundColor: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 12, overflow: 'hidden' }}>
      <div className="flex items-center" style={{ padding: pad, borderBottom: `1px solid ${C.panelBorder}` }}>
        {cabecalho.map((c, i) => (
          <span key={i} style={{
            flex: i === 0 ? 1.6 : 1, minWidth: 0, color: C.faint, fontSize: fs - 1, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: i === 0 ? 'left' : 'right',
          }}>{c}</span>
        ))}
      </div>
      {linhas.map((linha, li) => (
        <div key={li} className="flex items-center" style={{ padding: pad, borderTop: li > 0 ? `1px solid ${C.panelBorder}` : 'none' }}>
          {linha.map((cel, ci) => (
            <span key={ci} style={{
              flex: ci === 0 ? 1.6 : 1, minWidth: 0, fontSize: fs, lineHeight: 1.35,
              color: ci === 0 ? C.body : C.cream, fontWeight: ci === 0 ? 600 : 700,
              textAlign: ci === 0 ? 'left' : 'right', wordBreak: 'break-word', paddingRight: ci === 0 ? 8 : 0,
            }}>{cel}</span>
          ))}
        </div>
      ))}
      {total && (
        <div className="flex justify-between items-center" style={{ padding: pad, borderTop: `1px solid ${C.greenCardBorder}`, backgroundColor: C.greenCard }}>
          <span style={{ color: C.cream, fontSize: fs, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{total.rotulo}</span>
          <span style={{ color: C.accent, fontSize: fs + 2, fontWeight: 700 }}>{total.valor}</span>
        </div>
      )}
    </div>
  );
};

interface Props {
  dados: ClienteSeguro;
  dependentes: DependenteSeguro[];
  parametros: ParametrosCalculo;
  nomeCliente?: string;
  planejadorNome: string;
  planejadorEmail: string;
  segurosData: SeguroVida[];
  coberturaVida: { coberturaCliente: number; coberturaConjuge: number; coberturaFamiliar: number };
  sucessao: { coberturaSucessao: number; totalFuneral: number; custoInventario: number };
  previdencia: { pgbl: number; vgbl: number };
  totalEducacao: number;
  totalGeral: number;
}

const RelatorioProtecaoDoc = React.forwardRef<HTMLDivElement, Props>(({
  dados, dependentes, parametros, nomeCliente, planejadorNome, planejadorEmail,
  segurosData, coberturaVida, sucessao, previdencia, totalEducacao, totalGeral,
}, ref) => {
  const nomeCliente_ = dados.nome_cliente || nomeCliente || 'Cliente';
  const nomeConjuge = dados.nome_conjuge || 'Cônjuge';
  const temConjuge = !!dados.casado_cliente && !!dados.nome_conjuge;
  const depsValidos = dependentes.filter(d => d.nome_dependente?.trim());
  const temDeps = depsValidos.length > 0;
  const temSeguros = segurosData.length > 0;
  const percEfetivo = (dados.honorarios_perc !== undefined && dados.itcmd_perc !== undefined)
    ? dados.honorarios_perc + dados.itcmd_perc
    : parametros.perc_custos_inventario;
  const contratadoSucessao = segurosData.reduce((acc, s) => acc + (s.cobertura_morte || 0) + (s.cobertura_funeral || 0), 0);

  const dataStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const rodape = (num: number) => <Rodape num={String(num).padStart(2, '0')} cliente={nomeCliente_} />;

  // ─── Campos por segmento ──────────────────────────────────────────────────────
  const identCliente: [string, string][] = [
    ['Nascimento', fmtData(dados.data_nascimento_cliente)],
    ['CPF', dados.cpf_cliente || '—'],
    ['Estado civil', dados.casado_cliente ? 'Casado(a)' : 'Solteiro(a)'],
    ['E-mail', dados.email_cliente || '—'],
    ['Telefone', dados.telefone_cliente || '—'],
    ['Estado', dados.estado_cliente || '—'],
    ['Profissão', dados.profissao_cliente || '—'],
    ['Regime', dados.regime_contratacao_cliente || '—'],
  ];
  const saudeCliente: [string, string][] = [
    ['Fumante', dados.fumante_cliente ? 'Sim' : 'Não'],
    ['Peso / Altura', `${dados.peso_cliente || '—'} kg · ${dados.altura_cliente || '—'} cm`],
    ['Esporte / hobby', dados.esporte_hobby_cliente || '—'],
    ['Medicamento contínuo', dados.medicamento_continuo_cliente || '—'],
    ['Doença crônica', dados.doenca_cronica_cliente || '—'],
    ['Cirurgia complexa', dados.cirurgia_complexa_cliente || '—'],
  ];
  const identConjuge: [string, string][] = [
    ['Nascimento', fmtData(dados.data_nascimento_conjuge)],
    ['CPF', dados.cpf_conjuge || '—'],
    ['E-mail', dados.email_conjuge || '—'],
    ['Telefone', dados.telefone_conjuge || '—'],
    ['Profissão', dados.profissao_conjuge || '—'],
    ['Regime', dados.regime_contratacao_conjuge || '—'],
  ];
  const saudeConjuge: [string, string][] = [
    ['Fumante', dados.fuma_conjuge ? 'Sim' : 'Não'],
    ['Peso / Altura', `${dados.peso_conjuge || '—'} kg · ${dados.altura_conjuge || '—'} cm`],
    ['Esporte / hobby', dados.esporte_hobby_conjuge || '—'],
    ['Medicamento contínuo', dados.medicamento_continuo_conjuge || '—'],
    ['Doença crônica', dados.doenca_cronica_conjuge || '—'],
    ['Cirurgia complexa', dados.cirurgia_complexa_conjuge || '—'],
  ];

  const colItem = temConjuge ? ['Item', nomeCliente_, nomeConjuge, 'Família'] : ['Item', nomeCliente_];
  const proj = (linha: string[]) => temConjuge ? linha : [linha[0], linha[1]];

  const linhasPadrao = [
    ['Renda mensal', fmtMoeda(dados.renda_cliente || 0), fmtMoeda(dados.renda_conjuge || 0), fmtMoeda((dados.renda_cliente || 0) + (dados.renda_conjuge || 0))],
    ['Declaração IR', dados.declaracao_ir_cliente || '—', dados.declaracao_ir_conjuge || '—', '—'],
    ['Período cobertura', `${dados.periodo_cobertura_anos || 10} anos`, '—', '—'],
    ['Taxa real anual', `${dados.taxa_real_anual ?? 4}%`, '—', '—'],
    ['Desp. obrigatórias', fmtMoeda(dados.despesas_obrigatorias || 0), '—', '—'],
    ['Desp. não obrig.', fmtMoeda(dados.despesas_nao_obrigatorias || 0), '—', '—'],
    ['Financiamentos', fmtMoeda(dados.financiamentos || 0), '—', '—'],
    ['Dívidas mensais', fmtMoeda(dados.dividas_mensais || 0), '—', '—'],
    ['Projetos financeiros', fmtMoeda(dados.projetos_financeiros || 0), '—', '—'],
  ].map(proj);

  const linhasSucessao = [
    ['Funeral / luto', fmtMoeda(dados.funeral_cliente || 0), fmtMoeda(dados.funeral_conjuge || 0), fmtMoeda(sucessao.totalFuneral)],
    [`Bens (inv. ${percEfetivo.toFixed(1)}%)`, fmtMoeda(dados.bens_cliente || 0), fmtMoeda(dados.bens_conjuge || 0), fmtMoeda(sucessao.custoInventario)],
    ['Investimentos líq.', fmtMoeda(dados.investimentos_cliente || 0), fmtMoeda(dados.investimentos_conjuge || 0), fmtMoeda((dados.investimentos_cliente || 0) + (dados.investimentos_conjuge || 0))],
    ['Dívidas', fmtMoeda(dados.dividas_cliente || 0), fmtMoeda(dados.dividas_conjuge || 0), fmtMoeda((dados.dividas_cliente || 0) + (dados.dividas_conjuge || 0))],
    ['Previd. PGBL', '—', '—', fmtMoeda(previdencia.pgbl)],
    ['Previd. VGBL', '—', '—', fmtMoeda(previdencia.vgbl)],
    ['Honorários', `${dados.honorarios_perc || 0}%`, '—', '—'],
    ['ITCMD', `${dados.itcmd_perc || 0}%`, '—', '—'],
  ].map(proj);

  const linhasCoberturas = [
    ['Educação e dependentes', 'Família', totalEducacao > 0 ? fmtMoeda(totalEducacao) : 'N/A'],
    ['Padrão de vida', nomeCliente_, coberturaVida.coberturaCliente > 0 ? fmtMoeda(coberturaVida.coberturaCliente) : 'N/A'],
    ...(temConjuge ? [['Padrão de vida', nomeConjuge, coberturaVida.coberturaConjuge > 0 ? fmtMoeda(coberturaVida.coberturaConjuge) : 'N/A']] : []),
    ['Sucessão patrimonial', 'Herdeiros', sucessao.coberturaSucessao > 0 ? fmtMoeda(sucessao.coberturaSucessao) : 'N/A'],
  ];

  // ─── Blocos de conteúdo (montados dinamicamente; seções sem dados são omitidas) ───────────────
  const blocos: { titulo: string; node: React.ReactNode }[] = [
    {
      titulo: 'Padrão de vida e renda',
      node: <TabelaEditorial cabecalho={colItem} linhas={linhasPadrao} compacta={temConjuge} />,
    },
    {
      titulo: 'Sucessão patrimonial',
      node: <TabelaEditorial cabecalho={colItem} linhas={linhasSucessao} compacta={temConjuge} />,
    },
    ...(temDeps ? [{
      titulo: 'Dependentes',
      node: (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {depsValidos.map((d, i) => (
            <div key={i} style={{ backgroundColor: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 12, padding: '11px 16px' }}>
              <div className="flex justify-between items-baseline" style={{ marginBottom: 5 }}>
                <span style={{ color: C.cream, fontSize: 12.5, fontWeight: 700 }}>{d.nome_dependente || '—'}</span>
                <span style={{ color: C.accent, fontSize: 12.5, fontWeight: 700 }}>{fmtMoeda(d.total_calculado || 0)}</span>
              </div>
              <div className="flex justify-between" style={{ color: C.faint, fontSize: 10.5 }}>
                <span>{d.parentesco || '—'} · nasc. {fmtData(d.data_nascimento_dep)} · {d.cobertura_anos || 0} anos</span>
                <span>auxílio {fmtMoeda(d.auxilio_mensal || 0)}/mês</span>
              </div>
            </div>
          ))}
        </div>
      ),
    }] : []),
    {
      titulo: 'Coberturas recomendadas',
      node: (
        <>
          <TabelaEditorial
            cabecalho={['Cobertura', 'Beneficiário', 'Valor']}
            linhas={linhasCoberturas}
            total={{ rotulo: 'Total recomendado', valor: fmtMoeda(totalGeral) }}
          />
          <p style={{ color: C.faint, fontSize: 11, lineHeight: 1.7, marginTop: 16 }}>
            Valores de referência para cotação. A soma reúne educação e dependentes, manutenção do
            padrão de vida e a cobertura de sucessão patrimonial estimada.
          </p>
        </>
      ),
    },
  ];

  // Paginação: capa (s/nº) · 01 sumário · 02 titulares · 03.. conteúdo (2 blocos/página) · seguros.
  const paginasConteudo: typeof blocos[] = [];
  for (let i = 0; i < blocos.length; i += 2) paginasConteudo.push(blocos.slice(i, i + 2));
  const paginaSeguros = temSeguros ? 3 + paginasConteudo.length : null;

  const renderColuna = (b: { titulo: string; node: React.ReactNode }) => (
    <><TituloColuna>{b.titulo}</TituloColuna>{b.node}</>
  );

  const sumario = [
    { titulo: 'Perfil e Saúde', pagina: '02' },
    ...blocos.map((b, i) => ({ titulo: b.titulo, pagina: String(3 + Math.floor(i / 2)).padStart(2, '0') })),
    ...(paginaSeguros ? [{ titulo: 'Coberturas contratadas', pagina: String(paginaSeguros).padStart(2, '0') }] : []),
  ];

  return (
    <div ref={ref} className="flex flex-col items-center gap-6" style={{ fontFamily: FONT_SANS }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />

      {/* ═══ CAPA (tipográfica) ═══ */}
      <Pagina>
        <div className="flex flex-col h-full justify-center" style={{ padding: '0 96px' }}>
          <LabelVerde style={{ letterSpacing: '0.22em', fontSize: 11 }}>Levantamento de Necessidade de Proteção</LabelVerde>
          <h1 style={{ fontFamily: FONT_DISPLAY, color: C.cream, fontSize: 64, fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.02em', margin: '24px 0 26px', maxWidth: 840 }}>
            {nomeCliente_}
          </h1>
          <div style={{ width: 64, height: 3, backgroundColor: C.accent, marginBottom: 26 }} />
          <p style={{ color: C.body, fontSize: 15 }}>Emitido em {dataStr}</p>
          <p style={{ color: C.faint, fontSize: 13, marginTop: 8 }}>
            Planejador: {[planejadorNome, planejadorEmail].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      </Pagina>

      {/* ═══ 01 — SUMÁRIO + SOBRE ═══ */}
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
              <TituloColuna>Sobre este levantamento</TituloColuna>
              <p style={{ color: C.body, fontSize: 13, lineHeight: 1.75 }}>
                Este documento consolida a necessidade de proteção da família a partir dos dados de
                identificação, saúde, dependentes, padrão de vida e sucessão levantados em planejamento.
                Serve de base para a cotação com um corretor de seguros — não constitui venda, apólice
                ou indicação personalizada de produto.
              </p>
              <p style={{ color: C.body, fontSize: 13, lineHeight: 1.75, marginTop: 14 }}>
                Os valores recomendados são calculados sob as premissas vigentes na data de emissão
                (período de cobertura, taxa real e custos de inventário). Alterações de renda, patrimônio
                ou composição familiar mudam os resultados e devem ser refletidas em um novo levantamento.
                As condições finais de aceitação e prêmio dependem da análise da seguradora.
              </p>
              <div style={{ marginTop: 'auto', paddingBottom: 8 }}>
                <LabelVerde style={{ fontSize: 9.5, letterSpacing: '0.16em', marginBottom: 8 }}>Planejador responsável</LabelVerde>
                <p style={{ fontFamily: FONT_DISPLAY, color: C.cream, fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{planejadorNome || '—'}</p>
                {planejadorEmail && <p style={{ color: C.faint, fontSize: 12, marginTop: 4 }}>{planejadorEmail}</p>}
              </div>
            </div>
          }
        />
        {rodape(1)}
      </Pagina>

      {/* ═══ 02 — PERFIL E SAÚDE (titulares) ═══ */}
      <Pagina>
        <DuasColunas
          esquerda={
            <>
              <TituloColuna>{temConjuge ? nomeCliente_ : 'Identificação'}</TituloColuna>
              {temConjuge ? (
                <>
                  <BlocoKV titulo="Identificação" campos={identCliente} />
                  <BlocoKV titulo="Saúde & estilo de vida" campos={saudeCliente} style={{ marginTop: 22 }} />
                </>
              ) : (
                <div>{identCliente.map(([r, v]) => <LinhaKV key={r} rotulo={r} valor={v} />)}</div>
              )}
            </>
          }
          direita={
            temConjuge ? (
              <>
                <TituloColuna>{nomeConjuge}</TituloColuna>
                <BlocoKV titulo="Identificação" campos={identConjuge} />
                <BlocoKV titulo="Saúde & estilo de vida" campos={saudeConjuge} style={{ marginTop: 22 }} />
              </>
            ) : (
              <>
                <TituloColuna>Saúde & estilo de vida</TituloColuna>
                <div>{saudeCliente.map(([r, v]) => <LinhaKV key={r} rotulo={r} valor={v} />)}</div>
              </>
            )
          }
        />
        {rodape(2)}
      </Pagina>

      {/* ═══ 03.. — CONTEÚDO (2 blocos por página; blocos vazios já omitidos) ═══ */}
      {paginasConteudo.map((dupla, pIdx) => (
        <Pagina key={pIdx}>
          {dupla[1] ? (
            <DuasColunas esquerda={renderColuna(dupla[0])} direita={renderColuna(dupla[1])} />
          ) : (
            <div className="h-full" style={{ padding: '52px 64px 64px' }}>
              <div style={{ maxWidth: 640, margin: '0 auto' }}>{renderColuna(dupla[0])}</div>
            </div>
          )}
          {rodape(3 + pIdx)}
        </Pagina>
      ))}

      {/* ═══ COBERTURAS CONTRATADAS (só quando há apólices) ═══ */}
      {temSeguros && (
        <Pagina>
          <div className="h-full flex flex-col" style={{ padding: '52px 64px 64px' }}>
            <TituloColuna>Coberturas de seguro contratadas</TituloColuna>
            <TabelaEditorial
              compacta
              cabecalho={['Membro', 'Modalidade', 'Morte', 'Funeral', 'D. graves', 'Invalidez', 'Cirurgia', 'DIT', 'Mensalidade']}
              linhas={segurosData.map(s => [
                s.membro === 'cliente' ? nomeCliente_ : nomeConjuge,
                s.modalidade === 'grupo' ? 'Grupo' : 'Individual',
                fmtMoeda(s.cobertura_morte || 0),
                fmtMoeda(s.cobertura_funeral || 0),
                fmtMoeda(s.cobertura_doencas_graves || 0),
                fmtMoeda(s.cobertura_invalidez || 0),
                fmtMoeda(s.cobertura_cirurgia || 0),
                fmtMoeda(s.dit || 0),
                fmtMoeda(s.mensalidade || 0),
              ])}
            />
            <p style={{ color: C.faint, fontSize: 11, marginTop: 16 }}>
              Cobertura de sucessão já contratada (morte + funeral): <span style={{ color: C.cream, fontWeight: 700 }}>{fmtMoeda(contratadoSucessao)}</span>.
            </p>
          </div>
          {rodape(paginaSeguros!)}
        </Pagina>
      )}
    </div>
  );
});

RelatorioProtecaoDoc.displayName = 'RelatorioProtecaoDoc';

export default RelatorioProtecaoDoc;
