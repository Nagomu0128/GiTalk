'use client';

import { useState, useEffect } from 'react';
import { useConversationStore } from '@/stores/conversation-store';
import { useAuthStore } from '@/stores/auth-store';

const API = '/api';

type PushDialogProps = {
  readonly conversationId: string;
  readonly onClose: () => void;
};

type Repository = {
  readonly id: string;
  readonly title: string;
};

export function PushDialog({ conversationId, onClose }: PushDialogProps) {
  const branches = useConversationStore((s) => s.branches);
  const conversation = useConversationStore((s) => s.conversation);
  const user = useAuthStore((s) => s.user);

  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [repos, setRepos] = useState<ReadonlyArray<Repository>>([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [newRepoTitle, setNewRepoTitle] = useState(conversation?.title ?? '');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set(branches.map((b) => b.id)));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRepos = async () => {
      const token = await user?.getIdToken();
      const res = await fetch(`${API}/v1/repositories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRepos(data.data); // eslint-disable-line react-hooks/set-state-in-effect
      }
    };
    fetchRepos(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [user]);

  const toggleBranch = (branchId: string) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  };

  const handlePush = async () => {
    setLoading(true);
    const token = await user?.getIdToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    let repoId = selectedRepoId;

    if (mode === 'new') {
      const createRes = await fetch(`${API}/v1/repositories`, {
        method: 'POST', headers,
        body: JSON.stringify({ title: newRepoTitle, description: newRepoDescription || null, visibility }),
      });
      if (!createRes.ok) { alert('リポジトリ作成に失敗しました'); setLoading(false); return; }
      const newRepo = await createRes.json();
      repoId = newRepo.id;
    }

    const pushRes = await fetch(`${API}/v1/repositories/${repoId}/push`, {
      method: 'POST', headers,
      body: JSON.stringify({ conversation_id: conversationId, branch_ids: [...selectedBranches] }),
    });

    setLoading(false);
    if (pushRes.ok) { alert('保存しました！'); onClose(); }
    else { const err = await pushRes.json(); alert(err.error?.message ?? 'Push に失敗しました'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">📦 リポジトリに保存</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="mb-4 flex gap-2">
          <button onClick={() => setMode('new')} className={`rounded px-3 py-1 text-sm ${mode === 'new' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}>新規作成</button>
          <button onClick={() => setMode('existing')} className={`rounded px-3 py-1 text-sm ${mode === 'existing' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}>既存を選択</button>
        </div>

        {mode === 'new' && (
          <div className="mb-4 space-y-3">
            <input value={newRepoTitle} onChange={(e) => setNewRepoTitle(e.target.value)} placeholder="リポジトリ名" className="w-full rounded border px-3 py-2 text-sm" />
            <input value={newRepoDescription} onChange={(e) => setNewRepoDescription(e.target.value)} placeholder="説明（任意）" className="w-full rounded border px-3 py-2 text-sm" />
            <div className="flex gap-3">
              <label className="flex items-center gap-1 text-sm"><input type="radio" checked={visibility === 'private'} onChange={() => setVisibility('private')} /> 🔒 Private</label>
              <label className="flex items-center gap-1 text-sm"><input type="radio" checked={visibility === 'public'} onChange={() => setVisibility('public')} /> 🌐 Public</label>
            </div>
          </div>
        )}

        {mode === 'existing' && (
          <div className="mb-4">
            <select value={selectedRepoId} onChange={(e) => setSelectedRepoId(e.target.value)} className="w-full rounded border px-3 py-2 text-sm">
              <option value="">リポジトリを選択...</option>
              {repos.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
        )}

        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-gray-700">ブランチ選択</p>
          {branches.map((branch) => (
            <label key={branch.id} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={selectedBranches.has(branch.id)} onChange={() => toggleBranch(branch.id)} />
              🌿 {branch.name}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">キャンセル</button>
          <button onClick={handlePush} disabled={loading || (mode === 'existing' && !selectedRepoId) || selectedBranches.size === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}
