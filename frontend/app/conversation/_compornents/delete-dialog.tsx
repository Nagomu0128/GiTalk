'use client';

import { useState } from 'react';

type DeleteDialogProps = {
  readonly onDelete: () => Promise<void>;
  readonly onClose: () => void;
};

export function DeleteDialog({ onDelete, onClose }: DeleteDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    await onDelete();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-100">会話を削除</h2>
          <button onClick={onClose} className="text-neutral-500 transition-colors hover:text-neutral-300">✕</button>
        </div>

        <p className="mb-1 text-sm text-neutral-400">
          この会話を削除しますか？
        </p>
        <p className="mb-6 text-xs text-neutral-500">
          この操作は取り消せません。
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
          >
            キャンセル
          </button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-40"
          >
            {loading ? '削除中...' : '削除'}
          </button>
        </div>
      </div>
    </div>
  );
}
