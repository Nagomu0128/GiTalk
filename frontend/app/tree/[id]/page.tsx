'use client';

import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PenLine, Search, LayoutDashboard, ChevronLeft, ArrowLeft, HelpCircle, MessageSquare, X, FolderGit2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import {
  ReactFlow,
  Background,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeTypes,
  type EdgeTypes,
  type NodeProps,
  type EdgeProps,
  useReactFlow,
  ReactFlowProvider,
  getBezierPath,
  getStraightPath,
  BaseEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuthStore } from '@/stores/auth-store';
import type { Branch, ConversationNode, Conversation } from '@/stores/conversation-store';

// --- Types ---

type GitNode = {
  readonly id: string;
  readonly branchIndex: number;
  readonly column: number;
  readonly parentIds: ReadonlyArray<string>;
};

type GitBranch = {
  readonly name: string;
  readonly color: string;
};

type ContextMenuState = {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly nodeId: string;
};

type BranchMenuState = {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly branchIndex: number;
};

type MergeState = {
  readonly status: 'idle' | 'selecting-source' | 'merging' | 'done';
  readonly targetBranchIndex: number | null;
  readonly sourceBranchIndex: number | null;
};

type DotNodeData = {
  dotColor: string;
  isSelected: boolean;
  gitNodeId: string;
};

type BranchLabelNodeData = {
  branchName: string;
  branchIndex: number;
  isSelected: boolean;
  isMergeHighlighted: boolean;
  mergeRole: 'merge-target' | 'merge-source' | null;
  branchColor: string;
};

type ColoredEdgeData = {
  edgeColor: string;
  isHighlighted: boolean;
  edgeType: 'segment' | 'connection';
};

// --- Constants ---

const API = '/api';

const COLUMN_GAP = 40;
const ROW_GAP = 50;
const PADDING_LEFT = 40;
const PADDING_TOP = 40;
const BRANCH_LABEL_WIDTH = 80;
const HIGHLIGHT_COLOR = '#e05050';
const MERGE_LABEL_WIDTH = 120;

const CONTEXT_MENU_ITEMS = ['read', 'switch', 'cherry-pick', 'new branch'] as const;
const BRANCH_MENU_ITEMS = ['merge', 'merge to', 'reset', 'diff', 'clone'] as const;

// --- Data Conversion ---

const hashStringToHue = (str: string): number => {
  const hash = Array.from(str).reduce((acc, char) => {
    const h = ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    return h;
  }, 0);
  return Math.abs(hash) % 360;
};

const computeDepth = (
  nodeId: string,
  nodeMap: ReadonlyMap<string, ConversationNode>,
  depthCache: Map<string, number>,
): number => {
  const cached = depthCache.get(nodeId);
  if (cached !== undefined) return cached;

  const node = nodeMap.get(nodeId);
  if (!node || !node.parentId) {
    depthCache.set(nodeId, 0);
    return 0;
  }

  const depth = computeDepth(node.parentId, nodeMap, depthCache) + 1;
  depthCache.set(nodeId, depth);
  return depth;
};

const convertBranches = (branches: ReadonlyArray<Branch>): ReadonlyArray<GitBranch> =>
  branches.map((branch) => ({
    name: branch.name,
    color: `hsl(${hashStringToHue(branch.id)}, 70%, 50%)`,
  }));

const convertNodes = (
  nodes: ReadonlyArray<ConversationNode>,
  branches: ReadonlyArray<Branch>,
): ReadonlyArray<GitNode> => {
  const branchIdToIndex = new Map(branches.map((b, i) => [b.id, i]));
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const depthCache = new Map<string, number>();

  return nodes.map((node) => ({
    id: node.id,
    branchIndex: branchIdToIndex.get(node.branchId) ?? 0,
    column: computeDepth(node.id, nodeMap, depthCache),
    parentIds: node.parentId ? [node.parentId] : [],
  }));
};

const findSelectedNodeId = (
  branches: ReadonlyArray<Branch>,
  activeBranchId: string | null,
): string | null => {
  const activeBranch = branches.find((b) => b.id === activeBranchId);
  return activeBranch?.headNodeId ?? null;
};

