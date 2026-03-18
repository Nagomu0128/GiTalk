'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TreeNode } from './tree-node';
import { SummaryNode } from './summary-node';
import { calculateLayout } from './elk-layout';
import { useConversationStore, type ConversationNode, type Branch } from '@/stores/conversation-store';

const nodeTypes: NodeTypes = {
  treeNode: TreeNode,
  summaryNode: SummaryNode,
};

const hashStringToHue = (str: string): number => {
  const hash = Array.from(str).reduce((acc, char) => {
    const code = char.charCodeAt(0);
    return ((acc << 5) - acc + code) | 0;
  }, 0);
  return Math.abs(hash) % 360;
};

const getBranchColor = (branchId: string): string => {
  const hue = hashStringToHue(branchId);
  return `hsl(${hue}, 70%, 50%)`;
};

const isOrphanNode = (
  nodeId: string,
  branches: ReadonlyArray<Branch>,
  nodeMap: Map<string, ConversationNode>,
): boolean => {
  const reachableIds = new Set<string>();

  branches.forEach((branch) => {
    const headId = branch.headNodeId;
    if (!headId) return;

    const traverse = (id: string | null): void => {
      if (!id || reachableIds.has(id)) return;
      reachableIds.add(id);
      const node = nodeMap.get(id);
      if (node) traverse(node.parentId);
    };

    traverse(headId);
  });

  return !reachableIds.has(nodeId);
};

type TreeViewProps = {
  readonly onNodeClick?: (nodeId: string) => void;
};

export function TreeView({ onNodeClick }: TreeViewProps) {
  const nodes = useConversationStore((s) => s.nodes);
  const branches = useConversationStore((s) => s.branches);
  const activeBranchId = useConversationStore((s) => s.activeBranchId);
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  useEffect(() => {
    if (nodes.length === 0) {
      setFlowNodes([]); // eslint-disable-line react-hooks/set-state-in-effect
      setFlowEdges([]); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const rfNodes: Node[] = nodes.map((node) => ({
      id: node.id,
      type: node.nodeType === 'summary' ? 'summaryNode' : 'treeNode',
      position: { x: 0, y: 0 },
      data: {
        userMessage: node.userMessage,
        aiResponse: node.aiResponse,
        model: node.model,
        createdAt: node.createdAt,
        branchColor: getBranchColor(node.branchId),
        isActive: node.id === activeBranch?.headNodeId,
        isOrphan: isOrphanNode(node.id, branches, nodeMap),
        nodeType: node.nodeType,
        sourceBranchName: (node.metadata as { merge_source_branch_name?: string } | null)?.merge_source_branch_name ?? '',
      },
    }));

    const rfEdges: Edge[] = nodes
      .filter((node) => node.parentId !== null)
      .map((node) => ({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId!,
        target: node.id,
        type: 'smoothstep',
      }));

    calculateLayout(rfNodes, rfEdges).then((layoutNodes) => {
      setFlowNodes(layoutNodes as Node[]);
      setFlowEdges(rfEdges);
    });
  }, [nodes, branches, activeBranch?.headNodeId]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick],
  );

  if (nodes.length === 0) return null;

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Controls />
        <MiniMap />
        <Background />
      </ReactFlow>
    </div>
  );
}
