import { create } from 'zustand';

type ChatState = {
  isStreaming: boolean;
  streamingContent: string;
  setStreaming: (isStreaming: boolean) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
};

export const useChatStore = create<ChatState>((set) => ({
  isStreaming: false,
  streamingContent: '',
  setStreaming: (isStreaming) => set({ isStreaming }),
  appendStreamingContent: (content) =>
    set((state) => ({ streamingContent: state.streamingContent + content })),
  clearStreamingContent: () => set({ streamingContent: '' }),
}));
