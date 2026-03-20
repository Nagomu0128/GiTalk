'use client';

import { useCallback, useState } from 'react';
import { useConversationStore } from '@/stores/conversation-store';

const API = '/api';

export const useBranchActions = (
  conversationId: string,
  getHeaders: () => Promise<Record<string, string>>,
  refetchAll: () => Promise<void>,
) => {
  const activeBranchId = useConversationStore((s) => s.activeBranchId);
  const setActiveBranchId = useConversationStore((s) => s.setActiveBranchId);

  const [mergeLoading, setMergeLoading] = useState(false);
  const [branchBaseNodeId, setBranchBaseNodeId] = useState<string | null>(null);

  const handleSwitch = useCallback(async (branchId: string) => {
    const headers = await getHeaders();
    const res = await fetch(`${API}/v1/conversations/${conversationId}/switch`, {
      method: 'POST', headers, body: JSON.stringify({ branch_id: branchId }),
    });
    if (res.ok) { setActiveBranchId(branchId); }
  }, [conversationId, getHeaders, setActiveBranchId]);

  const handleBranchRequest = useCallback((nodeId: string) => {
    setBranchBaseNodeId(nodeId);
  }, []);

  const handleBranchSubmit = useCallback(async (name: string) => {
    if (!branchBaseNodeId) return;
    const headers = await getHeaders();
    const res = await fetch(`${API}/v1/conversations/${conversationId}/branches`, {
      method: 'POST', headers, body: JSON.stringify({ name, base_node_id: branchBaseNodeId }),
    });
    if (res.ok) {
      const branch = await res.json();
      setBranchBaseNodeId(null);
      await refetchAll();
      await handleSwitch(branch.id);
    } else {
      const err = await res.json();
      alert(err.error?.message ?? 'ブランチ作成に失敗しました');
    }
  }, [branchBaseNodeId, conversationId, getHeaders, refetchAll, handleSwitch]);

  const handleReset = useCallback(async (nodeId: string) => {
    if (!activeBranchId) return;
    if (!confirm('このノードまで戻しますか？')) return;
    const headers = await getHeaders();
    const res = await fetch(`${API}/v1/conversations/${conversationId}/reset`, {
      method: 'POST', headers, body: JSON.stringify({ branch_id: activeBranchId, target_node_id: nodeId }),
    });
    if (res.ok) { await refetchAll(); }
    else { const err = await res.json(); alert(err.error?.message ?? 'リセットに失敗しました'); }
  }, [activeBranchId, conversationId, getHeaders, refetchAll]);

  const handleMerge = useCallback(async (sourceBranchId: string, targetBranchId: string, strategy: string) => {
    setMergeLoading(true);
    const headers = await getHeaders();
    const res = await fetch(`${API}/v1/conversations/${conversationId}/merge`, {
      method: 'POST', headers, body: JSON.stringify({ source_branch_id: sourceBranchId, target_branch_id: targetBranchId, summary_strategy: strategy }),
    });
    setMergeLoading(false);
    if (res.ok) { await refetchAll(); return true; }
    const err = await res.json();
    alert(err.error?.message ?? 'マージに失敗しました');
    return false;
  }, [conversationId, getHeaders, refetchAll]);

  return {
    mergeLoading,
    branchBaseNodeId,
    handleSwitch,
    handleBranchRequest,
    handleBranchSubmit,
    handleReset,
    handleMerge,
    closeBranchDialog: () => setBranchBaseNodeId(null),
  };
};
