'use client';

import { useState, useEffect } from 'react';
import { useConversationStore } from '@/stores/conversation-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';

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
  const addToast = useToastStore((s) => s.addToast);

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
      if (!createRes.ok) { addToast('リポジトリ作成に失敗しました', 'error'); setLoading(false); return; }
      const newRepo = await createRes.json();
      repoId = newRepo.id;
    }

    const pushRes = await fetch(`${API}/v1/repositories/${repoId}/push`, {
      method: 'POST', headers,
      body: JSON.stringify({ conversation_id: conversationId, branch_ids: [...selectedBranches] }),
    });

    setLoading(false);
    if (pushRes.ok) { addToast('保存しました', 'success'); onClose(); }
    else { const err = await pushRes.json(); addToast(err.error?.message ?? 'Push に失敗しました', 'error'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">リポジトリに保存</h2>
          <button onClick={onClose} className="text-neutral-500 transition-colors hover:text-neutral-300">✕</button>
        </div>

        <div className="mb-5 flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          <button
            onClick={() => setMode('new')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${mode === 'new' ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-300'}`}
          >
            新規作成
          </button>
          <button
            onClick={() => setMode('existing')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm transition-colors ${mode === 'existing' ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100' : 'text-neutral-400 hover:text-neutral-300'}`}
          >
            既存を選択
          </button>
        </div>

        {mode === 'new' && (
          <div className="mb-5 space-y-3">
            <input
              value={newRepoTitle}
              onChange={(e) => setNewRepoTitle(e.target.value)}
              placeholder="リポジトリ名"
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 dark:border-neutral-700 dark:bg-neutral-800 py-2 text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-colors focus:border-neutral-500"
            />
            <input
              value={newRepoDescription}
              onChange={(e) => setNewRepoDescription(e.target.value)}
              placeholder="説明（任意）"
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 dark:border-neutral-700 dark:bg-neutral-800 py-2 text-sm text-neutral-200 placeholder-neutral-500 outline-none transition-colors focus:border-neutral-500"
            />
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input type="radio" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="accent-neutral-400" />
                Private
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input type="radio" checked={visibility === 'public'} onChange={() => setVisibility('public')} className="accent-neutral-400" />
                Public
              </label>
            </div>
          </div>
        )}

        {mode === 'existing' && (
          <div className="mb-5">
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 dark:border-neutral-700 dark:bg-neutral-800 py-2 text-sm text-neutral-200 outline-none transition-colors focus:border-neutral-500"
            >
              <option value="">リポジトリを選択...</option>
              {repos.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
        )}

        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-neutral-400">ブランチ選択</p>
          <div className="space-y-1">
            {branches.map((branch) => (
              <label key={branch.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                <input
                  type="checkbox"
                  checked={selectedBranches.has(branch.id)}
                  onChange={() => toggleBranch(branch.id)}
                  className="accent-neutral-400"
                />
                {branch.name}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            キャンセル
          </button>
          <button
            onClick={handlePush}
            disabled={loading || (mode === 'existing' && !selectedRepoId) || selectedBranches.size === 0}
            className="rounded-lg bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white disabled:opacity-40"
          >
            {loading ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}
