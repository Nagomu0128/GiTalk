'use client';

import { useState } from 'react';
import { useConversationStore } from '@/stores/conversation-store';

type MergeDialogProps = {
  readonly onMerge: (sourceBranchId: string, targetBranchId: string, strategy: string) => void;
  readonly onClose: () => void;
  readonly isLoading?: boolean;
};

const STRATEGIES = [
  { value: 'concise', label: '簡潔', description: '1-2文で要点のみ' },
  { value: 'detailed', label: '詳細', description: '主要な論点をすべて含む' },
  { value: 'conclusion_only', label: '結論のみ', description: '最終的な結論だけ' },
] as const;

export function MergeDialog({ onMerge, onClose, isLoading = false }: MergeDialogProps) {
  const branches = useConversationStore((s) => s.branches);
  const activeBranchId = useConversationStore((s) => s.activeBranchId);

  const [sourceBranchId, setSourceBranchId] = useState('');
  const [strategy, setStrategy] = useState('detailed');

  const otherBranches = branches.filter((b) => b.id !== activeBranchId);

  const handleSubmit = () => {
    if (!sourceBranchId || !activeBranchId) return;
    onMerge(sourceBranchId, activeBranchId, strategy);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-100">会話を統合</h2>
          <button onClick={onClose} className="text-neutral-500 transition-colors hover:text-neutral-300">✕</button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-neutral-400">マージ元</label>
          <select
            value={sourceBranchId}
            onChange={(e) => setSourceBranchId(e.target.value)}
            className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 outline-none transition-colors focus:border-neutral-500"
          >
            <option value="">ブランチを選択...</option>
            {otherBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <p className="text-sm text-neutral-400">
            マージ先: <span className="font-medium text-neutral-200">{branches.find((b) => b.id === activeBranchId)?.name}</span>
          </p>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-neutral-400">要約の粒度</label>
          <div className="space-y-1">
            {STRATEGIES.map((s) => (
              <label
                key={s.value}
                className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 transition-colors ${
                  strategy === s.value ? 'bg-neutral-800' : 'hover:bg-neutral-800/50'
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={s.value}
                  checked={strategy === s.value}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="mt-0.5 accent-neutral-400"
                />
                <div>
                  <span className="text-sm font-medium text-neutral-200">{s.label}</span>
                  <span className="block text-xs text-neutral-500">{s.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={!sourceBranchId || isLoading}
            className="rounded-lg bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:opacity-40"
          >
            {isLoading ? '要約を生成中...' : '統合する'}
          </button>
        </div>
      </div>
    </div>
  );
}
