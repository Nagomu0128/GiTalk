'use client';

import { useState, useCallback } from 'react';
import { useConversationStore, type ConversationNode } from '@/stores/conversation-store';
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
};

export function DiffView({ conversationId, onClose }: DiffViewProps) {
  const branches = useConversationStore((s) => s.branches);
  const activeBranchId = useConversationStore((s) => s.activeBranchId);
  const user = useAuthStore((s) => s.user);
  const [branchAId, setBranchAId] = useState(activeBranchId ?? '');
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
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900">
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
          <div className="w-px shrink-0 bg-neutral-700" />
          <DiffBranchPanel branchName={diffData.branch_b.name} nodes={diffData.branch_b.nodes} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-500">ブランチを選択して比較してください</p>
        </div>
      )}
    </div>
  );
}
