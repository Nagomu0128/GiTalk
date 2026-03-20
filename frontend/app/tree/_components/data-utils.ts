import type { Branch, ConversationNode } from '@/stores/conversation-store';
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type { GitNode, GitBranch, GraphEdge, DotNodeData, BranchLabelNodeData, ColoredEdgeData, MergeState } from './types';
import { COLUMN_GAP, ROW_GAP, PADDING_LEFT, PADDING_TOP } from './types';

export const hashStringToHue = (str: string): number => {
  const hash = Array.from(str).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  return Math.abs(hash) % 360;
};

export const computeDepth = (
  nodeId: string, nodeMap: ReadonlyMap<string, ConversationNode>, depthCache: Map<string, number>,
): number => {
  const cached = depthCache.get(nodeId);
  if (cached !== undefined) return cached;
  const node = nodeMap.get(nodeId);
  if (!node || !node.parentId) { depthCache.set(nodeId, 0); return 0; }
  const depth = computeDepth(node.parentId, nodeMap, depthCache) + 1;
  depthCache.set(nodeId, depth);
  return depth;
};

export const convertBranches = (branches: ReadonlyArray<Branch>): ReadonlyArray<GitBranch> =>
  branches.map((branch) => ({ name: branch.name, color: `hsl(${hashStringToHue(branch.id)}, 70%, 50%)` }));

export const convertNodes = (
  nodes: ReadonlyArray<ConversationNode>, branches: ReadonlyArray<Branch>,
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

export const findSelectedNodeId = (
  branches: ReadonlyArray<Branch>, activeBranchId: string | null,
): string | null => branches.find((b) => b.id === activeBranchId)?.headNodeId ?? null;

export const nodePosition = (node: GitNode) => ({
  x: PADDING_LEFT + node.column * COLUMN_GAP,
  y: PADDING_TOP + node.branchIndex * ROW_GAP,
});

export const buildAllEdges = (
  nodes: ReadonlyArray<GitNode>, branches: ReadonlyArray<GitBranch>,
): ReadonlyArray<GraphEdge> => {
  const branchSegments: ReadonlyArray<GraphEdge> = branches.flatMap((branch, branchIdx) => {
    const branchNodes = nodes.filter((n) => n.branchIndex === branchIdx).toSorted((a, b) => a.column - b.column);
    return branchNodes.slice(1).map((node, i) => ({
      id: `seg-${branchNodes[i].id}-${node.id}`, fromNodeId: branchNodes[i].id, toNodeId: node.id,
      edgeType: 'segment' as const, defaultColor: branch.color,
    }));
  });
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const connections: ReadonlyArray<GraphEdge> = nodes.flatMap((node) => {
    const results: GraphEdge[] = [];
    node.parentIds.forEach((parentId) => {
      const parent = nodeMap.get(parentId);
      if (!parent || parent.branchIndex === node.branchIndex) return;
      results.push({
        id: `conn-${parentId}-${node.id}`, fromNodeId: parentId, toNodeId: node.id,
        edgeType: 'connection' as const, defaultColor: branches[node.branchIndex].color,
      });
    });
    return results;
  });
  return [...branchSegments, ...connections];
};

export const tracePathToRoot = (
  tipNodeId: string, nodes: ReadonlyArray<GitNode>, edges: ReadonlyArray<GraphEdge>,
): ReadonlySet<string> => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const highlightedEdgeIds = new Set<string>();
  const pathNodeIds = new Set<string>();
  const traverse = (nodeId: string): void => {
    if (pathNodeIds.has(nodeId)) return;
    pathNodeIds.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node) node.parentIds.forEach((pid) => traverse(pid));
  };
  traverse(tipNodeId);
  edges.forEach((edge) => {
    if (pathNodeIds.has(edge.fromNodeId) && pathNodeIds.has(edge.toNodeId)) highlightedEdgeIds.add(edge.id);
  });
  return highlightedEdgeIds;
};

export const collectPathMessages = (
  tipNodeId: string, rawNodes: ReadonlyArray<ConversationNode>,
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

export const buildReactFlowNodes = (
  gitNodes: ReadonlyArray<GitNode>, gitBranches: ReadonlyArray<GitBranch>,
  activeSelectedNodeId: string | null, highlightedNodeIds: ReadonlySet<string>,
  maxColumn: number, branchMenuVisible: boolean, branchMenuBranchIndex: number, mergeState: MergeState,
): RFNode[] => {
  const dotNodes: RFNode<DotNodeData>[] = gitNodes.map((node) => {
    const pos = nodePosition(node);
    const isSelected = node.id === activeSelectedNodeId;
    const isOnPath = highlightedNodeIds.has(node.id);
    const dotColor = isSelected ? 'bg-amber-400' : isOnPath ? 'bg-red-500' : 'bg-neutral-400';
    return {
      id: node.id, type: 'dotNode',
      position: { x: pos.x - 10, y: pos.y - 10 },
      data: { dotColor, isSelected, gitNodeId: node.id },
      draggable: false, connectable: false,
    };
  });
  const branchLabelNodes: RFNode<BranchLabelNodeData>[] = gitBranches.map((branch, index) => {
    const x = PADDING_LEFT + (maxColumn + 1.5) * COLUMN_GAP;
    const y = PADDING_TOP + index * ROW_GAP;
    const mergeRole = mergeState.targetBranchIndex === index
      ? ('merge-target' as const)
      : mergeState.sourceBranchIndex === index ? ('merge-source' as const) : null;
    return {
      id: `branch-label-${index}`, type: 'branchLabel',
      position: { x, y: y - 16 },
      data: {
        branchName: branch.name, branchIndex: index,
        isSelected: branchMenuVisible && branchMenuBranchIndex === index,
        isMergeHighlighted: mergeRole !== null, mergeRole, branchColor: branch.color,
      },
      draggable: false, connectable: false,
    };
  });
  return [...dotNodes, ...branchLabelNodes];
};

export const buildReactFlowEdges = (
  allEdges: ReadonlyArray<GraphEdge>, highlightedEdgeIds: ReadonlySet<string>,
): RFEdge<ColoredEdgeData>[] =>
  allEdges.map((edge) => ({
    id: edge.id, source: edge.fromNodeId, target: edge.toNodeId, type: 'coloredEdge',
    data: { edgeColor: edge.defaultColor, isHighlighted: highlightedEdgeIds.has(edge.id), edgeType: edge.edgeType },
  }));
