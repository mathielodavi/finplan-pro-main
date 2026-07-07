# DESIGN.MD — Tulipa / FinPlan Pro

Sistema de design **dark-only**, inspirado no estilo Avenue: profissional, sóbrio,
hierarquia tipográfica real e acento único (verde da marca). Evita a estética
"gerada por IA" (caixa-alta forçada, micro-textos, cards genéricos brancos).

A fonte da verdade dos tokens é [`index.css`](index.css) (`@theme` + CSS vars).
Sempre consumir tokens — nunca hex fixos nas telas.

## §1. Cores (tokens)

### Superfícies (camadas)
| Token | Hex | Uso |
|---|---|---|
| `--bg-base` / `bg-canvas` | `#0b0e14` | Fundo da aplicação |
| `--bg-surface` / `bg-surface` | `#151823` | Cards, painéis |
| `--bg-surface-2` / `bg-surface-2` | `#1c2030` | Inputs, hover, elevações |
| `--bg-surface-3` / `bg-surface-3` | `#242a3a` | Seleção, destaque sutil |

### Bordas
| Token | Hex | Uso |
|---|---|---|
| `--border` / `border-subtle` | `#262b3a` | Borda padrão |
| `--border-strong` / `border-strong` | `#353b4f` | Borda de maior contraste |

### Texto
| Token | Hex | Uso |
|---|---|---|
| `--text-main` / `text-main` | `#e7e9ef` | Texto principal |
| `--text-muted` / `text-muted` | `#9ba1b0` | Texto secundário |
| `--text-faint` / `text-faint` | `#6b7280` | Micro-labels, terciário |

### Marca e status
- Primária: `--primary` `#10b981` · hover `#34d399` · soft `rgba(16,185,129,.12)`.
- Status (dessaturados p/ dark): success `#34d399` · warning `#fbbf24` · danger `#f87171` · info `#60a5fa`.
- **Acento único**: usar o verde só em ações primárias e estados ativos. Não colorir tudo.

## §2. Tipografia
- Fonte: Inter.
- Corpo: 13–14px. Títulos de seção: 14–16px, peso 600. H1 de página: 18–20px.
- **Evitar** `uppercase` + `tracking-widest` + `font-black` como padrão. Caixa-alta só
  em micro-labels pontuais (≤ 1 por bloco), 11px, `text-faint`.
- Não usar fontes < 11px para conteúdo legível.

## §3. Espaçamento
Base 4/8px: `--xs 4 · --sm 8 · --md 16 · --lg 24 · --xl 32 · --xxl 48`.
Densidade calma: agrupar por seção com título, não por cartão isolado.

## §4. Raio
`--radius-sm 6` (inputs) · `--radius-md 8` (botões/badges) · `--radius-lg 12` (cards) ·
`--radius-xl 16` (cards grandes). Badges: pílula (9999px).

## §5. Elevação
Profundidade no dark vem de **borda + leve sombra**, não de sombras pesadas.
`--shadow-card 0 1px 2px rgba(0,0,0,.4)` · `--shadow-float 0 8px 24px rgba(0,0,0,.5)`.

## §6. Gráficos (Recharts)
Usar [`utils/chartTheme.ts`](utils/chartTheme.ts): `CHART_PALETTE`, `CHART_COLORS`,
`axisTick`, `tooltipStyle`, `CHART_GRID`. Grid quase invisível, poucas séries por gráfico.

## §7. Componentes
- **Botões**: altura 32–40px, raio 8px, peso 600. Primário = verde; outline/ghost com tokens.
- **Inputs**: altura 36px, fundo `surface-2`, borda `subtle`, foco com ring verde suave.
- **Cards**: `surface` + borda `subtle`, raio 12–16px, padding 16–24px.
- **Modais**: `surface`, borda `subtle`, backdrop `rgba(0,0,0,.6)`, X discreto.
- **Tabelas**: header `text-faint`, hover `surface-2`, divisórias `subtle`.

## §8. Navegação
- **Tabs**: underline limpo (2px) na cor primária; inativo `text-muted`.
- **Badge**: pílula, fundo 12% da cor semântica, texto na versão clara da cor.
- **Header**: breadcrumb + seletor global de cliente + ações contextuais por rota.
- **Padrão obrigatório para telas com múltiplas visões**: quando uma tela tem 2+ abas
  de conteúdo (ex.: Visão Geral → Atendimento/Contratos/Financeiro; Carteira →
  Carteira Recomendada/Consulta de Carteira), as abas são publicadas no **header**
  (`components/Layout/Navbar.tsx`) via `useProntuarioNav()`
  ([context/ProntuarioNavContext.tsx](context/ProntuarioNavContext.tsx)), **não**
  renderizadas inline no corpo da página com `components/UI/Tabs.tsx`. Padrão:
  ```tsx
  const { setNav } = useProntuarioNav();
  const [activeTab, setActiveTab] = useState('primeira-aba');
  useEffect(() => {
    setNav({ tabs: MEUS_TABS, activeTab, setActiveTab });
    return () => setNav(null); // limpa ao desmontar/trocar de rota
  }, [activeTab, setNav]);
  ```
  Referência de implementação: [views/Dashboard.tsx](views/Dashboard.tsx) e
  [views/CarteiraPage.tsx](views/CarteiraPage.tsx). `components/UI/Tabs.tsx` continua
  válido apenas para subdivisões *dentro* do conteúdo de uma aba (não para a navegação
  de topo entre visões de uma tela).

## §9. Padrão de migração (light → dark)
`bg-white`→`bg-surface` · `text-slate-900`→`text-main` · `text-slate-400/500`→`text-faint/muted`
· `border-slate-100/200`→`border-subtle` · `bg-slate-50`→`bg-surface-2` · hex inline → token.
