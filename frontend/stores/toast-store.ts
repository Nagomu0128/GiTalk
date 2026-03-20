import { create } from 'zustand';

type Toast = {
  readonly id: string;
  readonly message: string;
  readonly variant: 'success' | 'error';
};

type ToastStore = {
  readonly toasts: ReadonlyArray<Toast>;
  readonly addToast: (message: string, variant: 'success' | 'error') => void;
  readonly removeToast: (id: string) => void;
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, variant) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, message, variant }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
