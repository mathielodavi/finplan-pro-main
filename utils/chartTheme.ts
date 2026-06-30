/**
 * Tema de gráficos (Recharts) — dark-only.
 * Centraliza paleta, eixos, grid e tooltip para manter os gráficos coerentes
 * com os tokens do DESIGN.MD. Evita hex fixos espalhados pelas views.
 */

/** Paleta categórica (séries de dados) — acento da marca primeiro. */
export const CHART_PALETTE = [
  '#10b981', // primary (verde marca)
  '#60a5fa', // info
  '#fbbf24', // warning
  '#f87171', // danger
  '#a78bfa', // roxo
  '#34d399', // verde claro
  '#94a3b8', // neutro
];

/** Cores semânticas para séries específicas. */
export const CHART_COLORS = {
  primary: '#10b981',
  success: '#34d399',
  info: '#60a5fa',
  warning: '#fbbf24',
  danger: '#f87171',
  purple: '#a78bfa',
  neutral: '#64748b',
  line: '#e7e9ef',
};

/** Termômetro de engajamento (verde → amarelo → vermelho → cinza). */
export const CHART_TERMOMETRO = ['#34d399', '#fbbf24', '#f87171', '#64748b'];

/** Cor das linhas de grade (quase invisível). */
export const CHART_GRID = '#262b3a';

/** Estilo padrão dos ticks de eixo. */
export const axisTick = { fill: '#9ba1b0', fontSize: 11, fontWeight: 500 } as const;

/** Estilo do container do tooltip do Recharts. */
export const tooltipStyle = {
  backgroundColor: '#1c2030',
  border: '1px solid #353b4f',
  borderRadius: '12px',
  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  fontSize: '12px',
  fontWeight: 600,
  color: '#e7e9ef',
} as const;

/** Estilo do label do tooltip. */
export const tooltipLabelStyle = { color: '#9ba1b0', fontWeight: 600 } as const;

/** Realce do cursor ao passar o mouse sobre barras/áreas (substitui o cinza/branco padrão do Recharts). */
export const tooltipCursor = { fill: 'rgba(255,255,255,0.04)' } as const;
