'use client';

import { useState, useCallback, useMemo, useRef, useEffect, type WheelEvent as ReactWheelEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PenLine, Search, LayoutDashboard, ChevronLeft, ArrowLeft, HelpCircle, MessageSquare, X } from 'lucide-react';
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
const EDGE_HIT_WIDTH = 12;

const ZOOM_SENSITIVITY = 0.001;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

const CONTEXT_MENU_ITEMS = ['read', 'switch', 'cherry-pick', 'new branch'] as const;

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

const findBranchTip = (
  edgeId: string,
  edges: ReadonlyArray<GraphEdge>,
  nodes: ReadonlyArray<GitNode>,
): string => {
  const edge = edges.find((e) => e.id === edgeId);
  if (!edge) return '';
  const toNode = nodes.find((n) => n.id === edge.toNodeId);
  if (!toNode) return edge.toNodeId;

  const branchNodes = nodes.filter((n) => n.branchIndex === toNode.branchIndex);
  const tip = branchNodes.reduce((acc, n) => (n.column > acc.column ? n : acc), branchNodes[0]);
  return tip.id;
};

// --- Components ---

const EdgeLine = ({
  edge,
  isHighlighted,
  onClick,
}: {
  readonly edge: GraphEdge;
  readonly isHighlighted: boolean;
  readonly onClick: (edgeId: string) => void;
}) => {
  const strokeColor = isHighlighted ? HIGHLIGHT_COLOR : edge.defaultColor;

  if (edge.edgeType === 'segment') {
    return (
      <g className="cursor-pointer" onClick={() => onClick(edge.id)}>
        <line
          x1={edge.fromX}
          y1={edge.fromY}
          x2={edge.toX}
          y2={edge.toY}
          stroke="transparent"
          strokeWidth={EDGE_HIT_WIDTH}
        />
        <line
          x1={edge.fromX}
          y1={edge.fromY}
          x2={edge.toX}
          y2={edge.toY}
          stroke={strokeColor}
          strokeWidth={isHighlighted ? 3 : 2}
          className="pointer-events-none transition-colors"
        />
      </g>
    );
  }

  const midX = edge.fromX + COLUMN_GAP * 0.5;
  const path = `M ${edge.fromX} ${edge.fromY} C ${midX} ${edge.fromY}, ${midX} ${edge.toY}, ${edge.toX} ${edge.toY}`;

  return (
    <g className="cursor-pointer" onClick={() => onClick(edge.id)}>
      <path d={path} stroke="transparent" strokeWidth={EDGE_HIT_WIDTH} fill="none" />
      <path
        d={path}
        stroke={strokeColor}
        strokeWidth={isHighlighted ? 3 : 2}
        fill="none"
        className="pointer-events-none transition-colors"
      />
    </g>
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

const BranchLabel = ({
  branch,
  branchIndex,
  maxColumn,
}: {
  readonly branch: GitBranch;
  readonly branchIndex: number;
  readonly maxColumn: number;
}) => {
  const x = PADDING_LEFT + (maxColumn + 1.5) * COLUMN_GAP;
  const y = PADDING_TOP + branchIndex * ROW_GAP;

  return (
    <foreignObject
      x={x}
      y={y - BADGE_HEIGHT / 2}
      width={BRANCH_LABEL_WIDTH}
      height={BADGE_HEIGHT}
    >
      <Badge
        variant="outline"
        className="h-full w-full justify-center border-neutral-600 bg-neutral-800 text-neutral-300"
      >
        {branch.name}
      </Badge>
    </foreignObject>
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

// --- Sidebar Component ---

const Sidebar = ({
  collapsed,
  onToggle,
  onNewChat,
  onSearch,
  onDashboard,
}: {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly onNewChat: () => void;
  readonly onSearch: () => void;
  readonly onDashboard: () => void;
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
  <header className="flex h-11 shrink-0 items-center justify-between border-b border-neutral-700 px-4">
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

  const [activeSelectedNodeId, setActiveSelectedNodeId] = useState<string | null>(null);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<ReadonlySet<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    nodeId: '',
  });

  // Sync selectedNodeId from data when it changes
  useEffect(() => {
    if (selectedNodeId) {
      setActiveSelectedNodeId(selectedNodeId);
    }
  }, [selectedNodeId]);

  const maxColumn = gitNodes.length > 0 ? Math.max(...gitNodes.map((n) => n.column)) : 0;
  const svgWidth = PADDING_LEFT + (maxColumn + 3) * COLUMN_GAP + BRANCH_LABEL_WIDTH;
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

  // --- Event Handlers ---

  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      const tipNodeId = findBranchTip(edgeId, allEdges, gitNodes);
      if (!tipNodeId) return;
      const newHighlighted = tracePathToRoot(tipNodeId, gitNodes, allEdges);
      setHighlightedEdgeIds(newHighlighted);
    },
    [allEdges, gitNodes],
  );

  const handleNodeClick = useCallback((nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveSelectedNodeId(nodeId);
    setContextMenu((prev) =>
      prev.visible && prev.nodeId === nodeId
        ? { ...prev, visible: false }
        : { visible: true, x: event.clientX, y: event.clientY, nodeId },
    );
  }, []);

  const handleContextMenuAction = useCallback(
    (action: string, nodeId: string) => {
      if (action === 'read') {
        setChatPanelNodeId(nodeId);
        // Highlight the path to this node
        const newHighlighted = tracePathToRoot(nodeId, gitNodes, allEdges);
        setHighlightedEdgeIds(newHighlighted);
        return;
      }
      console.log(`Action: ${action}, Node: ${nodeId}`);
    },
    [gitNodes, allEdges],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleCloseChatPanel = useCallback(() => {
    setChatPanelNodeId(null);
    setHighlightedEdgeIds(new Set());
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleNewChat = useCallback(() => {
    console.log('New chat');
  }, []);

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
                  onClick={handleEdgeClick}
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
    </div>
  );
}
