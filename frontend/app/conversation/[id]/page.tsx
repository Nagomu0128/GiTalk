'use client';

import { useEffect, useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatView } from '@/components/chat/chat-view';
import { TreeView } from '@/components/tree/tree-view';
import { BranchSelector } from '@/components/branch/branch-selector';
import { NodeContextMenu } from '@/components/branch/node-context-menu';
import { MergeDialog } from '@/components/dialogs/merge-dialog';
import { DiffView } from '@/components/dialogs/diff-view';
import { CreateBranchDialog } from '@/components/dialogs/create-branch-dialog';
import { PushDialog } from '@/components/dialogs/push-dialog';
import { useConversationStore } from '@/stores/conversation-store';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const user = useAuthStore((s) => s.user);

  const conversation = useConversationStore((s) => s.conversation);
  const nodes = useConversationStore((s) => s.nodes);
  const setConversation = useConversationStore((s) => s.setConversation);
  const setBranches = useConversationStore((s) => s.setBranches);
  const setNodes = useConversationStore((s) => s.setNodes);
  const setActiveBranchId = useConversationStore((s) => s.setActiveBranchId);
  const updateBranchHead = useConversationStore((s) => s.updateBranchHead);
  const updateTitle = useConversationStore((s) => s.updateTitle);
  const activeBranchId = useConversationStore((s) => s.activeBranchId);

  const setStreaming = useChatStore((s) => s.setStreaming);
  const setPendingUserMessage = useChatStore((s) => s.setPendingUserMessage);
  const appendStreamingContent = useChatStore((s) => s.appendStreamingContent);
  const clearStreamingState = useChatStore((s) => s.clearStreamingState);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showDiffView, setShowDiffView] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [branchBaseNodeId, setBranchBaseNodeId] = useState<string | null>(null);
  const [showPushDialog, setShowPushDialog] = useState(false);

  const getHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const refetchAll = useCallback(async () => {
    const headers = await getHeaders();
    const [branchesRes, nodesRes] = await Promise.all([
      fetch(`${API}/v1/conversations/${conversationId}/branches`, { headers }),
      fetch(`${API}/v1/conversations/${conversationId}/nodes`, { headers }),
    ]);
    const branchesData = await branchesRes.json();
    const nodesData = await nodesRes.json();
    setBranches(branchesData.data);
    setNodes(nodesData.nodes);
  }, [conversationId, getHeaders, setBranches, setNodes]);

  // 会話データを取得
  useEffect(() => {
    const fetchData = async () => {
      const headers = await getHeaders();
      const [convRes, branchesRes, nodesRes] = await Promise.all([
        fetch(`${API}/v1/conversations/${conversationId}`, { headers }),
        fetch(`${API}/v1/conversations/${conversationId}/branches`, { headers }),
        fetch(`${API}/v1/conversations/${conversationId}/nodes`, { headers }),
      ]);
      if (!convRes.ok) { router.push('/dashboard'); return; }
      const convData = await convRes.json();
      const branchesData = await branchesRes.json();
      const nodesData = await nodesRes.json();
      setConversation({ id: convData.id, title: convData.title, activeBranchId: convData.activeBranchId, contextMode: convData.contextMode });
      setBranches(branchesData.data);
      setNodes(nodesData.nodes);
    };
    fetchData();
  }, [conversationId, getHeaders, router, setBranches, setConversation, setNodes]);

  // メッセージ送信
  const handleSend = useCallback(
    async (message: string, model: string, contextMode: string) => {
      if (!activeBranchId) return;
      setStreaming(true);
      setPendingUserMessage(message);
      const token = await user?.getIdToken();
      const response = await fetch(`${API}/v1/conversations/${conversationId}/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_id: activeBranchId, message, model, context_mode: contextMode }),
      });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          if (result.value) {
            decoder.decode(result.value).split('\n').forEach((line) => {
              if (!line.startsWith('data: ')) return;
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'chunk') appendStreamingContent(data.content);
                else if (data.type === 'done') { refetchAll(); updateBranchHead(activeBranchId, data.node_id); }
                else if (data.type === 'title_generated') updateTitle(data.title);
                else if (data.type === 'error') console.error('Chat error:', data.code, data.message);
              } catch { /* skip */ }
            });
          }
        }
      }
      clearStreamingState();
    },
    [activeBranchId, conversationId, user, setStreaming, setPendingUserMessage, clearStreamingState, appendStreamingContent, refetchAll, updateBranchHead, updateTitle],
  );

  // Switch
  const handleSwitch = useCallback(async (branchId: string) => {
    const headers = await getHeaders();
    const res = await fetch(`${API}/v1/conversations/${conversationId}/switch`, {
      method: 'POST', headers, body: JSON.stringify({ branch_id: branchId }),
    });
    if (res.ok) { setActiveBranchId(branchId); }
  }, [conversationId, getHeaders, setActiveBranchId]);

  // Branch creation - open dialog
  const handleBranchRequest = useCallback((nodeId: string) => {
    setBranchBaseNodeId(nodeId);
  }, []);

  // Branch creation - submit
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

  // Reset
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

  // Merge
  const handleMerge = useCallback(async (sourceBranchId: string, targetBranchId: string, strategy: string) => {
    setMergeLoading(true);
    const headers = await getHeaders();
    const res = await fetch(`${API}/v1/conversations/${conversationId}/merge`, {
      method: 'POST', headers, body: JSON.stringify({ source_branch_id: sourceBranchId, target_branch_id: targetBranchId, summary_strategy: strategy }),
    });
    setMergeLoading(false);
    if (res.ok) { await refetchAll(); setShowMergeDialog(false); }
    else { const err = await res.json(); alert(err.error?.message ?? 'マージに失敗しました'); }
  }, [conversationId, getHeaders, refetchAll]);

  // Node right-click
  const handleNodeContextMenu = useCallback((nodeId: string, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId });
  }, []);

  if (!conversation) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700">← 戻る</button>
          <h1 className="text-lg font-bold">{conversation.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {nodes.length > 0 && (
            <>
              <BranchSelector
                onSwitch={handleSwitch}
                onMerge={() => setShowMergeDialog(true)}
                onDiff={() => setShowDiffView(true)}
              />
              <button
                onClick={() => setShowPushDialog(true)}
                className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                📦 保存
              </button>
            </>
          )}
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {nodes.length > 0 && (
          <div className="w-1/3 border-r">
            <TreeView onNodeContextMenu={handleNodeContextMenu} />
          </div>
        )}
        <div className={nodes.length > 0 ? 'flex-1' : 'w-full'}>
          <ChatView onSend={handleSend} />
        </div>
      </div>

      {/* コンテキストメニュー */}
      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onBranch={handleBranchRequest}
          onReset={handleReset}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Merge Dialog */}
      {showMergeDialog && (
        <MergeDialog
          onMerge={handleMerge}
          onClose={() => setShowMergeDialog(false)}
          isLoading={mergeLoading}
        />
      )}

      {/* Diff View */}
      {showDiffView && (
        <DiffView conversationId={conversationId} onClose={() => setShowDiffView(false)} />
      )}

      {/* Push Dialog */}
      {showPushDialog && (
        <PushDialog conversationId={conversationId} onClose={() => setShowPushDialog(false)} />
      )}

      {/* Create Branch Dialog */}
      {branchBaseNodeId && (
        <CreateBranchDialog
          onSubmit={handleBranchSubmit}
          onClose={() => setBranchBaseNodeId(null)}
        />
      )}
    </div>
  );
}
