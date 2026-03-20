'use client';

import { GitBranch, GitCompareArrows, Merge } from 'lucide-react';
import { useConversationStore } from '@/stores/conversation-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      <GitBranch size={14} className="text-neutral-700 dark:text-neutral-400" />
      <Select value={activeBranchId ?? ''} onValueChange={(val) => { if (val) onSwitch(val); }}>
        <SelectTrigger size="sm" className="text-xs text-neutral-700 dark:text-neutral-300">
          <SelectValue placeholder="ブランチを選択">
            {(value: string | null) => {
              const branch = branches.find((b) => b.id === value);
              return branch ? `${branch.name}${branch.isDefault ? ' (default)' : ''}` : 'ブランチを選択';
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id} label={`${branch.name}${branch.isDefault ? ' (default)' : ''}`}>
              {branch.name}{branch.isDefault ? ' (default)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        onClick={onDiff}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        title="ブランチを比較"
      >
        <GitCompareArrows size={14} />
        <span>比較</span>
      </button>

      <button
        onClick={onMerge}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        title="会話を統合"
      >
        <Merge size={14} />
        <span>統合</span>
      </button>
    </div>
  );
}
