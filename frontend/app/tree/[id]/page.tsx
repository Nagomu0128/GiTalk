'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSidebar } from '@/app/conversation/_hooks/use-sidebar';
import { useParams, useRouter } from 'next/navigation';
import { ReactFlowProvider, type Node as RFNode } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import type { Branch, ConversationNode, Conversation } from '@/stores/conversation-store';

import type { ContextMenuState, BranchMenuState, MergeState } from '../_components/types';
import { API } from '../_components/types';
import {
  convertBranches,
  convertNodes,
  findSelectedNodeId,
  collectPathMessages,
  buildAllEdges,
  tracePathToRoot,
  buildReactFlowNodes,
  buildReactFlowEdges,
} from '../_components/data-utils';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { Header } from '../_components/header';
import { ChatPanel } from '../_components/chat-panel';
import { NodeContextMenuPopover } from '../_components/context-menu';
import { BranchPopover } from '../_components/branch-menu';
import { NewBranchDialog } from '../_components/new-branch-dialog';
import { RenameBranchDialog } from '../_components/rename-branch-dialog';
import { CherryPickConfirmDialog } from '../_components/cherry-pick-dialog';
import { TreeFlowInner } from '../_components/tree-flow';
import { DiffView } from '@/app/conversation/_compornents/diff-view';

const LoadingView = () => (
  <div className="flex h-screen w-full items-center justify-center bg-neutral-100 dark:bg-neutral-900">
    <div className="text-neutral-400">読み込み中...</div>
  </div>
);

const ErrorView = ({ message, onBack }: { readonly message: string; readonly onBack: () => void }) => (
  <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-neutral-100 dark:bg-neutral-900">
    <div className="text-neutral-400">{message}</div>
    <Button variant="outline" onClick={onBack}>
      会話一覧に戻る
    </Button>
  </div>
);

