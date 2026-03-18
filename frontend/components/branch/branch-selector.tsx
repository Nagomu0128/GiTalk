'use client';

import { useConversationStore } from '@/stores/conversation-store';

type BranchSelectorProps = {
  readonly onSwitch: (branchId: string) => void;
  readonly onMerge: () => void;
  readonly onDiff: () => void;
};

export function BranchSelector({ onSwitch, onMerge, onDiff }: BranchSelectorProps) {
  const branches = useConversationStore((s) => s.branches);
  const activeBranchId = useConversationStore((s) => s.activeBranchId);
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">🌿</span>
      <select
        value={activeBranchId ?? ''}
        onChange={(e) => onSwitch(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
      >
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}{branch.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>

      <div className="relative">
        <button className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50">
          ⋯
        </button>
        <div className="absolute right-0 top-full z-10 mt-1 hidden w-48 rounded-lg border bg-white py-1 shadow-lg group-hover:block [.open_&]:block">
          <button
            onClick={onDiff}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
          >
            📊 ブランチを比較
            <span className="block text-xs text-gray-400">二つの話題の違いを確認</span>
          </button>
          <button
            onClick={onMerge}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
          >
            🔀 会話を統合
            <span className="block text-xs text-gray-400">別の話題の結論を取り込む</span>
          </button>
        </div>
      </div>
    </div>
  );
}
