'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';

const API = '/api';

type SaveToRepoDialogProps = {
  readonly conversationId: string;
  readonly conversationTitle: string;
  readonly onClose: () => void;
};

type Repository = {
  readonly id: string;
  readonly title: string;
};

type Branch = {
  readonly id: string;
  readonly name: string;
};

export function SaveToRepoDialog({ conversationId, conversationTitle, onClose }: SaveToRepoDialogProps) {
  const user = useAuthStore((s) => s.user);

  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [repos, setRepos] = useState<ReadonlyArray<Repository>>([]);
  const [branches, setBranches] = useState<ReadonlyArray<Branch>>([]);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [newRepoTitle, setNewRepoTitle] = useState(conversationTitle);
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = await user?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      const [reposRes, branchesRes] = await Promise.all([
        fetch(`${API}/v1/repositories`, { headers }),
        fetch(`${API}/v1/conversations/${conversationId}/branches`, { headers }),
      ]);

      if (reposRes.ok) {
        const data = await reposRes.json();
        setRepos(data.data);
      }
      if (branchesRes.ok) {
        const data = await branchesRes.json();
        setBranches(data.data);
        setSelectedBranches(new Set(data.data.map((b: Branch) => b.id)));
      }
      setBranchesLoading(false);
    };
    fetchData();
  }, [user, conversationId]);

  const toggleBranch = (branchId: string) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  };

  const handleSave = async () => {
    setLoading(true);
    const token = await user?.getIdToken();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    let repoId = selectedRepoId;

    if (mode === 'new') {
      const createRes = await fetch(`${API}/v1/repositories`, {
        method: 'POST', headers,
        body: JSON.stringify({ title: newRepoTitle, description: newRepoDescription || null, visibility }),
      });
      if (!createRes.ok) { toast.error('リポジトリ作成に失敗しました'); setLoading(false); return; }
      const newRepo = await createRes.json();
      repoId = newRepo.id;
    }

    const pushRes = await fetch(`${API}/v1/repositories/${repoId}/push`, {
      method: 'POST', headers,
      body: JSON.stringify({ conversation_id: conversationId, branch_ids: [...selectedBranches] }),
    });

    setLoading(false);
    if (pushRes.ok) { toast.success('保存しました！'); onClose(); }
    else { const err = await pushRes.json(); toast.error(err.error?.message ?? '保存に失敗しました'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-neutral-800 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-200">リポジトリに保存</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">✕</button>
        </div>

        {/* Mode tabs */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setMode('new')}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${mode === 'new' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700'}`}
          >
            新規作成
          </button>
          <button
            onClick={() => setMode('existing')}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${mode === 'existing' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700'}`}
          >
            既存を選択
          </button>
        </div>

        {/* New repo form */}
        {mode === 'new' && (
          <div className="mb-4 space-y-3">
            <input
              value={newRepoTitle}
              onChange={(e) => setNewRepoTitle(e.target.value)}
              placeholder="リポジトリ名"
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200 placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
            />
            <input
              value={newRepoDescription}
              onChange={(e) => setNewRepoDescription(e.target.value)}
              placeholder="説明（任意）"
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200 placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                <input
                  type="radio"
                  checked={visibility === 'private'}
                  onChange={() => setVisibility('private')}
                  className="accent-blue-500"
                />
                Private
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
                <input
                  type="radio"
                  checked={visibility === 'public'}
                  onChange={() => setVisibility('public')}
                  className="accent-blue-500"
                />
                Public
              </label>
            </div>
          </div>
        )}

        {/* Existing repo selector */}
        {mode === 'existing' && (
          <div className="mb-4">
            <select
              value={selectedRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="">リポジトリを選択...</option>
              {repos.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
        )}

        {/* Branch selection */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-neutral-400">ブランチ選択</p>
          {branchesLoading ? (
            <p className="text-xs text-neutral-500">読み込み中...</p>
          ) : branches.length === 0 ? (
            <p className="text-xs text-neutral-500">ブランチがありません</p>
          ) : (
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {branches.map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 cursor-pointer dark:text-neutral-300 dark:hover:bg-neutral-700">
                  <input
                    type="checkbox"
                    checked={selectedBranches.has(branch.id)}
                    onChange={() => toggleBranch(branch.id)}
                    className="accent-blue-500"
                  />
                  {branch.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={loading || (mode === 'existing' && !selectedRepoId) || selectedBranches.size === 0}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '保存中...' : '保存する'}
          </button>
        </div>
      </div>
    </div>
  );
}
