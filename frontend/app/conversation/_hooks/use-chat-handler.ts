'use client';

import { useCallback } from 'react';
import { useConversationStore } from '@/stores/conversation-store';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';

const API = '/api';

export const useChatHandler = (
  conversationId: string,
  refetchAll: () => Promise<void>,
) => {
  const user = useAuthStore((s) => s.user);
  const activeBranchId = useConversationStore((s) => s.activeBranchId);
  const updateBranchHead = useConversationStore((s) => s.updateBranchHead);
  const updateTitle = useConversationStore((s) => s.updateTitle);

  const setStreaming = useChatStore((s) => s.setStreaming);
  const setPendingUserMessage = useChatStore((s) => s.setPendingUserMessage);
  const appendStreamingContent = useChatStore((s) => s.appendStreamingContent);
  const clearStreamingState = useChatStore((s) => s.clearStreamingState);

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
        const processStream = async () => {
          const result = await reader.read();
          if (result.done) return;
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
          await processStream();
        };
        await processStream();
      }
      clearStreamingState();
    },
    [activeBranchId, conversationId, user, setStreaming, setPendingUserMessage, clearStreamingState, appendStreamingContent, refetchAll, updateBranchHead, updateTitle],
  );

  return { handleSend };
};
