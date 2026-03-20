'use client';

import { useEffect, useRef } from 'react';
import { MessageBubble } from '@/components/chat/message-bubble';
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
      <div ref={scrollRef} className={`flex-1 overflow-y-auto px-4 py-4 ${isEmpty && !isStreaming ? 'flex items-center justify-center' : ''}`}>
        {isEmpty && !isStreaming ? (
          <p className="text-neutral-500">メッセージを送信して会話を始めましょう</p>
        ) : (
        <div className="mx-auto max-w-3xl">

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

        {/* Pending user message + streaming */}
        {pendingUserMessage && (
          <>
            <MessageBubble role="user" content={pendingUserMessage} />
            {streamingContent ? (
              <MessageBubble role="ai" content={streamingContent} />
            ) : (
              <div className="mb-4 flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-sm font-bold text-neutral-300">
                  G
                </div>
                <div className="rounded-2xl bg-neutral-800 px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-neutral-500">考えています</span>
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        </div>
        )}
      </div>

      <MessageInput onSend={onSend} disabled={isStreaming} />
    </div>
  );
}
