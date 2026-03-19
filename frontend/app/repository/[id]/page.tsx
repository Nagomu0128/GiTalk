'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { MessageBubble } from '@/components/chat/message-bubble';

const API = '/api';

type Repository = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: 'private' | 'public';
};

type RepoNode = {
  readonly id: string;
  readonly parentRepositoryNodeId: string | null;
  readonly nodeType: string;
  readonly userMessage: string;
  readonly aiResponse: string;
  readonly model: string;
  readonly originalCreatedAt: string;
};

type RepoBranch = {
  readonly repository_branch_id: string;
  readonly name: string;
  readonly nodes: ReadonlyArray<RepoNode>;
};

export default function RepositoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const repoId = params.id as string;
  const user = useAuthStore((s) => s.user);

  const [repo, setRepo] = useState<Repository | null>(null);
  const [branches, setBranches] = useState<ReadonlyArray<RepoBranch>>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'branches' | 'tree'>('branches');

  useEffect(() => {
    const fetchData = async () => {
      const token = await user?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [repoRes, nodesRes] = await Promise.all([
        fetch(`${API}/v1/repositories/${repoId}`, { headers }),
        fetch(`${API}/v1/repositories/${repoId}/nodes`, { headers }),
      ]);

      if (!repoRes.ok) { router.push('/dashboard/repositories'); return; }

      const repoData = await repoRes.json();
      setRepo(repoData);

      if (nodesRes.ok) {
        const nodesData = await nodesRes.json();
        setBranches(nodesData.branches);
        if (nodesData.branches.length > 0) {
          setSelectedBranch(nodesData.branches[0].repository_branch_id); // eslint-disable-line react-hooks/set-state-in-effect
        }
      }
      setLoading(false);
    };
    fetchData(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [repoId, user, router]);

  const selectedBranchData = branches.find((b) => b.repository_branch_id === selectedBranch);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  if (!repo) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white px-6 py-4">
        <button onClick={() => router.push('/dashboard/repositories')} className="mb-2 text-sm text-gray-500 hover:text-gray-700">
          ← 戻る
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">📦 {repo.title}</h1>
          <span className="text-xs text-gray-400">
            {repo.visibility === 'private' ? '🔒 Private' : '🌐 Public'}
          </span>
        </div>
        {repo.description && <p className="mt-1 text-sm text-gray-500">{repo.description}</p>}
        <button
          onClick={async () => {
            const token = await user?.getIdToken();
            const res = await fetch(`${API}/v1/repositories/${repoId}/clone`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              router.push(`/conversation/${data.conversationId}`);
            }
          }}
          className="mt-2 rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
        >
          📋 コピーして使う
        </button>
      </div>

      <div className="border-b bg-white px-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('branches')}
            className={`border-b-2 px-2 py-3 text-sm ${activeTab === 'branches' ? 'border-blue-600 font-medium text-blue-600' : 'border-transparent text-gray-500'}`}
          >
            🌿 ブランチ一覧
          </button>
          <button
            onClick={() => setActiveTab('tree')}
            className={`border-b-2 px-2 py-3 text-sm ${activeTab === 'tree' ? 'border-blue-600 font-medium text-blue-600' : 'border-transparent text-gray-500'}`}
          >
            🌳 会話表示
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'branches' && (
          <div className="flex flex-col gap-3">
            {branches.length === 0 && <p className="text-sm text-gray-400">まだブランチがpushされていません</p>}
            {branches.map((branch) => (
              <div key={branch.repository_branch_id} className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">🌿 {branch.name}</h3>
                  <span className="text-xs text-gray-400">{branch.nodes.length} nodes</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tree' && (
          <div>
            <div className="mb-4">
              <select
                value={selectedBranch ?? ''}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="rounded border px-3 py-2 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.repository_branch_id} value={b.repository_branch_id}>
                    🌿 {b.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedBranchData && (
              <div className="rounded-xl border bg-white p-4">
                {selectedBranchData.nodes.length === 0 && (
                  <p className="text-sm text-gray-400">このブランチにはノードがありません</p>
                )}
                {selectedBranchData.nodes.map((node) => (
                  <div key={node.id}>
                    <MessageBubble role="user" content={node.userMessage} timestamp={node.originalCreatedAt} />
                    <MessageBubble role="ai" content={node.aiResponse} model={node.model} timestamp={node.originalCreatedAt} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
