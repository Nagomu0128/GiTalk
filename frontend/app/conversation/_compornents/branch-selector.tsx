'use client';

import { GitBranch, GitCompareArrows, Merge } from 'lucide-react';
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
      <GitBranch size={14} className="text-neutral-400" />
      <select
        value={activeBranchId ?? ''}
        onChange={(e) => onSwitch(e.target.value)}
        className="rounded-lg border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 outline-none"
      >
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}{branch.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>

      <button
        onClick={onDiff}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-600 px-2.5 text-xs text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
        title="ブランチを比較"
      >
        <GitCompareArrows size={14} />
        <span>比較</span>
      </button>

      <button
        onClick={onMerge}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-600 px-2.5 text-xs text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
        title="会話を統合"
      >
        <Merge size={14} />
        <span>統合</span>
      </button>
    </div>
  );
}
