'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownUp, Clock, Globe, Lock, MoreHorizontal, Package, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';

type VisibilityFilter = 'all' | 'private' | 'public';
type SortKey = 'updatedAt' | 'title';

const API = '/api';

type RepositorySummary = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: 'private' | 'public';
  readonly updatedAt: string;
  readonly owner: {
    readonly displayName: string;
    readonly avatarUrl: string | null;
  };
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
        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-neutral-300"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-neutral-700 bg-neutral-800 py-1 shadow-xl">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-400 transition-colors hover:bg-neutral-700"
          >
            <Trash2 size={14} />
            削除
          </button>
        </div>
      )}
    </div>
  );
}

export default function RepositoriesPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [repositories, setRepositories] = useState<ReadonlyArray<RepositorySummary>>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<RepositorySummary | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');

  const filteredRepositories = useMemo(() => {
    const filtered = visibilityFilter === 'all'
      ? repositories
      : repositories.filter((r) => r.visibility === visibilityFilter);

    return [...filtered].sort((a, b) =>
      sortKey === 'updatedAt'
        ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        : a.title.localeCompare(b.title, 'ja'),
    );
  }, [repositories, visibilityFilter, sortKey]);

  useEffect(() => {
    const fetchRepos = async () => {
      const token = await user?.getIdToken();
      const res = await fetch(`${API}/v1/repositories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRepositories(data.data);
      }
      setLoading(false);
    };
    fetchRepos(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [user]);

  const handleDelete = async (repo: RepositorySummary) => {
    const token = await user?.getIdToken();
    const res = await fetch(`${API}/v1/repositories/${repo.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setRepositories((prev) => prev.filter((r) => r.id !== repo.id));
      toast.success(`「${repo.title}」を削除しました`);
    } else {
      toast.error('リポジトリの削除に失敗しました');
    }
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-8 py-8">
        {/* Profile section */}
        <div className="mb-10 flex flex-col items-center py-6">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName ?? ''}
              className="h-36 w-36 rounded-full border-4 border-neutral-700 shadow-lg shadow-black/30"
            />
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-neutral-700 bg-neutral-700 text-5xl font-bold text-neutral-300 shadow-lg shadow-black/30">
              {user?.displayName?.charAt(0) ?? '?'}
            </div>
          )}
          <h1 className="mt-4 text-2xl font-bold text-neutral-100">{user?.displayName ?? 'ユーザー'}</h1>
          <p className="mt-1 text-sm text-neutral-500">{user?.email ?? ''}</p>
        </div>

        {/* Repositories header */}
        <div className="mb-4 border-b border-neutral-700 pb-3">
          <h2 className="text-sm font-semibold text-neutral-300">Repositories</h2>
        </div>

        {loading && <p className="text-sm text-neutral-500">読み込み中...</p>}
        {!loading && repositories.length === 0 && (
          <p className="text-sm text-neutral-500">まだリポジトリがありません。会話を保存してリポジトリを作成しましょう。</p>
        )}

        {/* Filter bar */}
        {!loading && repositories.length > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-neutral-700 p-0.5">
              {(['all', 'private', 'public'] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setVisibilityFilter(value)}
                  className={`rounded-md px-3 py-1 text-xs transition-colors ${
                    visibilityFilter === value
                      ? 'bg-neutral-700 text-neutral-200'
                      : 'text-neutral-400 hover:text-neutral-300'
                  }`}
                >
                  {value === 'all' ? 'すべて' : value}
                </button>
              ))}
            </div>

            <button
              onClick={() => setSortKey((prev) => (prev === 'updatedAt' ? 'title' : 'updatedAt'))}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-300"
            >
              <ArrowDownUp size={13} />
              {sortKey === 'updatedAt' ? '更新日時' : '名前'}
            </button>
          </div>
        )}

        {!loading && repositories.length > 0 && filteredRepositories.length === 0 && (
          <p className="text-sm text-neutral-500">該当するリポジトリがありません。</p>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filteredRepositories.map((repo) => (
            <div
              key={repo.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/repository/${repo.id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/repository/${repo.id}`); }}
              className="group flex items-start gap-4 rounded-xl border border-neutral-700 bg-neutral-800 p-4 transition-all hover:border-neutral-600 hover:shadow-lg hover:shadow-black/20 cursor-pointer"
            >
              {/* Icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-700/50 text-neutral-400 transition-colors group-hover:bg-neutral-700 group-hover:text-neutral-300">
                <Package size={20} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Row 1: Title + Visibility badge */}
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-medium text-neutral-200 group-hover:text-white">
                    {repo.title}
                  </h3>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-neutral-600 px-2 py-0.5 text-xs text-neutral-400">
                    {repo.visibility === 'private' ? <Lock size={11} /> : <Globe size={11} />}
                    {repo.visibility}
                  </span>
                </div>

                {/* Row 2: Description */}
                <p className="mt-1 truncate text-xs text-neutral-400">
                  {repo.description ?? '説明なし'}
                </p>

                {/* Row 3: Meta info */}
                <div className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
                  <Clock size={12} />
                  <span>更新: {formatRelativeTime(repo.updatedAt)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                <ContextMenu onDelete={() => setDeleteTarget(repo)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-neutral-800 p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-neutral-200">リポジトリを削除しますか？</h3>
            <p className="mb-4 text-sm text-neutral-400">
              「{deleteTarget.title}」を削除します。この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-700"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
