import { ArrowLeft, GitBranch } from 'lucide-react';
import type { Branch } from '@/stores/conversation-store';

type DiffHeaderProps = {
  readonly branches: ReadonlyArray<Branch>;
  readonly branchAId: string;
  readonly branchBId: string;
  readonly loading: boolean;
  readonly onBranchAChange: (id: string) => void;
  readonly onBranchBChange: (id: string) => void;
  readonly onCompare: () => void;
  readonly onClose: () => void;
};

export const DiffHeader = ({
  branches,
  branchAId,
  branchBId,
  loading,
  onBranchAChange,
  onBranchBChange,
  onCompare,
  onClose,
}: DiffHeaderProps) => (
  <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-700">
    <div className="flex items-center gap-3">
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
      >
        <ArrowLeft size={16} />
        <span>チャットに戻る</span>
      </button>
      <span className="text-neutral-600">|</span>
      <span className="text-sm text-neutral-400">ブランチ比較</span>
    </div>

    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <GitBranch size={14} className="text-neutral-400" />
        <select
          value={branchAId}
          onChange={(e) => onBranchAChange(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-2 dark:border-neutral-600 dark:bg-neutral-800 py-1 text-xs text-neutral-300 outline-none"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <span className="text-xs text-neutral-500">vs</span>

      <div className="flex items-center gap-2">
        <GitBranch size={14} className="text-neutral-400" />
        <select
          value={branchBId}
          onChange={(e) => onBranchBChange(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-2 dark:border-neutral-600 dark:bg-neutral-800 py-1 text-xs text-neutral-300 outline-none"
        >
          <option value="">ブランチを選択...</option>
          {branches.filter((b) => b.id !== branchAId).map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <button
        onClick={onCompare}
        disabled={!branchBId || loading}
        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-neutral-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
      >
        {loading ? '比較中...' : '比較する'}
      </button>
    </div>
  </header>
);
