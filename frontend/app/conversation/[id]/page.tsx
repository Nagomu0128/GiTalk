'use client';

import { useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChatView } from '@/components/chat/chat-view';
import { TreeView } from '@/components/tree/tree-view';
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
  const updateBranchHead = useConversationStore((s) => s.updateBranchHead);
  const updateTitle = useConversationStore((s) => s.updateTitle);
  const activeBranchId = useConversationStore((s) => s.activeBranchId);

  const setStreaming = useChatStore((s) => s.setStreaming);
  const appendStreamingContent = useChatStore((s) => s.appendStreamingContent);
  const clearStreamingContent = useChatStore((s) => s.clearStreamingContent);
  const getHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  // 会話データを取得
  useEffect(() => {
    const fetchData = async () => {
      const headers = await getHeaders();

      const [convRes, branchesRes, nodesRes] = await Promise.all([
        fetch(`${API}/v1/conversations/${conversationId}`, { headers }),
        fetch(`${API}/v1/conversations/${conversationId}/branches`, { headers }),
        fetch(`${API}/v1/conversations/${conversationId}/nodes`, { headers }),
      ]);

      if (!convRes.ok) {
        router.push('/dashboard');
        return;
      }

      const convData = await convRes.json();
      const branchesData = await branchesRes.json();
      const nodesData = await nodesRes.json();

      setConversation({
        id: convData.id,
        title: convData.title,
        activeBranchId: convData.activeBranchId,
        contextMode: convData.contextMode,
      });
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
      clearStreamingContent();

      const token = await user?.getIdToken();

      const response = await fetch(`${API}/v1/conversations/${conversationId}/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: activeBranchId,
          message,
          model,
          context_mode: contextMode,
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          if (result.value) {
            const text = decoder.decode(result.value);
            const lines = text.split('\n');
            lines.forEach((line) => {
              if (!line.startsWith('data: ')) return;
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'chunk') {
                  appendStreamingContent(data.content);
                } else if (data.type === 'done') {
                  // ノードを再取得してストアを更新
                  getHeaders().then((headers) =>
                    fetch(`${API}/v1/conversations/${conversationId}/nodes`, { headers })
                      .then((res) => res.json())
                      .then((nodesData) => setNodes(nodesData.nodes)),
                  );
                  updateBranchHead(activeBranchId, data.node_id);
                } else if (data.type === 'title_generated') {
                  updateTitle(data.title);
                } else if (data.type === 'error') {
                  console.error('Chat error:', data.code, data.message);
                }
              } catch { /* skip malformed SSE */ }
            });
          }
        }
      }

      setStreaming(false);
      clearStreamingContent();
    },
    [activeBranchId, conversationId, user, getHeaders, setStreaming, clearStreamingContent, appendStreamingContent, setNodes, updateBranchHead, updateTitle],
  );

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
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 hover:text-gray-700">
            ← 戻る
          </button>
          <h1 className="text-lg font-bold">{conversation.title}</h1>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ツリービュー（ノードがある場合のみ表示） */}
        {nodes.length > 0 && (
          <div className="w-1/3 border-r">
            <TreeView />
          </div>
        )}

        {/* チャットビュー */}
        <div className={nodes.length > 0 ? 'flex-1' : 'w-full'}>
          <ChatView onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}
