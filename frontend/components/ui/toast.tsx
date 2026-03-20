'use client';

import { X } from 'lucide-react';
import { useToastStore } from '@/stores/toast-store';

export const Toaster = () => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
            toast.variant === 'success'
              ? 'border-neutral-700 bg-neutral-800 text-neutral-200'
              : 'border-red-800 bg-red-900/80 text-red-200'
          }`}
        >
          <span className="text-sm">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-neutral-500 transition-colors hover:text-neutral-300"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
