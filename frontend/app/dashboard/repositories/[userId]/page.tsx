'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { RepositoryCard } from '../_components/repository-card';
import { RepositoryFilterBar } from '../_components/repository-filter-bar';
import { DeleteConfirmDialog } from '../_components/delete-confirm-dialog';
import { UserSearchBar } from '../_components/user-search-bar';

type VisibilityFilter = 'all' | 'private' | 'public';
type SortKey = 'updatedAt' | 'title';

const API = '/api';

type RepositorySummary = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: 'private' | 'public';
  readonly updatedAt: string;
};

type UserProfile = {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly followersCount: number;
  readonly followingCount: number;
  readonly isFollowing: boolean;
};

export default function UserRepositoriesPage() {
  const params = useParams<{ userId: string }>();
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [repositories, setRepositories] = useState<ReadonlyArray<RepositorySummary>>([]);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  const [myDbId, setMyDbId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RepositorySummary | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');

  const isOwner = myDbId !== null && myDbId === params.userId;

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

  // Fetch my DB ID
  useEffect(() => {
    const fetchMyId = async () => {
      const token = await user?.getIdToken();
      if (!token) return;
      const res = await fetch(`${API}/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyDbId(data.id);
      }
    };
    fetchMyId(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [user]);

  // Fetch target user's repositories
  useEffect(() => {
    const fetchRepos = async () => {
      setLoading(true);
      setNotFound(false);
      const token = await user?.getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API}/v1/users/${params.userId}/repositories`, { headers });
      if (res.ok) {
        const data = await res.json();
        setTargetUser(data.user);
        setRepositories(data.data);
      } else if (res.status === 404) {
        setNotFound(true);
      }
      setLoading(false);
    };
    fetchRepos(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [user, params.userId]);

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

  const [followLoading, setFollowLoading] = useState(false);

  const handleToggleFollow = useCallback(async () => {
    if (!targetUser || !user) return;
    setFollowLoading(true);
    const token = await user.getIdToken();
    const isCurrentlyFollowing = targetUser.isFollowing;
    const res = await fetch(`${API}/v1/users/${targetUser.id}/follow`, {
      method: isCurrentlyFollowing ? 'DELETE' : 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setTargetUser((prev) => prev ? {
        ...prev,
        isFollowing: !isCurrentlyFollowing,
        followersCount: prev.followersCount + (isCurrentlyFollowing ? -1 : 1),
      } : prev);
      toast.success(isCurrentlyFollowing ? 'Unfollowed' : 'Followed');
    } else {
      toast.error('Failed');
    }
    setFollowLoading(false);
  }, [targetUser, user]);

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">ユーザーが見つかりません</p>
        <button
          onClick={() => router.push('/dashboard/repositories')}
          className="mt-4 text-sm text-neutral-500 underline hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          戻る
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-8 py-8">
        {/* User search bar */}
        <div className="mb-8 flex justify-center">
          <UserSearchBar />
        </div>

        {/* Profile section */}
        <div className="mb-10 flex flex-col items-center py-6">
          {targetUser?.avatarUrl ? (
            <img
              src={targetUser.avatarUrl}
              alt={targetUser.displayName}
              className="h-36 w-36 rounded-full border-4 border-neutral-200 shadow-lg dark:border-neutral-700 dark:shadow-black/30"
            />
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-neutral-200 bg-neutral-100 text-5xl font-bold text-neutral-600 shadow-lg dark:border-neutral-700 dark:bg-neutral-700 dark:text-neutral-300 dark:shadow-black/30">
              {targetUser?.displayName?.charAt(0) ?? '?'}
            </div>
          )}
          <h1 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {targetUser?.displayName ?? 'ユーザー'}
          </h1>
          {isOwner && user?.email && (
            <p className="mt-1 text-sm text-neutral-500">{user.email}</p>
          )}

          {/* Follow counts */}
          {targetUser && (
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="text-neutral-700 dark:text-neutral-300">
                <span className="font-semibold">{targetUser.followersCount}</span>
                <span className="ml-1 text-neutral-500">followers</span>
              </span>
              <span className="text-neutral-700 dark:text-neutral-300">
                <span className="font-semibold">{targetUser.followingCount}</span>
                <span className="ml-1 text-neutral-500">following</span>
              </span>
            </div>
          )}

          {/* Follow button */}
          {targetUser && !isOwner && myDbId && (
            <button
              onClick={handleToggleFollow}
              disabled={followLoading}
              className={`mt-4 flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                targetUser.isFollowing
                  ? 'border border-neutral-300 bg-white text-neutral-700 hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-red-900/30 dark:hover:text-red-400'
                  : 'bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300'
              }`}
            >
              {targetUser.isFollowing ? <UserMinus size={16} /> : <UserPlus size={16} />}
              {targetUser.isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
        </div>

        {/* Repositories header */}
        <div className="mb-4 border-b border-neutral-200 pb-3 dark:border-neutral-700">
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Repositories</h2>
        </div>

        {loading && <p className="text-sm text-neutral-500">読み込み中...</p>}
        {!loading && repositories.length === 0 && (
          <p className="text-sm text-neutral-500">
            {isOwner ? 'まだリポジトリがありません。会話を保存してリポジトリを作成しましょう。' : '公開リポジトリはありません。'}
          </p>
        )}

        {/* Filter bar (owner only) */}
        {!loading && repositories.length > 0 && isOwner && (
          <RepositoryFilterBar
            visibilityFilter={visibilityFilter}
            onVisibilityFilterChange={setVisibilityFilter}
            sortKey={sortKey}
            onSortKeyChange={setSortKey}
          />
        )}

        {!loading && repositories.length > 0 && filteredRepositories.length === 0 && (
          <p className="text-sm text-neutral-500">該当するリポジトリがありません。</p>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filteredRepositories.map((repo) => (
            <RepositoryCard
              key={repo.id}
              repo={repo}
              onClick={() => router.push(`/repository/${repo.id}`)}
              onDelete={isOwner ? () => setDeleteTarget(repo) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          title={deleteTarget.title}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}
    </div>
  );
}