// --- Helper Functions ---

const nodePosition = (node: GitNode) => ({
  x: PADDING_LEFT + node.column * COLUMN_GAP,
  y: PADDING_TOP + node.branchIndex * ROW_GAP,
});

type GraphEdge = {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly edgeType: 'segment' | 'connection';
  readonly defaultColor: string;
};

const buildAllEdges = (
  nodes: ReadonlyArray<GitNode>,
  branches: ReadonlyArray<GitBranch>,
): ReadonlyArray<GraphEdge> => {
  const branchSegments: ReadonlyArray<GraphEdge> = branches.flatMap((branch, branchIdx) => {
    const branchNodes = nodes
      .filter((n) => n.branchIndex === branchIdx)
      .toSorted((a, b) => a.column - b.column);

    return branchNodes.slice(1).map((node, i) => {
      const prev = branchNodes[i];
      return {
        id: `seg-${prev.id}-${node.id}`,
        fromNodeId: prev.id,
        toNodeId: node.id,
        edgeType: 'segment' as const,
        defaultColor: branch.color,
      };
    });
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const connections: ReadonlyArray<GraphEdge> = nodes.flatMap((node) => {
    const results: GraphEdge[] = [];
    node.parentIds.forEach((parentId) => {
      const parent = nodeMap.get(parentId);
      if (!parent || parent.branchIndex === node.branchIndex) return;
      results.push({
        id: `conn-${parentId}-${node.id}`,
        fromNodeId: parentId,
        toNodeId: node.id,
        edgeType: 'connection' as const,
        defaultColor: branches[node.branchIndex].color,
      });
    });
    return results;
  });

  return [...branchSegments, ...connections];
};

const tracePathToRoot = (
  tipNodeId: string,
  nodes: ReadonlyArray<GitNode>,
  edges: ReadonlyArray<GraphEdge>,
): ReadonlySet<string> => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const highlightedEdgeIds = new Set<string>();

  const pathNodeIds = new Set<string>();
  const traverse = (nodeId: string): void => {
    if (pathNodeIds.has(nodeId)) return;
    pathNodeIds.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (!node) return;
    node.parentIds.forEach((pid) => traverse(pid));
  };
  traverse(tipNodeId);

  edges.forEach((edge) => {
    if (pathNodeIds.has(edge.fromNodeId) && pathNodeIds.has(edge.toNodeId)) {
      highlightedEdgeIds.add(edge.id);
    }
  });

  return highlightedEdgeIds;
};

const collectPathMessages = (
  tipNodeId: string,
  rawNodes: ReadonlyArray<ConversationNode>,
): ReadonlyArray<ConversationNode> => {
  const nodeMap = new Map(rawNodes.map((n) => [n.id, n]));
  const path: ConversationNode[] = [];

  const walk = (id: string | null): void => {
    if (!id) return;
    const node = nodeMap.get(id);
    if (!node) return;
    walk(node.parentId);
    path.push(node);
  };

  walk(tipNodeId);
  return path;
};

// --- Custom React Flow Node: DotNode ---

const DotNodeComponent = memo(({ data }: NodeProps<RFNode<DotNodeData>>) => {
  const dotColor = data.dotColor;

  return (
    <div
      className={`flex items-center justify-center h-5 w-5 rounded-full hover:bg-neutral-700 cursor-pointer ${data.isSelected ? 'ring-2 ring-amber-400/50' : ''}`}
    >
      <span className={`block h-3 w-3 rounded-full ${dotColor} transition-colors`} />
    </div>
  );
});
DotNodeComponent.displayName = 'DotNodeComponent';

// --- Custom React Flow Node: BranchLabelNode ---

const BranchLabelNodeComponent = memo(({ data }: NodeProps<RFNode<BranchLabelNodeData>>) => {
  const isMergeHighlighted = data.isMergeHighlighted;

  return (
    <div className="flex items-center gap-1">
      <Badge
        variant="outline"
        className={`h-8 cursor-pointer justify-center transition-colors px-3 ${
          isMergeHighlighted
            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
            : data.isSelected
              ? 'border-amber-500 bg-amber-500/20 text-amber-300'
              : 'border-neutral-600 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-700'
        }`}
      >
        {data.branchName}
      </Badge>
      {data.mergeRole && (
        <span className="text-xs text-amber-400 whitespace-nowrap">
          {data.mergeRole === 'merge-target' ? 'merge to 選択中' : 'merge 選択中'}
        </span>
      )}
    </div>
  );
});
BranchLabelNodeComponent.displayName = 'BranchLabelNodeComponent';

// --- Custom React Flow Edge: ColoredEdge ---

const ColoredEdgeComponent = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  sourcePosition,
  targetPosition,
}: EdgeProps<RFEdge<ColoredEdgeData>>) => {
  const edgeColor = data?.isHighlighted ? HIGHLIGHT_COLOR : (data?.edgeColor ?? '#888');
  const strokeWidth = data?.isHighlighted ? 3 : 2;

  if (data?.edgeType === 'connection') {
    const [edgePath] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      curvature: 0.5,
    });

    return (
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: edgeColor, strokeWidth, transition: 'stroke 0.2s' }}
      />
    );
  }

  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{ stroke: edgeColor, strokeWidth, transition: 'stroke 0.2s' }}
    />
  );
});
ColoredEdgeComponent.displayName = 'ColoredEdgeComponent';

