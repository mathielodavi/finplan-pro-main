/**
 * Tema fixo: dark-only.
 * Mantido como stub para compatibilidade de import; não há alternância de tema.
 */
export const useTheme = () => {
  return { theme: 'dark' as const, toggleTheme: () => {} };
};
