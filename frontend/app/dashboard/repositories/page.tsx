'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">マイリポジトリ</h1>
      </div>

      {loading && <p className="text-sm text-gray-400">読み込み中...</p>}
      {!loading && repositories.length === 0 && (
        <p className="text-sm text-gray-400">まだリポジトリがありません。会話を保存してリポジトリを作成しましょう。</p>
      )}

      <div className="flex flex-col gap-3">
        {repositories.map((repo) => (
          <button
            key={repo.id}
            onClick={() => router.push(`/repository/${repo.id}`)}
            className="w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">{repo.title}</h3>
              <span className="text-xs text-gray-400">
                {repo.visibility === 'private' ? '🔒 private' : '🌐 public'}
              </span>
            </div>
            {repo.description && (
              <p className="mt-1 text-xs text-gray-500">{repo.description}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
