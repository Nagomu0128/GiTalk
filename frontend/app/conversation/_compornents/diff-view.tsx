'use client';

import { useState, useCallback } from 'react';
import { GitBranch } from 'lucide-react';
import { useConversationStore, type Branch, type ConversationNode } from '@/stores/conversation-store';
import { useAuthStore } from '@/stores/auth-store';
import { DiffHeader } from './diff-header';
import { DiffBranchPanel } from './diff-branch-panel';

const API = '/api';

type DiffData = {
  readonly lca_node_id: string | null;
  readonly branch_a: { readonly branchId: string; readonly name: string; readonly nodes: ReadonlyArray<ConversationNode> };
  readonly branch_b: { readonly branchId: string; readonly name: string; readonly nodes: ReadonlyArray<ConversationNode> };
};

type DiffViewProps = {
  readonly conversationId: string;
  readonly onClose: () => void;
  readonly branches?: ReadonlyArray<Branch>;
  readonly initialBranchId?: string;
};

export function DiffView({ conversationId, onClose, branches: branchesProp, initialBranchId }: DiffViewProps) {
  const storeBranches = useConversationStore((s) => s.branches);
  const storeActiveBranchId = useConversationStore((s) => s.activeBranchId);
  const branches = branchesProp ?? storeBranches;
  const user = useAuthStore((s) => s.user);
  const [branchAId, setBranchAId] = useState(initialBranchId ?? storeActiveBranchId ?? '');
  const [branchBId, setBranchBId] = useState('');
  const [diffData, setDiffData] = useState<DiffData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDiff = useCallback(async () => {
    if (!branchAId || !branchBId) return;
    setLoading(true);
    const token = await user?.getIdToken();
    const res = await fetch(
      `${API}/v1/conversations/${conversationId}/diff?branch_a=${branchAId}&branch_b=${branchBId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    setDiffData(data);
    setLoading(false);
  }, [branchAId, branchBId, conversationId, user]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-50 dark:bg-neutral-900">
      <DiffHeader
        branches={branches}
        branchAId={branchAId}
        branchBId={branchBId}
        loading={loading}
        onBranchAChange={setBranchAId}
        onBranchBChange={setBranchBId}
        onCompare={fetchDiff}
        onClose={onClose}
      />

      {diffData ? (
        <div className="flex flex-1 overflow-hidden">
          <DiffBranchPanel branchName={diffData.branch_a.name} nodes={diffData.branch_a.nodes} />
          <div className="w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />
          <DiffBranchPanel branchName={diffData.branch_b.name} nodes={diffData.branch_b.nodes} />
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <GitBranch size={36} className="text-neutral-300 dark:text-neutral-700" />
            <p className="text-sm text-neutral-400 dark:text-neutral-600">比較元のブランチ</p>
          </div>
          <div className="relative w-px shrink-0 bg-neutral-200 dark:bg-neutral-700">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <button
                onClick={fetchDiff}
                disabled={!branchBId || loading}
                className="whitespace-nowrap rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-neutral-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {loading ? '比較中...' : '比較する'}
              </button>
            </div>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <GitBranch size={36} className="text-neutral-300 dark:text-neutral-700" />
            <p className="text-sm text-neutral-400 dark:text-neutral-600">比較先のブランチを選択してください</p>
          </div>
        </div>
      )}
    </div>
  );
}
