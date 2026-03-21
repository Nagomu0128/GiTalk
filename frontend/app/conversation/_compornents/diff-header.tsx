import { ArrowLeft, GitBranch } from 'lucide-react';
import type { Branch } from '@/stores/conversation-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      <span className="text-sm text-neutral-400">Diff</span>
    </div>

    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <GitBranch size={14} className="text-neutral-400" />
        <Select value={branchAId} onValueChange={(val) => { if (val) onBranchAChange(val); }}>
          <SelectTrigger size="sm" className="text-xs text-neutral-300">
            <SelectValue placeholder="ブランチを選択">
              {(value: string | null) => branches.find((b) => b.id === value)?.name ?? 'ブランチを選択'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id} label={b.name}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="text-xs text-neutral-500">vs</span>

      <div className="flex items-center gap-2">
        <GitBranch size={14} className="text-neutral-400" />
        <Select value={branchBId} onValueChange={(val) => onBranchBChange(val ?? '')}>
          <SelectTrigger size="sm" className="text-xs text-neutral-300">
            <SelectValue placeholder="ブランチを選択...">
              {(value: string | null) => branches.find((b) => b.id === value)?.name ?? 'ブランチを選択...'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {branches.filter((b) => b.id !== branchAId).map((b) => (
              <SelectItem key={b.id} value={b.id} label={b.name}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