export default function TreePage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const user = useAuthStore((s) => s.user);

  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebar();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [rawBranches, setRawBranches] = useState<ReadonlyArray<Branch>>([]);
  const [rawNodes, setRawNodes] = useState<ReadonlyArray<ConversationNode>>([]);

  const gitBranches = useMemo(() => convertBranches(rawBranches, conversation?.activeBranchId ?? null), [rawBranches, conversation?.activeBranchId]);
  const gitNodes = useMemo(() => convertNodes(rawNodes, rawBranches), [rawNodes, rawBranches]);
  const selectedNodeId = useMemo(
    () => findSelectedNodeId(rawBranches, conversation?.activeBranchId ?? null),
    [rawBranches, conversation?.activeBranchId],
  );

  const [chatPanelNodeId, setChatPanelNodeId] = useState<string | null>(null);
  const chatPanelMessages = useMemo(
    () => (chatPanelNodeId ? collectPathMessages(chatPanelNodeId, rawNodes) : []),
    [chatPanelNodeId, rawNodes],
  );

  const [newBranchDialog, setNewBranchDialog] = useState<{
    readonly visible: boolean;
    readonly nodeId: string;
    readonly position: { readonly x: number; readonly y: number };
  }>({ visible: false, nodeId: '', position: { x: 0, y: 0 } });
  const [newBranchLoading, setNewBranchLoading] = useState(false);

  const [cherryPickConfirm, setCherryPickConfirm] = useState<{ visible: boolean; nodeId: string }>({ visible: false, nodeId: '' });
  const [renameDialog, setRenameDialog] = useState<{ visible: boolean; branchId: string; currentName: string }>({ visible: false, branchId: '', currentName: '' });
  const [renameLoading, setRenameLoading] = useState(false);
  const [activeSelectedNodeId, setActiveSelectedNodeId] = useState<string | null>(null);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<ReadonlySet<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false, x: 0, y: 0, nodeId: '',
  });
  const [branchMenu, setBranchMenu] = useState<BranchMenuState>({
    visible: false, x: 0, y: 0, branchIndex: -1,
  });
  const [mergeState, setMergeState] = useState<MergeState>({
    status: 'idle', targetBranchIndex: null, sourceBranchIndex: null,
  });
  const [diffView, setDiffView] = useState<{ visible: boolean; branchId: string }>({ visible: false, branchId: '' });

  useEffect(() => {
    if (selectedNodeId) {
      setActiveSelectedNodeId(selectedNodeId);
    }
  }, [selectedNodeId]);

  const maxColumn = gitNodes.length > 0 ? Math.max(...gitNodes.map((n) => n.column)) : 0;
  const allEdges = useMemo(() => buildAllEdges(gitNodes, gitBranches, rawNodes, rawBranches), [gitNodes, gitBranches, rawNodes, rawBranches]);

  const highlightedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    allEdges
      .filter((e) => highlightedEdgeIds.has(e.id))
      .forEach((e) => {
        ids.add(e.fromNodeId);
        ids.add(e.toNodeId);
      });
    return ids;
  }, [allEdges, highlightedEdgeIds]);

  const rfNodes = useMemo(
    () => buildReactFlowNodes(gitNodes, gitBranches, activeSelectedNodeId, highlightedNodeIds, maxColumn, branchMenu.visible, branchMenu.branchIndex, mergeState, rawNodes, rawBranches),
    [gitNodes, gitBranches, activeSelectedNodeId, highlightedNodeIds, maxColumn, branchMenu.visible, branchMenu.branchIndex, mergeState, rawNodes, rawBranches],
  );

  const rfEdges = useMemo(
    () => buildReactFlowEdges(allEdges, highlightedEdgeIds),
    [allEdges, highlightedEdgeIds],
  );

  // --- Data Fetching ---

  const getHeaders = useCallback(async () => {
    const token = await user?.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const refetchAll = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const [branchesRes, nodesRes] = await Promise.all([
        fetch(`${API}/v1/conversations/${conversationId}/branches`, { headers }),
        fetch(`${API}/v1/conversations/${conversationId}/nodes`, { headers }),
      ]);
      if (branchesRes.ok && nodesRes.ok) {
        const [branchesData, nodesData] = await Promise.all([branchesRes.json(), nodesRes.json()]);
        setRawBranches(branchesData.data);
        setRawNodes(nodesData.nodes);
      }
    } catch (err) {
      console.error('Refetch failed:', err);
    }
  }, [conversationId, getHeaders]);

  useEffect(() => {
    if (!user || !conversationId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers = await getHeaders();
        const [convRes, branchesRes, nodesRes] = await Promise.all([
          fetch(`${API}/v1/conversations/${conversationId}`, { headers }),
          fetch(`${API}/v1/conversations/${conversationId}/branches`, { headers }),
          fetch(`${API}/v1/conversations/${conversationId}/nodes`, { headers }),
        ]);

        if (!convRes.ok || !branchesRes.ok || !nodesRes.ok) {
          setError('データの取得に失敗しました');
          return;
        }

        const [convData, branchesData, nodesData] = await Promise.all([
          convRes.json(), branchesRes.json(), nodesRes.json(),
        ]);

        setConversation(convData);
        setRawBranches(branchesData.data);
        setRawNodes(nodesData.nodes);
      } catch {
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, conversationId, getHeaders]);

  const refetchData = useCallback(async () => {
    const headers = await getHeaders();
    const [branchesRes, nodesRes] = await Promise.all([
      fetch(`${API}/v1/conversations/${conversationId}/branches`, { headers }),
      fetch(`${API}/v1/conversations/${conversationId}/nodes`, { headers }),
    ]);
    if (branchesRes.ok && nodesRes.ok) {
      const branchesData = await branchesRes.json();
      const nodesData = await nodesRes.json();
      setRawBranches(branchesData.data);
      setRawNodes(nodesData.nodes);
    }
  }, [conversationId, getHeaders]);

  // --- Event Handlers ---

  const handleNodeClick = useCallback((event: React.MouseEvent, node: RFNode) => {
    event.stopPropagation();
    const nodeId = node.id;
    setActiveSelectedNodeId(nodeId);
    setHighlightedEdgeIds(tracePathToRoot(nodeId, gitNodes, allEdges));
    setContextMenu((prev) =>
      prev.visible && prev.nodeId === nodeId
        ? { ...prev, visible: false }
        : { visible: true, x: event.clientX, y: event.clientY, nodeId },
    );
  }, [gitNodes, allEdges]);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: RFNode) => {
    event.preventDefault();
    event.stopPropagation();
    const nodeId = node.id;
    setActiveSelectedNodeId(nodeId);
    setHighlightedEdgeIds(tracePathToRoot(nodeId, gitNodes, allEdges));
    setContextMenu({ visible: true, x: event.clientX, y: event.clientY, nodeId });
  }, [gitNodes, allEdges]);

  const handleContextMenuAction = useCallback(
    (action: string, nodeId: string) => {
      if (action === 'read') {
        setChatPanelNodeId(nodeId);
        setHighlightedEdgeIds(tracePathToRoot(nodeId, gitNodes, allEdges));
        return;
      }
      if (action === 'new branch') {
        setNewBranchDialog({
          visible: true, nodeId,
          position: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        });
        return;
      }
      if (action === 'cherry-pick') {
        setCherryPickConfirm({ visible: true, nodeId });
        return;
      }
      if (action === 'switch') {
        const targetNode = rawNodes.find((n) => n.id === nodeId);
        if (!targetNode) return;
        const doSwitch = async () => {
          try {
            const headers = await getHeaders();
            const res = await fetch(`${API}/v1/conversations/${conversationId}/switch`, {
              method: 'POST', headers,
              body: JSON.stringify({ branch_id: targetNode.branchId }),
            });
            if (res.ok) {
              setConversation((prev) => prev ? { ...prev, activeBranchId: targetNode.branchId } : prev);
              await refetchAll();
            }
          } catch (err) { console.error('Switch error:', err); }
        };
        doSwitch();
        return;
      }
      console.log(`Action: ${action}, Node: ${nodeId}`);
    },
    [gitNodes, allEdges, conversation?.activeBranchId, conversationId, getHeaders, rawNodes, refetchAll],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleCherryPickConfirm = useCallback(async () => {
    const activeBranchId = conversation?.activeBranchId;
    if (!activeBranchId || !cherryPickConfirm.nodeId) return;
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API}/v1/conversations/${conversationId}/cherry-pick`, {
        method: 'POST', headers,
        body: JSON.stringify({ source_node_id: cherryPickConfirm.nodeId, target_branch_id: activeBranchId }),
      });
      if (res.ok) {
        await refetchAll();
      } else {
        const err = await res.json();
        console.error('Cherry-pick failed:', err.error?.message);
      }
    } catch (err) { console.error('Cherry-pick error:', err); }
    setCherryPickConfirm({ visible: false, nodeId: '' });
  }, [conversation?.activeBranchId, cherryPickConfirm.nodeId, conversationId, getHeaders, refetchAll]);

  const handleCloseChatPanel = useCallback(() => {
    setChatPanelNodeId(null);
    setHighlightedEdgeIds(new Set());
  }, []);

  const handleNewBranchConfirm = useCallback(async (branchName: string) => {
    const nodeId = newBranchDialog.nodeId;
    if (!nodeId) return;
    setNewBranchLoading(true);
    try {
      const headers = await getHeaders();
      const createRes = await fetch(`${API}/v1/conversations/${conversationId}/branches`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: branchName, base_node_id: nodeId }),
      });
      if (!createRes.ok) { console.error('Failed to create branch'); return; }
      const newBranch = await createRes.json();
      await fetch(`${API}/v1/conversations/${conversationId}/switch`, {
        method: 'POST', headers,
        body: JSON.stringify({ branch_id: newBranch.id }),
      });
      setNewBranchDialog({ visible: false, nodeId: '', position: { x: 0, y: 0 } });
      router.push(`/conversation/${conversationId}`);
    } catch (err) { console.error('Failed to create branch:', err); }
    finally { setNewBranchLoading(false); }
  }, [newBranchDialog.nodeId, conversationId, getHeaders, router]);

  const handleNewBranchCancel = useCallback(() => {
    setNewBranchDialog({ visible: false, nodeId: '', position: { x: 0, y: 0 } });
  }, []);

  const handleRenameConfirm = useCallback(async (newName: string) => {
    if (!renameDialog.branchId) return;
    setRenameLoading(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API}/v1/conversations/${conversationId}/branches/${renameDialog.branchId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        setRawBranches((prev) => prev.map((b) => b.id === renameDialog.branchId ? { ...b, name: newName } : b));
        setRenameDialog({ visible: false, branchId: '', currentName: '' });
      }
    } catch (err) { console.error('Failed to rename branch:', err); }
    finally { setRenameLoading(false); }
  }, [renameDialog.branchId, conversationId, getHeaders]);

  const handleBranchLabelClick = useCallback((branchIndex: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setBranchMenu((prev) =>
      prev.visible && prev.branchIndex === branchIndex
        ? { ...prev, visible: false }
        : { visible: true, x: event.clientX, y: event.clientY, branchIndex },
    );
  }, []);

  const handleBranchMenuAction = useCallback(
    async (action: string, branchIndex: number) => {
      const branch = rawBranches[branchIndex];
      if (!branch) return;

      if (action === 'rename') {
        setRenameDialog({ visible: true, branchId: branch.id, currentName: branch.name });
        return;
      }

      if (action === 'diff') {
        setDiffView({ visible: true, branchId: branch.id });
        return;
      }

      if (action === 'merge') {
        // Step 1: select target branch (merge into this branch)
        if (mergeState.status === 'idle') {
          setMergeState({ status: 'selecting-source', targetBranchIndex: branchIndex, sourceBranchIndex: null });
          return;
        }
        // Step 2: select source branch and execute merge
        if (mergeState.status === 'selecting-source' && mergeState.targetBranchIndex !== null) {
          const targetBranch = rawBranches[mergeState.targetBranchIndex];
          if (!targetBranch || branchIndex === mergeState.targetBranchIndex) return;

          setMergeState((prev) => ({ ...prev, status: 'merging', sourceBranchIndex: branchIndex }));

          try {
            const headers = await getHeaders();
            const res = await fetch(`${API}/v1/conversations/${conversationId}/merge`, {
              method: 'POST', headers,
              body: JSON.stringify({
                source_branch_id: branch.id,
                target_branch_id: targetBranch.id,
                summary_strategy: 'detailed',
              }),
            });

            if (res.ok) {
              setMergeState({ status: 'done', targetBranchIndex: null, sourceBranchIndex: null });
              await refetchData();
              setTimeout(() => {
                setMergeState({ status: 'idle', targetBranchIndex: null, sourceBranchIndex: null });
              }, 2000);
            } else {
              const err = await res.json();
              console.error('Merge failed:', err);
              setMergeState({ status: 'idle', targetBranchIndex: null, sourceBranchIndex: null });
            }
          } catch (err) {
            console.error('Merge failed:', err);
            setMergeState({ status: 'idle', targetBranchIndex: null, sourceBranchIndex: null });
          }
          return;
        }
      }
    },
    [rawBranches, mergeState, getHeaders, conversationId, refetchData],
  );

  const handleCloseBranchMenu = useCallback(() => {
    setBranchMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleToggleSidebar = toggleSidebar;

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
    } catch (err) { console.error(err); }
  }, [user, router]);

  const handleDashboard = useCallback(() => { router.push('/dashboard'); }, [router]);
  const handleBack = useCallback(() => { router.push(`/conversation/${conversationId}`); }, [router, conversationId]);
  const handleHelp = useCallback(() => { console.log('Help'); }, []);


  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} onBack={() => router.push('/dashboard')} />;

  return (
    <div className="flex h-screen w-full bg-neutral-100 dark:bg-neutral-900">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={handleToggleSidebar}
        onNewChat={handleNewChat}
        onDashboard={handleDashboard}
        onRepositories={() => router.push('/dashboard/repositories')}
        user={user ? { displayName: user.displayName, email: user.email, photoURL: user.photoURL } : null}
      />

      <div className="flex flex-1 flex-col">
        <Header
          title={conversation?.title ?? ''}
          onBack={handleBack}
          onHelp={handleHelp}
        />

        {mergeState.status !== 'idle' && (
          <div className="flex h-8 shrink-0 items-center justify-center text-sm text-amber-400">
            {mergeState.status === 'selecting-source' && 'mergeを選択してください'}
            {mergeState.status === 'merging' && 'merge中・・・'}
            {mergeState.status === 'done' && 'merge完了！'}
          </div>
        )}

        <div className="relative flex-1 overflow-hidden">
          {gitNodes.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-neutral-500">ノードがありません</div>
          ) : (
            <ReactFlowProvider>
              <TreeFlowInner
                rfNodes={rfNodes}
                rfEdges={rfEdges}
                onNodeClick={handleNodeClick}
                onNodeContextMenu={handleNodeContextMenu}
                onBranchLabelClick={handleBranchLabelClick}
              />
            </ReactFlowProvider>
          )}

          <NodeContextMenuPopover
            state={contextMenu}
            onAction={handleContextMenuAction}
            onClose={handleCloseContextMenu}
          />

          <BranchPopover
            state={branchMenu}
            onAction={handleBranchMenuAction}
            onClose={handleCloseBranchMenu}
          />
        </div>


      </div>

      {chatPanelNodeId && (
        <ChatPanel
          messages={chatPanelMessages}
          onClose={handleCloseChatPanel}
        />
      )}

      <NewBranchDialog
        visible={newBranchDialog.visible}
        loading={newBranchLoading}
        onConfirm={handleNewBranchConfirm}
        onCancel={handleNewBranchCancel}
      />

      <CherryPickConfirmDialog
        visible={cherryPickConfirm.visible}
        onConfirm={handleCherryPickConfirm}
        onCancel={() => setCherryPickConfirm({ visible: false, nodeId: '' })}
      />

      {diffView.visible && (
        <DiffView
          conversationId={conversationId}
          branches={rawBranches}
          initialBranchId={diffView.branchId}
          onClose={() => setDiffView({ visible: false, branchId: '' })}
        />
      )}

      <RenameBranchDialog
        open={renameDialog.visible}
        currentName={renameDialog.currentName}
        loading={renameLoading}
        onSubmit={handleRenameConfirm}
        onClose={() => setRenameDialog({ visible: false, branchId: '', currentName: '' })}
      />
    </div>
  );
}
