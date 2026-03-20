import { GitBranch } from 'lucide-react';
import { MessageBubble } from '@/components/chat/message-bubble';
import type { ConversationNode } from '@/stores/conversation-store';

type DiffBranchPanelProps = {
  readonly branchName: string;
  readonly nodes: ReadonlyArray<ConversationNode>;
};

export const DiffBranchPanel = ({ branchName, nodes }: DiffBranchPanelProps) => (
  <div className="flex flex-1 flex-col overflow-hidden">
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-neutral-200 px-4 dark:border-neutral-700">
      <GitBranch size={14} className="text-neutral-500" />
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{branchName}</span>
      <span className="text-xs text-neutral-500">({nodes.length} nodes)</span>
    </div>
    <div className="flex-1 overflow-y-auto">
      {nodes.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-neutral-500">分岐後のノードはありません</p>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl px-4 py-4">
          {nodes.map((node) => (
            <div key={node.id}>
              <MessageBubble role="user" content={node.userMessage} timestamp={node.createdAt} />
              <MessageBubble role="ai" content={node.aiResponse} model={node.model} timestamp={node.createdAt} />
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);
