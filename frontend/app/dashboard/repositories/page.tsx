'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

const API = '/api';

type RepositorySummary = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: 'private' | 'public';
  readonly updatedAt: string;
};

export default function RepositoriesPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [repositories, setRepositories] = useState<ReadonlyArray<RepositorySummary>>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<RepositorySummary | null>(null);

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

  const handleDelete = async (repoId: string) => {
    const token = await user?.getIdToken();
    const res = await fetch(`${API}/v1/repositories/${repoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setRepositories((prev) => prev.filter((r) => r.id !== repoId));
    }
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-700 px-6">
        <h1 className="text-lg font-bold text-neutral-200">マイリポジトリ</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + 会話から作成
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading && <p className="text-sm text-neutral-500">読み込み中...</p>}
        {!loading && repositories.length === 0 && (
          <p className="text-sm text-neutral-500">まだリポジトリがありません。会話を保存してリポジトリを作成しましょう。</p>
        )}

        <div className="flex flex-col gap-3">
          {repositories.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center rounded-xl border border-neutral-700 bg-neutral-800 transition-colors hover:border-neutral-600"
            >
              <button
                onClick={() => router.push(`/repository/${repo.id}`)}
                className="flex-1 p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-neutral-200">{repo.title}</h3>
                  <span className="text-xs text-neutral-500">
                    {repo.visibility === 'private' ? 'private' : 'public'}
                  </span>
                </div>
                {repo.description && (
                  <p className="mt-1 text-xs text-neutral-400">{repo.description}</p>
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(repo); }}
                className="mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-700 hover:text-red-400"
              >
                <Trash2 size={15} />
              </button>
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
                onClick={() => handleDelete(deleteTarget.id)}
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
