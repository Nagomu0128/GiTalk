import { create } from 'zustand';

type Branch = {
  readonly id: string;
  readonly name: string;
  readonly headNodeId: string | null;
  readonly baseNodeId: string | null;
  readonly isDefault: boolean;
};

type ConversationNode = {
  readonly id: string;
  readonly parentId: string | null;
  readonly branchId: string;
  readonly nodeType: 'message' | 'summary' | 'system';
  readonly userMessage: string;
  readonly aiResponse: string;
  readonly model: string;
  readonly tokenCount: number;
  readonly metadata: unknown;
  readonly createdAt: string;
};

type Conversation = {
  readonly id: string;
  readonly title: string;
  readonly activeBranchId: string | null;
  readonly contextMode: string;
};

type ConversationState = {
  conversation: Conversation | null;
  branches: ReadonlyArray<Branch>;
  nodes: ReadonlyArray<ConversationNode>;
  activeBranchId: string | null;
  setConversation: (conversation: Conversation) => void;
  setBranches: (branches: ReadonlyArray<Branch>) => void;
  setNodes: (nodes: ReadonlyArray<ConversationNode>) => void;
  addNode: (node: ConversationNode) => void;
  setActiveBranchId: (id: string) => void;
  updateBranchHead: (branchId: string, headNodeId: string) => void;
  updateTitle: (title: string) => void;
};

export const useConversationStore = create<ConversationState>((set) => ({
  conversation: null,
  branches: [],
  nodes: [],
  activeBranchId: null,
  setConversation: (conversation) =>
    set({ conversation, activeBranchId: conversation.activeBranchId }),
  setBranches: (branches) => set({ branches }),
  setNodes: (nodes) => set({ nodes }),
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  setActiveBranchId: (id) => set({ activeBranchId: id }),
  updateBranchHead: (branchId, headNodeId) =>
    set((state) => ({
      branches: state.branches.map((b) =>
        b.id === branchId ? { ...b, headNodeId } : b,
      ),
    })),
  updateTitle: (title) =>
    set((state) => ({
      conversation: state.conversation ? { ...state.conversation, title } : null,
    })),
}));

export type { Branch, ConversationNode, Conversation };
