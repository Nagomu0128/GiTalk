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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">会話を統合</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">マージ元</label>
          <select
            value={sourceBranchId}
            onChange={(e) => setSourceBranchId(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">ブランチを選択...</option>
            {otherBranches.map((b) => (
              <option key={b.id} value={b.id}>🌿 {b.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            マージ先: 🌿 {branches.find((b) => b.id === activeBranchId)?.name}
          </label>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-gray-700">要約の粒度</label>
          {STRATEGIES.map((s) => (
            <label key={s.value} className="mb-2 flex items-start gap-2">
              <input
                type="radio"
                name="strategy"
                value={s.value}
                checked={strategy === s.value}
                onChange={(e) => setStrategy(e.target.value)}
                className="mt-1"
              />
              <div>
                <span className="text-sm font-medium">{s.label}</span>
                <span className="block text-xs text-gray-400">{s.description}</span>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={!sourceBranchId || isLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'AIが要約を生成しています...' : '統合する'}
          </button>
        </div>
      </div>
    </div>
  );
}
