import type { Branch, ConversationNode } from '@/stores/conversation-store';
import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type { GitNode, GitBranch, GraphEdge, DotNodeData, BranchLabelNodeData, ColoredEdgeData, MergeState } from './types';
import { COLUMN_GAP, ROW_GAP, PADDING_LEFT, PADDING_TOP, MERGE_ARROW_COLOR, CHERRY_PICK_ARROW_COLOR } from './types';

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

export const convertBranches = (branches: ReadonlyArray<Branch>, activeBranchId: string | null): ReadonlyArray<GitBranch> =>
  branches.map((branch) => ({
    name: branch.name,
    color: `hsl(${hashStringToHue(branch.id)}, 60%, 45%)`,
    id: branch.id,
    isActive: branch.id === activeBranchId,
  }));

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
    nodeType: node.nodeType,
    metadata: node.metadata,
  }));
};

export const findSelectedNodeId = (
  branches: ReadonlyArray<Branch>, activeBranchId: string | null,
): string | null => branches.find((b) => b.id === activeBranchId)?.headNodeId ?? null;

export const nodePosition = (node: GitNode) => ({
  x: PADDING_LEFT + node.column * COLUMN_GAP,
  y: PADDING_TOP + node.branchIndex * ROW_GAP,
});

// Find leaf nodes for each branch (for merge dots)
const findBranchLeafNodes = (nodes: ReadonlyArray<GitNode>, branchCount: number): Map<number, GitNode> => {
  const leafMap = new Map<number, GitNode>();
  Array.from({ length: branchCount }).forEach((_, branchIdx) => {
    const branchNodes = nodes.filter((n) => n.branchIndex === branchIdx);
    const maxCol = Math.max(...branchNodes.map((n) => n.column), -1);
    const leaf = branchNodes.find((n) => n.column === maxCol);
    if (leaf) leafMap.set(branchIdx, leaf);
  });
  return leafMap;
};

type MergeMetadata = {
  readonly merge_source_branch_id?: string;
  readonly cherry_picked_from?: string;
};

