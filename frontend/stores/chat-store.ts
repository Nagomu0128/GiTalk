import { create } from 'zustand';

type ChatState = {
  isStreaming: boolean;
  pendingUserMessage: string | null;
  streamingContent: string;
  setStreaming: (isStreaming: boolean) => void;
  setPendingUserMessage: (message: string | null) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingState: () => void;
};

export const useChatStore = create<ChatState>((set) => ({
  isStreaming: false,
  pendingUserMessage: null,
  streamingContent: '',
  setStreaming: (isStreaming) => set({ isStreaming }),
  setPendingUserMessage: (message) => set({ pendingUserMessage: message }),
  appendStreamingContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),
  clearStreamingState: () => set({ isStreaming: false, pendingUserMessage: null, streamingContent: '' }),
}));
