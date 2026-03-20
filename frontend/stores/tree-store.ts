import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';

type TreeState = {
  flowNodes: ReadonlyArray<Node>;
  flowEdges: ReadonlyArray<Edge>;
  selectedNodeId: string | null;
  setFlowNodes: (nodes: ReadonlyArray<Node>) => void;
  setFlowEdges: (edges: ReadonlyArray<Edge>) => void;
  setSelectedNodeId: (id: string | null) => void;
};

export const useTreeStore = create<TreeState>((set) => ({
  flowNodes: [],
  flowEdges: [],
  selectedNodeId: null,
  setFlowNodes: (nodes) => set({ flowNodes: nodes }),
  setFlowEdges: (edges) => set({ flowEdges: edges }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
}));
