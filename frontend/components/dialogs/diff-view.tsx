'use client';

import { useState } from 'react';
import { useConversationStore, type ConversationNode } from '@/stores/conversation-store';
import { useAuthStore } from '@/stores/auth-store';
import { MessageBubble } from '../chat/message-bubble';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

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

  const fetchDiff = async () => {
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
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-lg font-bold">ブランチ比較</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕ 閉じる</button>
      </div>

      <div className="flex items-center gap-4 border-b px-4 py-2">
        <select
          value={branchAId}
          onChange={(e) => setBranchAId(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>🌿 {b.name}</option>
          ))}
        </select>
        <span className="text-gray-400">↔</span>
        <select
          value={branchBId}
          onChange={(e) => setBranchBId(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">ブランチを選択...</option>
          {branches.filter((b) => b.id !== branchAId).map((b) => (
            <option key={b.id} value={b.id}>🌿 {b.name}</option>
          ))}
        </select>
        <button
          onClick={fetchDiff}
          disabled={!branchBId || loading}
          className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '比較中...' : '比較する'}
        </button>
      </div>

      {diffData && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto border-r p-4">
            <h3 className="mb-3 text-sm font-bold text-gray-600">🌿 {diffData.branch_a.name}</h3>
            {diffData.branch_a.nodes.length === 0 && (
              <p className="text-sm text-gray-400">分岐後のノードはありません</p>
            )}
            {diffData.branch_a.nodes.map((node: ConversationNode) => (
              <div key={node.id}>
                <MessageBubble role="user" content={node.userMessage} />
                <MessageBubble role="ai" content={node.aiResponse} model={node.model} />
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="mb-3 text-sm font-bold text-gray-600">🌿 {diffData.branch_b.name}</h3>
            {diffData.branch_b.nodes.length === 0 && (
              <p className="text-sm text-gray-400">分岐後のノードはありません</p>
            )}
            {diffData.branch_b.nodes.map((node: ConversationNode) => (
              <div key={node.id}>
                <MessageBubble role="user" content={node.userMessage} />
                <MessageBubble role="ai" content={node.aiResponse} model={node.model} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
