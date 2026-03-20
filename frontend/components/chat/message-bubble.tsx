'use client';

import { Plus } from 'lucide-react';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';

type MessageBubbleProps = {
  readonly role: 'user' | 'ai';
  readonly content: string;
  readonly model?: string;
  readonly timestamp?: string;
  readonly onBranch?: () => void;
};

export function MessageBubble({ role, content, model, timestamp, onBranch }: MessageBubbleProps) {
  const sanitized = DOMPurify.sanitize(content);
  const time = timestamp ? new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '';

  if (role === 'user') {
    return (
      <div className="mb-4 flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-blue-100 px-4 py-3 text-sm text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="group/bubble mb-4 flex items-start gap-2">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
        G
      </div>
      <div className="relative max-w-[80%]">
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          {model && (
            <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
              {model && <span>{model}</span>}
              {time && <span>{time}</span>}
            </div>
          )}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{sanitized}</ReactMarkdown>
          </div>
        </div>
        {onBranch && (
          <button
            onClick={onBranch}
            className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-500 opacity-0 shadow-sm transition-all hover:bg-neutral-100 hover:text-neutral-700 group-hover/bubble:opacity-100 dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600 dark:hover:text-neutral-200"
            title="このノードから分岐"
          >
            <Plus size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
