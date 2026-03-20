'use client';

import { ArrowDownUp } from 'lucide-react';

type VisibilityFilter = 'all' | 'private' | 'public';
type SortKey = 'updatedAt' | 'title';

export function RepositoryFilterBar({
  visibilityFilter,
  onVisibilityFilterChange,
  sortKey,
  onSortKeyChange,
}: {
  readonly visibilityFilter: VisibilityFilter;
  readonly onVisibilityFilterChange: (value: VisibilityFilter) => void;
  readonly sortKey: SortKey;
  readonly onSortKeyChange: (value: SortKey) => void;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-700">
        {(['all', 'private', 'public'] as const).map((value) => (
          <button
            key={value}
            onClick={() => onVisibilityFilterChange(value)}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${
              visibilityFilter === value
                ? 'bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200'
                : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'
            }`}
          >
            {value === 'all' ? 'すべて' : value}
          </button>
        ))}
      </div>

      <button
        onClick={() => onSortKeyChange(sortKey === 'updatedAt' ? 'title' : 'updatedAt')}
        className="ml-auto flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:border-neutral-300 hover:text-neutral-800 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-300"
      >
        <ArrowDownUp size={13} />
        {sortKey === 'updatedAt' ? '更新日時' : '名前'}
      </button>
    </div>
  );
}
