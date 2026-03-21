'use client';

import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import type { ConversationNode } from '@/stores/conversation-store';

export const ChatPanel = ({
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
    <div className="flex h-full w-[420px] shrink-0 flex-col border-l border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex h-11 shrink-0 items-center justify-end border-b border-neutral-200 px-3 dark:border-neutral-700">
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.map((node) => (
          <div key={node.id} className="mb-6">
            {node.userMessage && (
              <div className="mb-3 flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                  {node.userMessage}
                </div>
              </div>
            )}

            {node.aiResponse && (
              <div className="flex items-start gap-2">
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                  G
                </div>
                <div className="max-w-[85%] rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
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
