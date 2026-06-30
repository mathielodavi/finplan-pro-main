export type DestinoVenda = 'reserva' | 'projetos' | 'independencia' | 'livre';

export interface DestinoVendaOption {
  key: DestinoVenda;
  label: string;
  color: string;
}

/**
 * Opções de destino para o produto de uma venda — usado na Carteira Ativa (flag persistente) e no
 * wizard de Aporte Mensal. Cores em rgba/tokens (não tons pastéis -50/-100 do Tailwind) para não
 * virarem manchas claras sobre o fundo escuro.
 */
export const DESTINOS_VENDA: DestinoVendaOption[] = [
  { key: 'reserva', label: 'Reserva', color: 'bg-[rgba(96,165,250,0.14)] text-[color:var(--info)] border-[rgba(96,165,250,0.32)]' },
  { key: 'projetos', label: 'Projetos', color: 'bg-[rgba(167,139,250,0.14)] text-[#c4b5fd] border-[rgba(167,139,250,0.32)]' },
  { key: 'independencia', label: 'Indep.', color: 'bg-[rgba(16,185,129,0.14)] text-[color:var(--primary)] border-[rgba(16,185,129,0.32)]' },
  { key: 'livre', label: 'Livre', color: 'bg-surface-2 text-muted border-subtle' },
];
