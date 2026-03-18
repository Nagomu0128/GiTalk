'use client';

import { useEffect, useRef } from 'react';
import { MessageBubble } from './message-bubble';
import { MessageInput } from './message-input';
import { useConversationStore, type ConversationNode } from '@/stores/conversation-store';
import { useChatStore } from '@/stores/chat-store';

type ChatViewProps = {
  readonly onSend: (message: string, model: string, contextMode: string) => void;
};

const getNodesForActiveBranch = (
  nodes: ReadonlyArray<ConversationNode>,
  headNodeId: string | null,
): ReadonlyArray<ConversationNode> => {
  if (!headNodeId) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const path: ConversationNode[] = [];

  const traverse = (id: string | null): void => {
    if (!id) return;
    const node = nodeMap.get(id);
    if (!node) return;
    traverse(node.parentId);
    path.push(node);
  };

  traverse(headNodeId);
  return path;
};

export function ChatView({ onSend }: ChatViewProps) {
  const nodes = useConversationStore((s) => s.nodes);
  const branches = useConversationStore((s) => s.branches);
  const activeBranchId = useConversationStore((s) => s.activeBranchId);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const pendingUserMessage = useChatStore((s) => s.pendingUserMessage);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const branchNodes = getNodesForActiveBranch(nodes, activeBranch?.headNodeId ?? null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [branchNodes.length, streamingContent, pendingUserMessage]);

  const isEmpty = branchNodes.length === 0 && !pendingUserMessage;

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {isEmpty && !isStreaming && (
          <div className="flex h-full items-center justify-center text-gray-400">
            <p>メッセージを送信して会話を始めましょう</p>
          </div>
        )}

        {branchNodes.map((node) => (
          <div key={node.id}>
            <MessageBubble
              role="user"
              content={node.userMessage}
              timestamp={node.createdAt}
            />
            <MessageBubble
              role="ai"
              content={node.aiResponse}
              model={node.model}
              timestamp={node.createdAt}
            />
          </div>
        ))}

        {/* 送信直後: ユーザーメッセージを即座に表示 */}
        {pendingUserMessage && (
          <>
            <MessageBubble role="user" content={pendingUserMessage} />
            {streamingContent ? (
              <MessageBubble role="ai" content={streamingContent} />
            ) : (
              <div className="mb-4 flex justify-start">
                <div className="rounded-2xl bg-gray-100 px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">🤖 AIが考えています</span>
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <MessageInput onSend={onSend} disabled={isStreaming} />
    </div>
  );
}
