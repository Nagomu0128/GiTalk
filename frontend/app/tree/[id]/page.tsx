'use client';

import { useState, useCallback, useMemo, useRef, useEffect, type WheelEvent as ReactWheelEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PenLine, Search, LayoutDashboard, ChevronLeft, ArrowLeft, HelpCircle, MessageSquare, X, FolderGit2 } from 'lucide-react';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
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

type ViewBox = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

type GraphEdge = {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly edgeType: 'segment' | 'connection';
  readonly defaultColor: string;
};

// --- Constants ---

const API = '/api';

const NODE_RADIUS = 6;
const COLUMN_GAP = 40;
const ROW_GAP = 50;
const PADDING_LEFT = 40;
const PADDING_TOP = 40;
const BRANCH_LABEL_WIDTH = 80;
const HIGHLIGHT_COLOR = '#e05050';

const ZOOM_SENSITIVITY = 0.01;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

const CONTEXT_MENU_ITEMS = ['read', 'switch', 'cherry-pick', 'new branch'] as const;
const BRANCH_MENU_ITEMS = ['merge', 'merge to', 'reset', 'diff', 'clone'] as const;

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

const buildAllEdges = (
  nodes: ReadonlyArray<GitNode>,
  branches: ReadonlyArray<GitBranch>,
): ReadonlyArray<GraphEdge> => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const branchSegments: ReadonlyArray<GraphEdge> = branches.flatMap((branch, branchIdx) => {
    const branchNodes = nodes
      .filter((n) => n.branchIndex === branchIdx)
      .toSorted((a, b) => a.column - b.column);

    return branchNodes.slice(1).map((node, i) => {
      const prev = branchNodes[i];
      const from = nodePosition(prev);
      const to = nodePosition(node);
      return {
        id: `seg-${prev.id}-${node.id}`,
        fromNodeId: prev.id,
        toNodeId: node.id,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        edgeType: 'segment' as const,
        defaultColor: branch.color,
      };
    });
  });

  const connections: ReadonlyArray<GraphEdge> = nodes.flatMap((node) => {
    const results: GraphEdge[] = [];
    node.parentIds.forEach((parentId) => {
      const parent = nodeMap.get(parentId);
      if (!parent || parent.branchIndex === node.branchIndex) return;
      const from = nodePosition(parent);
      const to = nodePosition(node);
      results.push({
        id: `conn-${parentId}-${node.id}`,
        fromNodeId: parentId,
        toNodeId: node.id,
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
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

// --- Components ---

const EdgeLine = ({
  edge,
  isHighlighted,
}: {
  readonly edge: GraphEdge;
  readonly isHighlighted: boolean;
}) => {
  const strokeColor = isHighlighted ? HIGHLIGHT_COLOR : edge.defaultColor;

  if (edge.edgeType === 'segment') {
    return (
      <line
        x1={edge.fromX}
        y1={edge.fromY}
        x2={edge.toX}
        y2={edge.toY}
        stroke={strokeColor}
        strokeWidth={isHighlighted ? 3 : 2}
        className="transition-colors"
      />
    );
  }

  const midX = edge.fromX + COLUMN_GAP * 0.5;
  const d = `M ${edge.fromX} ${edge.fromY} C ${midX} ${edge.fromY}, ${midX} ${edge.toY}, ${edge.toX} ${edge.toY}`;

  return (
    <path
      d={d}
      stroke={strokeColor}
      strokeWidth={isHighlighted ? 3 : 2}
      fill="none"
      className="transition-colors"
    />
  );
};

const NODE_FO_SIZE = 28;

const NodeDot = ({
  node,
  isSelected,
  isOnHighlightedPath,
  onClick,
}: {
  readonly node: GitNode;
  readonly isSelected: boolean;
  readonly isOnHighlightedPath: boolean;
  readonly onClick: (nodeId: string, event: React.MouseEvent) => void;
}) => {
  const { x, y } = nodePosition(node);
  const dotColor = isSelected
    ? 'bg-amber-400'
    : isOnHighlightedPath
      ? 'bg-red-500'
      : 'bg-neutral-400';

  return (
    <foreignObject
      x={x - NODE_FO_SIZE / 2}
      y={y - NODE_FO_SIZE / 2}
      width={NODE_FO_SIZE}
      height={NODE_FO_SIZE}
      style={{ overflow: 'visible' }}
    >
      <Button
        variant="ghost"
        size="icon-xs"
        className={`h-5 w-5 min-w-0 !rounded-full overflow-hidden p-0 hover:bg-neutral-700 focus-visible:!ring-0 focus-visible:!border-transparent ${isSelected ? 'ring-2 ring-amber-400/50' : ''}`}
        onClick={(e) => onClick(node.id, e)}
      >
        <span className={`block h-3 w-3 rounded-full ${dotColor} transition-colors`} />
      </Button>
    </foreignObject>
  );
};

const BADGE_HEIGHT = 32;

const MERGE_LABEL_WIDTH = 120;

const BranchLabel = ({
  branch,
  branchIndex,
  maxColumn,
  isSelected,
  mergeRole,
  onClick,
}: {
  readonly branch: GitBranch;
  readonly branchIndex: number;
  readonly maxColumn: number;
  readonly isSelected: boolean;
  readonly mergeRole: 'merge-target' | 'merge-source' | null;
  readonly onClick: (branchIndex: number, event: React.MouseEvent) => void;
}) => {
  const x = PADDING_LEFT + (maxColumn + 1.5) * COLUMN_GAP;
  const y = PADDING_TOP + branchIndex * ROW_GAP;
  const isMergeHighlighted = mergeRole !== null;

  return (
    <>
      <foreignObject
        x={x}
        y={y - BADGE_HEIGHT / 2}
        width={BRANCH_LABEL_WIDTH}
        height={BADGE_HEIGHT}
      >
        <Badge
          variant="outline"
          className={`h-full w-full cursor-pointer justify-center transition-colors ${
            isMergeHighlighted
              ? 'border-amber-500 bg-amber-500/20 text-amber-300'
              : isSelected
                ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                : 'border-neutral-600 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-700'
          }`}
          onClick={(e) => onClick(branchIndex, e as unknown as React.MouseEvent)}
        >
          {branch.name}
        </Badge>
      </foreignObject>
      {mergeRole && (
        <foreignObject
          x={x + BRANCH_LABEL_WIDTH + 4}
          y={y - BADGE_HEIGHT / 2}
          width={MERGE_LABEL_WIDTH}
          height={BADGE_HEIGHT}
        >
          <span className="flex h-full items-center text-xs text-amber-400">
            {mergeRole === 'merge-target' ? 'merge to 選択中' : 'merge 選択中'}
          </span>
        </foreignObject>
      )}
    </>
  );
};

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

// --- Page Component ---

export default function TreePage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const user = useAuthStore((s) => s.user);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

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
  const extraLabelWidth = mergeState.status !== 'idle' ? MERGE_LABEL_WIDTH + 4 : 0;
  const svgWidth = PADDING_LEFT + (maxColumn + 3) * COLUMN_GAP + BRANCH_LABEL_WIDTH + extraLabelWidth;
  const svgHeight = PADDING_TOP * 2 + Math.max(0, gitBranches.length - 1) * ROW_GAP;

  const [viewBox, setViewBox] = useState<ViewBox | null>(null);

  // Reset viewBox when SVG dimensions change
  useEffect(() => {
    if (gitNodes.length > 0) {
      setViewBox({ x: 0, y: 0, w: svgWidth, h: svgHeight });
    }
  }, [svgWidth, svgHeight, gitNodes.length]);

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

  const handleNodeClick = useCallback((nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveSelectedNodeId(nodeId);
    setHighlightedEdgeIds(tracePathToRoot(nodeId, gitNodes, allEdges));
    setContextMenu((prev) =>
      prev.visible && prev.nodeId === nodeId
        ? { ...prev, visible: false }
        : { visible: true, x: event.clientX, y: event.clientY, nodeId },
    );
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
        // Show dialog centered on screen
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

  // --- Zoom (wheel) ---
  const handleWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const ratioX = (e.clientX - rect.left) / rect.width;
    const ratioY = (e.clientY - rect.top) / rect.height;

    setViewBox((prev) => {
      if (!prev) return prev;
      const zoomFactor = 1 + e.deltaY * ZOOM_SENSITIVITY;
      const newW = Math.max(svgWidth * (1 / MAX_ZOOM), Math.min(svgWidth * (1 / MIN_ZOOM), prev.w * zoomFactor));
      const newH = Math.max(svgHeight * (1 / MAX_ZOOM), Math.min(svgHeight * (1 / MIN_ZOOM), prev.h * zoomFactor));
      const newX = prev.x + (prev.w - newW) * ratioX;
      const newY = prev.y + (prev.h - newH) * ratioY;
      return { x: newX, y: newY, w: newW, h: newH };
    });
  }, [svgWidth, svgHeight]);

  // --- Pan (drag) ---
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = (e.clientX - panStart.current.x) / rect.width;
    const dy = (e.clientY - panStart.current.y) / rect.height;
    panStart.current = { x: e.clientX, y: e.clientY };

    setViewBox((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        x: prev.x - dx * prev.w,
        y: prev.y - dy * prev.h,
      };
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Prevent default wheel scroll on container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const prevent = (e: globalThis.WheelEvent) => e.preventDefault();
    container.addEventListener('wheel', prevent, { passive: false });
    return () => container.removeEventListener('wheel', prevent);
  }, []);

  // Prevent browser pinch-to-zoom on the entire page
  useEffect(() => {
    const preventBrowserZoom = (e: globalThis.WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    document.addEventListener('wheel', preventBrowserZoom, { passive: false });
    return () => document.removeEventListener('wheel', preventBrowserZoom);
  }, []);

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} onBack={() => router.push('/dashboard')} />;

  const currentViewBox = viewBox ?? { x: 0, y: 0, w: svgWidth, h: svgHeight };

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
        <div
          ref={containerRef}
          className="relative flex flex-1 items-center justify-center overflow-hidden"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {gitNodes.length === 0 ? (
            <div className="text-neutral-500">ノードがありません</div>
          ) : (
            <svg
              ref={svgRef}
              className="h-full w-full"
              viewBox={`${currentViewBox.x} ${currentViewBox.y} ${currentViewBox.w} ${currentViewBox.h}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Edges */}
              {allEdges.map((edge) => (
                <EdgeLine
                  key={edge.id}
                  edge={edge}
                  isHighlighted={highlightedEdgeIds.has(edge.id)}
                />
              ))}

              {/* Nodes */}
              {gitNodes.map((node) => (
                <NodeDot
                  key={node.id}
                  node={node}
                  isSelected={node.id === activeSelectedNodeId}
                  isOnHighlightedPath={highlightedNodeIds.has(node.id)}
                  onClick={handleNodeClick}
                />
              ))}

              {/* Branch labels */}
              {gitBranches.map((branch, index) => (
                <BranchLabel
                  key={branch.name}
                  branch={branch}
                  branchIndex={index}
                  maxColumn={maxColumn}
                  isSelected={branchMenu.visible && branchMenu.branchIndex === index}
                  mergeRole={
                    mergeState.targetBranchIndex === index
                      ? 'merge-target'
                      : mergeState.sourceBranchIndex === index
                        ? 'merge-source'
                        : null
                  }
                  onClick={handleBranchLabelClick}
                />
              ))}
            </svg>
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