// --- Node & Edge Type registrations ---

const nodeTypes: NodeTypes = {
  dotNode: DotNodeComponent,
  branchLabel: BranchLabelNodeComponent,
};

const edgeTypes: EdgeTypes = {
  coloredEdge: ColoredEdgeComponent,
};

// --- Components ---

const NodePopover = ({
  state,
  onAction,
  onClose,
}: {
  readonly state: ContextMenuState;
  readonly onAction: (action: string, nodeId: string) => void;
  readonly onClose: () => void;
}) => (
  <Popover key={`${state.nodeId}-${state.x}-${state.y}`} open={state.visible} onOpenChange={(open) => { if (!open) onClose(); }}>
    <PopoverTrigger
      className="pointer-events-none fixed h-0 w-0"
      style={{ left: state.x, top: state.y }}
    />
    <PopoverContent
      side="right"
      sideOffset={8}
      align="start"
      className="w-auto min-w-[140px] !rounded-2xl border-neutral-600 bg-neutral-800 p-1"
    >
      {CONTEXT_MENU_ITEMS.map((item) => (
        <Button
          key={item}
          variant="ghost"
          size="sm"
          className="w-full justify-start !rounded-xl text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100"
          onClick={() => {
            onAction(item, state.nodeId);
            onClose();
          }}
        >
          {item}
        </Button>
      ))}
    </PopoverContent>
  </Popover>
);

const BranchPopover = ({
  state,
  onAction,
  onClose,
}: {
  readonly state: BranchMenuState;
  readonly onAction: (action: string, branchIndex: number) => void;
  readonly onClose: () => void;
}) => (
  <Popover key={`branch-${state.branchIndex}-${state.x}-${state.y}`} open={state.visible} onOpenChange={(open) => { if (!open) onClose(); }}>
    <PopoverTrigger
      className="pointer-events-none fixed h-0 w-0"
      style={{ left: state.x, top: state.y }}
    />
    <PopoverContent
      side="right"
      sideOffset={8}
      align="start"
      className="w-auto min-w-[120px] !rounded-2xl border-neutral-600 bg-neutral-800 p-1"
    >
      {BRANCH_MENU_ITEMS.map((item) => (
        <Button
          key={item}
          variant="ghost"
          size="sm"
          className="w-full justify-start !rounded-xl text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100"
          onClick={() => {
            onAction(item, state.branchIndex);
            onClose();
          }}
        >
          {item}
        </Button>
      ))}
    </PopoverContent>
  </Popover>
);

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
}: {
  readonly title: string;
  readonly onBack: () => void;
  readonly onSearch: () => void;
  readonly onHelp: () => void;
}) => (
  <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-700 px-4">
    <button
      onClick={onBack}
      className="flex items-center gap-2 text-sm text-neutral-300 transition-colors hover:text-neutral-100"
    >
      <ArrowLeft size={16} />
      <span>チャットに戻る</span>
    </button>
    <span className="truncate text-sm text-neutral-400">{title}</span>
    <div className="flex items-center gap-2">
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
    </div>
  </header>
);

