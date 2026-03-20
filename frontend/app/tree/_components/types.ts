// --- Types ---

export type GitNode = {
  readonly id: string;
  readonly branchIndex: number;
  readonly column: number;
  readonly parentIds: ReadonlyArray<string>;
};

export type GitBranch = {
  readonly name: string;
  readonly color: string;
};

export type ContextMenuState = {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly nodeId: string;
};

export type BranchMenuState = {
  readonly visible: boolean;
  readonly x: number;
  readonly y: number;
  readonly branchIndex: number;
};

export type MergeState = {
  readonly status: 'idle' | 'selecting-source' | 'merging' | 'done';
  readonly targetBranchIndex: number | null;
  readonly sourceBranchIndex: number | null;
};

export type DotNodeData = {
  dotColor: string;
  isSelected: boolean;
  gitNodeId: string;
};

export type BranchLabelNodeData = {
  branchName: string;
  branchIndex: number;
  isSelected: boolean;
  isMergeHighlighted: boolean;
  mergeRole: 'merge-target' | 'merge-source' | null;
  branchColor: string;
};

export type ColoredEdgeData = {
  edgeColor: string;
  isHighlighted: boolean;
  edgeType: 'segment' | 'connection';
};

export type GraphEdge = {
  readonly id: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly edgeType: 'segment' | 'connection';
  readonly defaultColor: string;
};

// --- Constants ---

export const API = '/api';

export const COLUMN_GAP = 40;
export const ROW_GAP = 50;
export const PADDING_LEFT = 40;
export const PADDING_TOP = 40;
export const BRANCH_LABEL_WIDTH = 80;
export const HIGHLIGHT_COLOR = '#e05050';
export const MERGE_LABEL_WIDTH = 120;

export const CONTEXT_MENU_ITEMS = ['read', 'switch', 'cherry-pick', 'new branch'] as const;
export const BRANCH_MENU_ITEMS = ['merge', 'merge to', 'reset', 'diff', 'clone'] as const;
