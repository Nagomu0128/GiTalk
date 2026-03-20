'use client';

import { Search, GitBranch } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { SidebarFooter } from '@/components/layout/sidebar-footer';
import type { RepoBranch } from './types';

export const BranchListPanel = ({
  branches,
  selectedBranch,
  onSelectBranch,
  onSearchOpen,
}: {
  readonly branches: ReadonlyArray<RepoBranch>;
  readonly selectedBranch: string | null;
  readonly onSelectBranch: (branchId: string) => void;
  readonly onSearchOpen: () => void;
}) => {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-neutral-200 dark:border-neutral-700">
      <div className="flex h-10 shrink-0 items-center justify-between px-4">
        <span className="text-xs font-medium text-neutral-500">ブランチ</span>
        <button
          onClick={onSearchOpen}
          className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        >
          <Search size={13} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {branches.length === 0 && (
          <p className="px-2 text-xs text-neutral-500">まだブランチがpushされていません</p>
        )}
        {branches.map((branch) => (
          <button
            key={branch.repository_branch_id}
            onClick={() => onSelectBranch(branch.repository_branch_id)}
            className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              selectedBranch === branch.repository_branch_id
                ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <GitBranch size={14} className="shrink-0" />
            <span className="flex-1 truncate">{branch.name}</span>
            <span className="shrink-0 text-xs text-neutral-500">{branch.nodes.length}</span>
          </button>
        ))}
      </div>

      <SidebarFooter user={user} />
    </div>
  );
};