// --- ChatInput Component ---

const ChatInput = ({
  value,
  onChange,
  onSubmit,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
}) => (
  <div className="shrink-0 px-8 pb-6 pt-2">
    <div className="flex items-center gap-3 rounded-full border border-neutral-600 bg-neutral-800 px-4 py-2.5">
      <MessageSquare size={20} className="shrink-0 text-blue-400" />
      <div className="h-5 w-px bg-neutral-600" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSubmit();
        }}
        placeholder="したいことはありますか？"
        className="flex-1 bg-transparent text-sm text-neutral-200 placeholder-neutral-500 outline-none"
      />
    </div>
  </div>
);

// --- Chat Panel Component ---

const ChatPanel = ({
  messages,
  onClose,
}: {
  readonly messages: ReadonlyArray<ConversationNode>;
  readonly onClose: () => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full w-[420px] shrink-0 flex-col border-l border-neutral-700 bg-neutral-900">
      <div className="flex h-11 shrink-0 items-center justify-end border-b border-neutral-700 px-3">
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
        >
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((node) => (
          <div key={node.id} className="mb-6">
            {/* User message */}
            {node.userMessage && (
              <div className="mb-3 flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-neutral-800 px-4 py-3 text-sm text-neutral-200">
                  {node.userMessage}
                </div>
              </div>
            )}

            {/* AI response */}
            {node.aiResponse && (
              <div className="flex items-start gap-2">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-sm font-bold text-neutral-300">
                  G
                </div>
                <div className="max-w-[85%] rounded-2xl bg-neutral-800 px-4 py-3 text-sm text-neutral-300">
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{DOMPurify.sanitize(node.aiResponse)}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- New Branch Dialog Component ---

const NewBranchDialog = ({
  visible,
  loading,
  onConfirm,
  onCancel,
  position,
}: {
  readonly visible: boolean;
  readonly loading: boolean;
  readonly position: { readonly x: number; readonly y: number };
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) => {
  if (!visible) return null;

  return (
    <div
      className="fixed z-50 rounded-xl border border-neutral-600 bg-neutral-200 px-6 py-5 shadow-xl"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, -50%)' }}
    >
      <p className="mb-4 text-center text-sm text-neutral-800">あたらしいチャットに移動しますか？</p>
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="min-w-[70px] border-neutral-400 bg-white text-neutral-800 hover:bg-neutral-100"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? '...' : 'Yes'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-w-[70px] border-neutral-400 bg-white text-neutral-800 hover:bg-neutral-100"
          onClick={onCancel}
          disabled={loading}
        >
          cancel
        </Button>
      </div>
    </div>
  );
};

// --- Loading Component ---

const LoadingView = () => (
  <div className="flex h-screen w-full items-center justify-center bg-neutral-900">
    <div className="text-neutral-400">読み込み中...</div>
  </div>
);

// --- Error Component ---

const ErrorView = ({ message, onBack }: { readonly message: string; readonly onBack: () => void }) => (
  <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-neutral-900">
    <div className="text-neutral-400">{message}</div>
    <Button variant="outline" onClick={onBack}>
      ダッシュボードに戻る
    </Button>
  </div>
);

// --- Build React Flow nodes and edges ---

const buildReactFlowNodes = (
  gitNodes: ReadonlyArray<GitNode>,
  gitBranches: ReadonlyArray<GitBranch>,
  activeSelectedNodeId: string | null,
  highlightedNodeIds: ReadonlySet<string>,
  maxColumn: number,
  branchMenuVisible: boolean,
  branchMenuBranchIndex: number,
  mergeState: MergeState,
): RFNode[] => {
  const dotNodes: RFNode<DotNodeData>[] = gitNodes.map((node) => {
    const pos = nodePosition(node);
    const isSelected = node.id === activeSelectedNodeId;
    const isOnPath = highlightedNodeIds.has(node.id);
    const dotColor = isSelected
      ? 'bg-amber-400'
      : isOnPath
        ? 'bg-red-500'
        : 'bg-neutral-400';

    return {
      id: node.id,
      type: 'dotNode',
      position: { x: pos.x - 10, y: pos.y - 10 },
      data: {
        dotColor,
        isSelected,
        gitNodeId: node.id,
      },
      draggable: false,
      connectable: false,
    };
  });

  const branchLabelNodes: RFNode<BranchLabelNodeData>[] = gitBranches.map((branch, index) => {
    const x = PADDING_LEFT + (maxColumn + 1.5) * COLUMN_GAP;
    const y = PADDING_TOP + index * ROW_GAP;
    const mergeRole =
      mergeState.targetBranchIndex === index
        ? ('merge-target' as const)
        : mergeState.sourceBranchIndex === index
          ? ('merge-source' as const)
          : null;

    return {
      id: `branch-label-${index}`,
      type: 'branchLabel',
      position: { x: x, y: y - 16 },
      data: {
        branchName: branch.name,
        branchIndex: index,
        isSelected: branchMenuVisible && branchMenuBranchIndex === index,
        isMergeHighlighted: mergeRole !== null,
        mergeRole,
        branchColor: branch.color,
      },
      draggable: false,
      connectable: false,
    };
  });

  return [...dotNodes, ...branchLabelNodes];
};

const buildReactFlowEdges = (
  allEdges: ReadonlyArray<GraphEdge>,
  highlightedEdgeIds: ReadonlySet<string>,
): RFEdge<ColoredEdgeData>[] => {
  return allEdges.map((edge) => {
    const isHighlighted = highlightedEdgeIds.has(edge.id);
    return {
      id: edge.id,
      source: edge.fromNodeId,
      target: edge.toNodeId,
      type: 'coloredEdge',
      data: {
        edgeColor: edge.defaultColor,
        isHighlighted,
        edgeType: edge.edgeType,
      },
    };
  });
};

// --- Inner Tree Component (needs ReactFlowProvider context) ---

const TreeFlowInner = ({
  rfNodes,
  rfEdges,
  onNodeClick,
  onNodeContextMenu,
  onBranchLabelClick,
}: {
  readonly rfNodes: RFNode[];
  readonly rfEdges: RFEdge[];
  readonly onNodeClick: (event: React.MouseEvent, node: RFNode) => void;
  readonly onNodeContextMenu: (event: React.MouseEvent, node: RFNode) => void;
  readonly onBranchLabelClick: (branchIndex: number, event: React.MouseEvent) => void;
}) => {
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      if (node.type === 'branchLabel') {
        const data = node.data as BranchLabelNodeData;
        onBranchLabelClick(data.branchIndex, event);
        return;
      }
      onNodeClick(event, node);
    },
    [onNodeClick, onBranchLabelClick],
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: RFNode) => {
      if (node.type === 'dotNode') {
        event.preventDefault();
        onNodeContextMenu(event, node);
      }
    },
    [onNodeContextMenu],
  );

  return (
    <ReactFlow
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={handleNodeClick}
      onNodeContextMenu={handleNodeContextMenu}
      nodesConnectable={false}
      nodesDraggable={false}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.3}
      maxZoom={3}
      proOptions={{ hideAttribution: true }}
      style={{ background: 'transparent' }}
    >
      <Background color="#404040" gap={20} size={1} />
    </ReactFlow>
  );
};

// --- Page Component ---

export default function TreePage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const user = useAuthStore((s) => s.user);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [rawBranches, setRawBranches] = useState<ReadonlyArray<Branch>>([]);
  const [rawNodes, setRawNodes] = useState<ReadonlyArray<ConversationNode>>([]);

  const gitBranches = useMemo(() => convertBranches(rawBranches), [rawBranches]);
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
  const [activeSelectedNodeId, setActiveSelectedNodeId] = useState<string | null>(null);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<ReadonlySet<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    nodeId: '',
  });
  const [branchMenu, setBranchMenu] = useState<BranchMenuState>({
    visible: false,
    x: 0,
    y: 0,
    branchIndex: -1,
  });
  const [mergeState, setMergeState] = useState<MergeState>({
    status: 'idle',
    targetBranchIndex: null,
    sourceBranchIndex: null,
  });

  // Sync selectedNodeId from data when it changes
  useEffect(() => {
    if (selectedNodeId) {
      setActiveSelectedNodeId(selectedNodeId);
    }
  }, [selectedNodeId]);

  const maxColumn = gitNodes.length > 0 ? Math.max(...gitNodes.map((n) => n.column)) : 0;

  const allEdges = useMemo(() => buildAllEdges(gitNodes, gitBranches), [gitNodes, gitBranches]);

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

  // Build React Flow nodes and edges
  const rfNodes = useMemo(
    () =>
      buildReactFlowNodes(
        gitNodes,
        gitBranches,
        activeSelectedNodeId,
        highlightedNodeIds,
        maxColumn,
        branchMenu.visible,
        branchMenu.branchIndex,
        mergeState,
      ),
    [gitNodes, gitBranches, activeSelectedNodeId, highlightedNodeIds, maxColumn, branchMenu.visible, branchMenu.branchIndex, mergeState],
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
    } catch (error) {
      console.error('Refetch failed:', error);
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
          convRes.json(),
          branchesRes.json(),
          nodesRes.json(),
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
        const newHighlighted = tracePathToRoot(nodeId, gitNodes, allEdges);
        setHighlightedEdgeIds(newHighlighted);
        return;
      }
      if (action === 'new branch') {
        setNewBranchDialog({
          visible: true,
          nodeId,
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
              method: 'POST',
              headers,
              body: JSON.stringify({ branch_id: targetNode.branchId }),
            });
            if (res.ok) {
              await refetchAll();
            }
          } catch (error) {
            console.error('Switch error:', error);
          }
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
        method: 'POST',
        headers,
        body: JSON.stringify({ source_node_id: cherryPickConfirm.nodeId, target_branch_id: activeBranchId }),
      });
      if (res.ok) {
        await refetchAll();
      } else {
        const err = await res.json();
        console.error('Cherry-pick failed:', err.error?.message);
      }
    } catch (error) {
      console.error('Cherry-pick error:', error);
    }
    setCherryPickConfirm({ visible: false, nodeId: '' });
  }, [conversation?.activeBranchId, cherryPickConfirm.nodeId, conversationId, getHeaders, refetchAll]);

  const handleCloseChatPanel = useCallback(() => {
    setChatPanelNodeId(null);
    setHighlightedEdgeIds(new Set());
  }, []);

  const handleNewBranchConfirm = useCallback(async () => {
    const nodeId = newBranchDialog.nodeId;
    if (!nodeId) return;

    setNewBranchLoading(true);
    try {
      const headers = await getHeaders();
      const branchName = `branch-${Date.now()}`;

      const createRes = await fetch(`${API}/v1/conversations/${conversationId}/branches`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: branchName, base_node_id: nodeId }),
      });

      if (!createRes.ok) {
        console.error('Failed to create branch');
        return;
      }

      const newBranch = await createRes.json();

      await fetch(`${API}/v1/conversations/${conversationId}/switch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ branch_id: newBranch.id }),
      });

      setNewBranchDialog({ visible: false, nodeId: '', position: { x: 0, y: 0 } });
      router.push(`/conversation/${conversationId}`);
    } catch (err) {
      console.error('Failed to create branch:', err);
    } finally {
      setNewBranchLoading(false);
    }
  }, [newBranchDialog.nodeId, conversationId, getHeaders, router]);

  const handleNewBranchCancel = useCallback(() => {
    setNewBranchDialog({ visible: false, nodeId: '', position: { x: 0, y: 0 } });
  }, []);

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

      if (action === 'merge to') {
        setMergeState({
          status: 'selecting-source',
          targetBranchIndex: branchIndex,
          sourceBranchIndex: null,
        });
        return;
      }

      if (action === 'merge') {
        if (mergeState.status === 'selecting-source' && mergeState.targetBranchIndex !== null) {
          const targetBranch = rawBranches[mergeState.targetBranchIndex];
          if (!targetBranch || branchIndex === mergeState.targetBranchIndex) return;

          setMergeState((prev) => ({
            ...prev,
            status: 'merging',
            sourceBranchIndex: branchIndex,
          }));

          try {
            const headers = await getHeaders();
            const res = await fetch(`${API}/v1/conversations/${conversationId}/merge`, {
              method: 'POST',
              headers,
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

      console.log(`Branch action: ${action}, Branch: ${branch.name} (${branch.id})`);
    },
    [rawBranches, mergeState, getHeaders, conversationId, refetchData],
  );

  const handleCloseBranchMenu = useCallback(() => {
    setBranchMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

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

  const handleSearch = useCallback(() => {
    console.log('Search');
  }, []);

  const handleDashboard = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  const handleBack = useCallback(() => {
    router.push(`/conversation/${conversationId}`);
  }, [router, conversationId]);

  const handleHelp = useCallback(() => {
    console.log('Help');
  }, []);

  const handleChatSubmit = useCallback(() => {
    if (!chatInput.trim()) return;
    console.log('Submit:', chatInput);
    setChatInput('');
  }, [chatInput]);

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} onBack={() => router.push('/dashboard')} />;

  return (
    <div className="flex h-screen w-full bg-neutral-900">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleToggleSidebar}
        onNewChat={handleNewChat}
        onSearch={handleSearch}
        onDashboard={handleDashboard}
        onRepositories={() => router.push('/dashboard/repositories')}
      />

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <Header
          title={conversation?.title ?? ''}
          onBack={handleBack}
          onSearch={handleSearch}
          onHelp={handleHelp}
        />

        {/* Merge status message */}
        {mergeState.status !== 'idle' && (
          <div className="flex h-8 shrink-0 items-center justify-center text-sm text-amber-400">
            {mergeState.status === 'selecting-source' && 'mergeを選択してください'}
            {mergeState.status === 'merging' && 'merge中・・・'}
            {mergeState.status === 'done' && 'merge完了！'}
          </div>
        )}

        {/* Tree area */}
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

          {/* Node Popover */}
          <NodePopover
            state={contextMenu}
            onAction={handleContextMenuAction}
            onClose={handleCloseContextMenu}
          />

          {/* Branch Popover */}
          <BranchPopover
            state={branchMenu}
            onAction={handleBranchMenuAction}
            onClose={handleCloseBranchMenu}
          />
        </div>

        {/* Chat Input */}
        <ChatInput
          value={chatInput}
          onChange={setChatInput}
          onSubmit={handleChatSubmit}
        />
      </div>

      {/* Chat Panel */}
      {chatPanelNodeId && (
        <ChatPanel
          messages={chatPanelMessages}
          onClose={handleCloseChatPanel}
        />
      )}

      {/* New Branch Dialog */}
      <NewBranchDialog
        visible={newBranchDialog.visible}
        loading={newBranchLoading}
        position={newBranchDialog.position}
        onConfirm={handleNewBranchConfirm}
        onCancel={handleNewBranchCancel}
      />

      {/* Cherry-pick Confirm */}
      {cherryPickConfirm.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-800 p-6 shadow-xl">
            <h3 className="mb-2 text-base font-bold text-neutral-100">このコンテキストを取り込みますか？</h3>
            <p className="mb-5 text-sm text-neutral-400">
              選択したノードの内容を現在のアクティブブランチにコピーします。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-400 hover:text-neutral-200"
                onClick={() => setCherryPickConfirm({ visible: false, nodeId: '' })}
              >
                キャンセル
              </Button>
              <Button
                size="sm"
                className="bg-amber-500 text-neutral-900 hover:bg-amber-400"
                onClick={handleCherryPickConfirm}
              >
                取り込む
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
