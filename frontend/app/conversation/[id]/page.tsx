'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { ConversationHeader } from '@/app/conversation/_compornents/conversation-header';
import { ChatView } from '@/app/conversation/_compornents/chat-view';
import { BranchSelector } from '@/app/conversation/_compornents/branch-selector';
import { NodeContextMenu } from '@/app/conversation/_compornents/node-context-menu';
import { MergeDialog } from '@/app/conversation/_compornents/merge-dialog';
import { DiffView } from '@/app/conversation/_compornents/diff-view';
import { CreateBranchDialog } from '@/app/conversation/_compornents/create-branch-dialog';
import { PushDialog } from '@/app/conversation/_compornents/push-dialog';
import { DeleteDialog } from '@/app/conversation/_compornents/delete-dialog';
import { SearchDialog } from '@/components/layout/search-dialog';
import { useConversationStore } from '@/stores/conversation-store';
import { useAuthStore } from '@/stores/auth-store';
import { useConversationApi } from '@/app/conversation/_hooks/use-conversation-api';
import { useChatHandler } from '@/app/conversation/_hooks/use-chat-handler';
import { useBranchActions } from '@/app/conversation/_hooks/use-branch-actions';
import { useDialogState } from '@/app/conversation/_hooks/use-dialog-state';

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const user = useAuthStore((s) => s.user);
  const conversation = useConversationStore((s) => s.conversation);
  const nodes = useConversationStore((s) => s.nodes);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [convSearchOpen, setConvSearchOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  const { getHeaders, refetchAll } = useConversationApi(conversationId);
  const { handleSend } = useChatHandler(conversationId, refetchAll);
  const {
    mergeLoading,
    branchBaseNodeId,
    handleSwitch,
    handleBranchRequest,
    handleBranchSubmit,
    handleReset,
    handleMerge,
    closeBranchDialog,
  } = useBranchActions(conversationId, getHeaders, refetchAll);
  const dialogs = useDialogState();

  const handleNewChat = useCallback(async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/v1/conversations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新しい会話' }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.id) router.push(`/conversation/${data.id}`);
    } catch (error) { console.error(error); }
  }, [user, router]);

  const handleMergeAndClose = useCallback(async (sourceBranchId: string, targetBranchId: string, strategy: string) => {
    const success = await handleMerge(sourceBranchId, targetBranchId, strategy);
    if (success) dialogs.closeMergeDialog();
  }, [handleMerge, dialogs]);

  const handleDelete = useCallback(async () => {
    const token = await user?.getIdToken();
    if (!token) return;
    const res = await fetch(`/api/v1/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) router.push('/dashboard');
  }, [user, conversationId, router]);

  if (!conversation) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-900">
        <div className="text-neutral-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-neutral-900">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        onNewChat={handleNewChat}
        onDashboard={() => router.push('/dashboard')}
        onRepositories={() => router.push('/dashboard/repositories')}
        user={user ? { displayName: user.displayName, email: user.email, photoURL: user.photoURL } : null}
      />

      <div className="flex flex-1 flex-col">
        <ConversationHeader
          title={conversation.title}
          onBack={() => router.push(`/tree/${conversationId}`)}
          onSearch={() => setConvSearchOpen(true)}
          onHelp={() => console.log('Help')}
          onPush={dialogs.openPushDialog}
          onMore={dialogs.openDeleteDialog}
          branchSelector={
            nodes.length > 0 ? (
              <BranchSelector
                onSwitch={handleSwitch}
                onMerge={dialogs.openMergeDialog}
                onDiff={dialogs.openDiffView}
              />
            ) : null
          }
        />

        <div className="flex-1 overflow-hidden">
          <ChatView onSend={handleSend} />
        </div>
      </div>

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

      {dialogs.showMergeDialog && (
        <MergeDialog
          onMerge={handleMergeAndClose}
          onClose={dialogs.closeMergeDialog}
          isLoading={mergeLoading}
        />
      )}

      {dialogs.showDiffView && (
        <DiffView conversationId={conversationId} onClose={dialogs.closeDiffView} />
      )}

      {dialogs.showPushDialog && (
        <PushDialog conversationId={conversationId} onClose={dialogs.closePushDialog} />
      )}

      {dialogs.showDeleteDialog && (
        <DeleteDialog onDelete={handleDelete} onClose={dialogs.closeDeleteDialog} />
      )}

      {branchBaseNodeId && (
        <CreateBranchDialog
          onSubmit={handleBranchSubmit}
          onClose={closeBranchDialog}
        />
      )}

      <SearchDialog
        open={convSearchOpen}
        onOpenChange={setConvSearchOpen}
        conversationId={conversationId}
      />
    </div>
  );
}
