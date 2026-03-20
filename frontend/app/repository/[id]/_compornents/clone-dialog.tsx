'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GitBranch } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import type { RepoBranch } from './types';

const API = '/api';

export const CloneDialog = ({
  repoId,
  branches,
  open,
  onClose,
}: {
  readonly repoId: string;
  readonly branches: ReadonlyArray<RepoBranch>;
  readonly open: boolean;
  readonly onClose: () => void;
}) => {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(
    () => new Set(branches.map((b) => b.repository_branch_id))
  );
  const [loading, setLoading] = useState(false);

  const toggleBranch = (branchId: string) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  };

  const handleConfirm = async () => {
    setLoading(true);
    const token = await user?.getIdToken();
    const res = await fetch(`${API}/v1/repositories/${repoId}/clone`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch_ids: [...selectedBranches] }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      onClose();
      router.push(`/conversation/${data.conversationId}`);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
        <h3 className="mb-2 text-base font-bold text-neutral-900 dark:text-neutral-100">この会話をコピーしますか？</h3>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          選択したブランチの会話を自分の会話としてコピーします。
        </p>

        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-neutral-500">ブランチ選択</p>
          {branches.map((branch) => (
            <label key={branch.repository_branch_id} className="flex items-center gap-2 py-1 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={selectedBranches.has(branch.repository_branch_id)}
                onChange={() => toggleBranch(branch.repository_branch_id)}
                className="rounded border-neutral-300 dark:border-neutral-600"
              />
              <GitBranch size={13} className="text-neutral-500" />
              {branch.name}
              <span className="text-xs text-neutral-500">({branch.nodes.length} nodes)</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || selectedBranches.size === 0}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? 'コピー中...' : 'コピーして使う'}
          </button>
        </div>
      </div>
    </div>
  );
};
