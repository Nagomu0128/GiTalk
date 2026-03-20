import { GitBranch } from 'lucide-react';
import { MessageBubble } from '@/components/chat/message-bubble';
import type { RepoBranch } from './types';

export const ConversationPanel = ({
  branch,
}: {
  readonly branch: RepoBranch | undefined;
}) => {
  if (!branch) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-neutral-500">ブランチを選択してください</p>
      </div>
    );
  }

  if (branch.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-neutral-500">このブランチにはノードがありません</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-6 flex items-center gap-2">
        <GitBranch size={14} className="text-neutral-500" />
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{branch.name}</span>
        <span className="text-xs text-neutral-500">({branch.nodes.length} nodes)</span>
      </div>

      {branch.nodes.map((node) => (
        <div key={node.id} id={`repo-node-${node.id}`}>
          {node.userMessage && (
            <MessageBubble role="user" content={node.userMessage} timestamp={node.originalCreatedAt} />
          )}
          {node.aiResponse && (
            <MessageBubble role="ai" content={node.aiResponse} model={node.model} timestamp={node.originalCreatedAt} />
          )}
        </div>
      ))}
    </div>
  );
};
