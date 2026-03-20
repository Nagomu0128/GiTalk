'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Globe, Lock, MoreHorizontal, Package, Trash2 } from 'lucide-react';

type RepositorySummary = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: 'private' | 'public';
  readonly updatedAt: string;
};

const formatRelativeTime = (dateString: string): string => {
  const now = Date.now();
  const target = new Date(dateString).getTime();
  const diffMs = now - target;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffSec < 60) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;
  if (diffWeek < 5) return `${diffWeek}週間前`;
  return `${diffMonth}ヶ月前`;
};

function ContextMenu({
  onDelete,
}: {
  readonly onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((prev) => !prev); }}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-neutral-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-neutral-100 dark:text-red-400 dark:hover:bg-neutral-700"
          >
            <Trash2 size={14} />
            削除
          </button>
        </div>
      )}
    </div>
  );
}

export function RepositoryCard({
  repo,
  onClick,
  onDelete,
}: {
  readonly repo: RepositorySummary;
  readonly onClick: () => void;
  readonly onDelete?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      className="group flex cursor-pointer items-start gap-4 rounded-xl border border-neutral-200 bg-white p-4 transition-all hover:border-neutral-300 hover:shadow-lg dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-neutral-600 dark:hover:shadow-black/20"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 transition-colors group-hover:bg-neutral-200 group-hover:text-neutral-700 dark:bg-neutral-700/50 dark:text-neutral-400 dark:group-hover:bg-neutral-700 dark:group-hover:text-neutral-300">
        <Package size={20} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium text-neutral-800 group-hover:text-neutral-950 dark:text-neutral-200 dark:group-hover:text-white">
            {repo.title}
          </h3>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-300 px-2 py-0.5 text-xs text-neutral-500 dark:border-neutral-600 dark:text-neutral-400">
            {repo.visibility === 'private' ? <Lock size={11} /> : <Globe size={11} />}
            {repo.visibility}
          </span>
        </div>

        <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
          {repo.description ?? '説明なし'}
        </p>

        <div className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
          <Clock size={12} />
          <span>更新: {formatRelativeTime(repo.updatedAt)}</span>
        </div>
      </div>

      {onDelete && (
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <ContextMenu onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}
