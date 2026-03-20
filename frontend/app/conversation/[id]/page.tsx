'use client';

import { useEffect, useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PenLine, Search, LayoutDashboard, ChevronLeft, ArrowLeft, HelpCircle, MoreVertical, FolderGit2 } from 'lucide-react';
import { ChatView } from '@/components/chat/chat-view';
import { BranchSelector } from '@/components/branch/branch-selector';
import { NodeContextMenu } from '@/components/branch/node-context-menu';
import { MergeDialog } from '@/components/dialogs/merge-dialog';
import { DiffView } from '@/components/dialogs/diff-view';
import { CreateBranchDialog } from '@/components/dialogs/create-branch-dialog';
import { PushDialog } from '@/components/dialogs/push-dialog';
import { useConversationStore } from '@/stores/conversation-store';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';

const API = '/api';

// --- Sidebar Component ---

const Sidebar = ({
  collapsed,
  onToggle,
  onNewChat,
  onSearch,
  onDashboard,
  onRepositories,
}: {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly onNewChat: () => void;
  readonly onSearch: () => void;
  readonly onDashboard: () => void;
  readonly onRepositories: () => void;
}) => (
  <aside
    className={`flex h-full shrink-0 flex-col border-r border-neutral-700 bg-neutral-950 transition-all ${
      collapsed ? 'w-12' : 'w-64'
    }`}
  >
    <button
      onClick={onToggle}
      className="flex h-10 items-center justify-end px-3 text-neutral-400 transition-colors hover:text-neutral-200"
    >
      <ChevronLeft
        size={18}
        className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
      />
    </button>

    <nav className="flex flex-col gap-1 px-2">
      <button
        onClick={onNewChat}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <PenLine size={16} className="shrink-0" />
        {!collapsed && <span>新規チャットを作る</span>}
      </button>

      <button
        onClick={onSearch}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <Search size={16} className="shrink-0" />
        {!collapsed && <span>検索</span>}
      </button>

      <button
        onClick={onDashboard}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <LayoutDashboard size={16} className="shrink-0" />
        {!collapsed && <span>Dash Board</span>}
      </button>

      <button
        onClick={onRepositories}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <FolderGit2 size={16} className="shrink-0" />
        {!collapsed && <span>リポジトリ</span>}
      </button>
    </nav>
  </aside>
);

// --- Header Component ---

const Header = ({
  title,
  onBack,
  onSearch,
  onHelp,
  onMore,
  branchSelector,
}: {
  readonly title: string;
  readonly onBack: () => void;
  readonly onSearch: () => void;
  readonly onHelp: () => void;
  readonly onMore: () => void;
  readonly branchSelector: React.ReactNode;
}) => (
  <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-700 px-4">
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-neutral-300 transition-colors hover:text-neutral-100"
      >
        <ArrowLeft size={16} />
        <span>チャットに戻る</span>
      </button>
      <span className="text-neutral-600">|</span>
      <span className="truncate text-sm text-neutral-400">{title}</span>
    </div>
    <div className="flex items-center gap-2">
      {branchSelector}
      <button
        onClick={onSearch}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-600 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
      >
        <Search size={14} />
      </button>
      <button
        onClick={onHelp}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-600 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
      >
        <HelpCircle size={14} />
      </button>
      <button
        onClick={onMore}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-600 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
      >
        <MoreVertical size={14} />
      </button>
    </div>
  </header>
);

// --- Page Component ---

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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  // Fetch conversation data
  useEffect(() => {
    const fetchData = async () => {
      const headers = await getHeaders();
      const [convRes, branchesRes, nodesRes] = await Promise.all([
        fetch(`${API}/v1/conversations/${conversationId}`, { headers }),
        fetch(`${API}/v1/conversations/${conversationId}/branches`, { headers }),
        fetch(`${API}/v1/conversations/${conversationId}/nodes`, { headers }),
      ]);
      if (!convRes.ok) {
        console.error('Failed to load conversation:', convRes.status);
        router.push('/dashboard');
        return;
      }
      const convData = await convRes.json();
      const branchesData = await branchesRes.json();
      const nodesData = await nodesRes.json();
      setConversation({ id: convData.id, title: convData.title, activeBranchId: convData.activeBranchId, contextMode: convData.contextMode });
      setBranches(branchesData.data);
      setNodes(nodesData.nodes);
    };
    fetchData();
  }, [conversationId, getHeaders, router, setBranches, setConversation, setNodes]);

  // Send message
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

  // Switch branch
  const handleSwitch = useCallback(async (branchId: string) => {
    const headers = await getHeaders();
    const res = await fetch(`${API}/v1/conversations/${conversationId}/switch`, {
      method: 'POST', headers, body: JSON.stringify({ branch_id: branchId }),
    });
    if (res.ok) { setActiveBranchId(branchId); }
  }, [conversationId, getHeaders, setActiveBranchId]);

  // Branch creation
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

  // Navigation
  const handleBack = useCallback(() => {
    router.push(`/tree/${conversationId}`);
  }, [router, conversationId]);

  const handleDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  if (!conversation) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-900">
        <div className="text-neutral-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-neutral-900">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        onNewChat={async () => {
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
        }}
        onSearch={() => console.log('Search')}
        onDashboard={handleDashboard}
        onRepositories={() => router.push('/dashboard/repositories')}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <Header
          title={conversation.title}
          onBack={handleBack}
          onSearch={() => console.log('Search')}
          onHelp={() => console.log('Help')}
          onMore={() => setShowPushDialog(true)}
          branchSelector={
            nodes.length > 0 ? (
              <BranchSelector
                onSwitch={handleSwitch}
                onMerge={() => setShowMergeDialog(true)}
                onDiff={() => setShowDiffView(true)}
              />
            ) : null
          }
        />

        {/* Chat area */}
        <div className="flex-1 overflow-hidden">
          <ChatView onSend={handleSend} />
        </div>
      </div>

      {/* Context menu */}
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