export const buildAllEdges = (
  nodes: ReadonlyArray<GitNode>, branches: ReadonlyArray<GitBranch>,
  rawNodes: ReadonlyArray<ConversationNode>, rawBranches: ReadonlyArray<Branch>,
): ReadonlyArray<GraphEdge> => {
  // Segment edges (same branch, sequential)
  const branchSegments: GraphEdge[] = branches.flatMap((branch, branchIdx) => {
    const branchNodes = nodes.filter((n) => n.branchIndex === branchIdx).toSorted((a, b) => a.column - b.column);
    return branchNodes.slice(1).map((node, i) => ({
      id: `seg-${branchNodes[i].id}-${node.id}`, fromNodeId: branchNodes[i].id, toNodeId: node.id,
      edgeType: 'segment' as const, defaultColor: branch.color,
    }));
  });

  // Connection edges (branch fork points)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const rawNodeMap = new Map(rawNodes.map((n) => [n.id, n]));
  const branchIdToIndex = new Map(rawBranches.map((b, i) => [b.id, i]));

  const connections: GraphEdge[] = nodes.flatMap((node) =>
    node.parentIds
      .filter((parentId) => {
        const parent = nodeMap.get(parentId);
        return parent && parent.branchIndex !== node.branchIndex;
      })
      .map((parentId) => ({
        id: `conn-${parentId}-${node.id}`, fromNodeId: parentId, toNodeId: node.id,
        edgeType: 'connection' as const, defaultColor: branches[node.branchIndex]?.color ?? '#888',
      })),
  );

  // Merge arrows: summary nodes → find source branch leaf → draw dashed arrow
  const mergeArrows: GraphEdge[] = [];
  const cherryPickArrows: GraphEdge[] = [];
  const leafNodes = findBranchLeafNodes(nodes, branches.length);

  nodes.forEach((node) => {
    const rawNode = rawNodeMap.get(node.id);
    if (!rawNode) return;
    const meta = rawNode.metadata as MergeMetadata | null;

    // Merge: summary node with merge_source_branch_id
    if (node.nodeType === 'summary' && meta?.merge_source_branch_id) {
      const sourceBranchIdx = branchIdToIndex.get(meta.merge_source_branch_id);
      if (sourceBranchIdx !== undefined) {
        const leafNode = leafNodes.get(sourceBranchIdx);
        if (leafNode) {
          // Create a virtual merge dot ID
          const mergeDotId = `merge-dot-${leafNode.id}-${node.id}`;
          // Edge from leaf node to merge dot
          branchSegments.push({
            id: `seg-leaf-${leafNode.id}-${mergeDotId}`,
            fromNodeId: leafNode.id,
            toNodeId: mergeDotId,
            edgeType: 'segment',
            defaultColor: branches[sourceBranchIdx]?.color ?? '#888',
          });
          // Dashed arrow from merge dot to summary node
          mergeArrows.push({
            id: `merge-arrow-${leafNode.id}-${node.id}`,
            fromNodeId: mergeDotId,
            toNodeId: node.id,
            edgeType: 'merge-arrow',
            defaultColor: MERGE_ARROW_COLOR,
          });
        }
      }
    }

    // Cherry-pick: node with cherry_picked_from metadata
    if (meta?.cherry_picked_from) {
      const sourceNode = nodeMap.get(meta.cherry_picked_from);
      if (sourceNode) {
        cherryPickArrows.push({
          id: `cherry-pick-${meta.cherry_picked_from}-${node.id}`,
          fromNodeId: meta.cherry_picked_from,
          toNodeId: node.id,
          edgeType: 'cherry-pick-arrow',
          defaultColor: CHERRY_PICK_ARROW_COLOR,
        });
      }
    }
  });

  return [...branchSegments, ...connections, ...mergeArrows, ...cherryPickArrows];
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
    if (edge.edgeType === 'segment' || edge.edgeType === 'connection') {
      if (pathNodeIds.has(edge.fromNodeId) && pathNodeIds.has(edge.toNodeId)) highlightedEdgeIds.add(edge.id);
    }
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
  rawNodes: ReadonlyArray<ConversationNode>, rawBranches: ReadonlyArray<Branch>,
): RFNode[] => {
  const rawNodeMap = new Map(rawNodes.map((n) => [n.id, n]));
  const branchIdToIndex = new Map(rawBranches.map((b, i) => [b.id, i]));
  const leafNodes = findBranchLeafNodes(gitNodes, gitBranches.length);

  const dotNodes: RFNode<DotNodeData>[] = gitNodes.map((node) => {
    const pos = nodePosition(node);
    const isSelected = node.id === activeSelectedNodeId;
    const isOnPath = highlightedNodeIds.has(node.id);
    const isActiveBranch = gitBranches[node.branchIndex]?.isActive ?? false;
    const dotColor = isSelected ? 'bg-amber-400' : isOnPath ? 'bg-red-400' : isActiveBranch ? 'bg-neutral-800 dark:bg-neutral-200' : 'bg-neutral-400 dark:bg-neutral-500';
    return {
      id: node.id, type: 'dotNode',
      position: { x: pos.x - 5, y: pos.y - 5 },
      data: { dotColor, isSelected, gitNodeId: node.id, isMergeDot: false, isActiveBranch },
      draggable: false, connectable: false,
    };
  });

  // Add merge dots (half-size dots at leaf nodes of merge source branches)
  const mergeDotNodes: RFNode<DotNodeData>[] = [];
  gitNodes.forEach((node) => {
    const rawNode = rawNodeMap.get(node.id);
    if (!rawNode || node.nodeType !== 'summary') return;
    const meta = rawNode.metadata as MergeMetadata | null;
    if (!meta?.merge_source_branch_id) return;
    const sourceBranchIdx = branchIdToIndex.get(meta.merge_source_branch_id);
    if (sourceBranchIdx === undefined) return;
    const leafNode = leafNodes.get(sourceBranchIdx);
    if (!leafNode) return;

    const leafPos = nodePosition(leafNode);
    const mergeDotId = `merge-dot-${leafNode.id}-${node.id}`;
    mergeDotNodes.push({
      id: mergeDotId, type: 'dotNode',
      position: { x: leafPos.x + COLUMN_GAP * 0.5 - 3, y: leafPos.y - 1 },
      data: { dotColor: 'bg-violet-500', isSelected: false, gitNodeId: mergeDotId, isMergeDot: true, isActiveBranch: false },
      draggable: false, connectable: false,
    });

    // Add segment edge from leaf to merge dot
  });

  const branchLabelNodes: RFNode<BranchLabelNodeData>[] = gitBranches.map((branch, index) => {
    const x = PADDING_LEFT + (maxColumn + 2) * COLUMN_GAP;
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
        isActiveBranch: branch.isActive,
      },
      draggable: false, connectable: false,
    };
  });
  return [...dotNodes, ...mergeDotNodes, ...branchLabelNodes];
};

export const buildReactFlowEdges = (
  allEdges: ReadonlyArray<GraphEdge>, highlightedEdgeIds: ReadonlySet<string>,
): RFEdge<ColoredEdgeData>[] =>
  allEdges.map((edge) => ({
    id: edge.id, source: edge.fromNodeId, target: edge.toNodeId, type: 'coloredEdge',
    data: { edgeColor: edge.defaultColor, isHighlighted: highlightedEdgeIds.has(edge.id), edgeType: edge.edgeType },
  }));
