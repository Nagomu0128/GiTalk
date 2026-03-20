'use client';

import { useState } from 'react';

type CreateBranchDialogProps = {
  readonly onSubmit: (name: string) => void;
  readonly onClose: () => void;
};

export function CreateBranchDialog({ onSubmit, onClose }: CreateBranchDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const validate = (value: string): boolean => {
    if (!value) { setError('ブランチ名を入力してください'); return false; }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) { setError('英数字・ハイフン・アンダースコアのみ使用できます'); return false; }
    if (value.length > 100) { setError('100文字以内で入力してください'); return false; }
    setError('');
    return true;
  };

  const handleSubmit = () => {
    if (validate(name)) onSubmit(name);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">🌿 新しい分岐を作成</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <p className="mb-4 text-xs text-gray-500">ここから別の話題を探索します</p>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">ブランチ名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="例: pricing-discussion"
            autoFocus
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          <p className="mt-1 text-xs text-gray-400">英数字・ハイフン・アンダースコアのみ</p>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            作成
          </button>
        </div>
      </div>
    </div>
  );
}
