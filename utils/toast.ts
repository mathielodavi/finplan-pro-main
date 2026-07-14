export type ToastTipo = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  tipo: ToastTipo;
  mensagem: string;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

const emitir = () => listeners.forEach(l => l(toasts));

const DURACAO_MS: Record<ToastTipo, number> = {
  success: 4000,
  info: 4000,
  error: 6000,
};

const remover = (id: string) => {
  toasts = toasts.filter(t => t.id !== id);
  emitir();
};

const adicionar = (tipo: ToastTipo, mensagem: string) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  toasts = [...toasts, { id, tipo, mensagem }];
  emitir();
  setTimeout(() => remover(id), DURACAO_MS[tipo]);
  return id;
};

/**
 * Notificações do sistema (substituem `alert()`/`window.confirm()` do navegador — bloqueantes e
 * fora do tema). Singleton com pub-sub simples: os call-sites de erro/sucesso de hoje são chamadas
 * soltas dentro de `catch`/validações, não amarradas ao ciclo de render, então um Context/hook
 * exigiria boilerplate desnecessário em cada componente. `ToastViewport` é o único assinante.
 */
export const toast = {
  success: (mensagem: string) => adicionar('success', mensagem),
  error: (mensagem: string) => adicionar('error', mensagem),
  info: (mensagem: string) => adicionar('info', mensagem),
  dismiss: remover,
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    listener(toasts);
    return () => listeners.delete(listener);
  },
};
