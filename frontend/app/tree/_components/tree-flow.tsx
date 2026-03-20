'use client';

import { useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  ReactFlow,
  Background,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { BranchLabelNodeData } from './types';
import { DotNodeComponent } from './dot-node';
import { BranchLabelNodeComponent } from './branch-label-node';
import { ColoredEdgeComponent } from './colored-edge';

const nodeTypes: NodeTypes = {
  dotNode: DotNodeComponent,
  branchLabel: BranchLabelNodeComponent,
};

const edgeTypes: EdgeTypes = {
  coloredEdge: ColoredEdgeComponent,
};

export const TreeFlowInner = ({
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
  const { resolvedTheme } = useTheme();

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

  const bgColor = resolvedTheme === 'dark' ? '#333' : '#d4d4d4';

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
      <Background color={bgColor} gap={24} size={1} />
    </ReactFlow>
  );
};
