'use client';

import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';

type MessageBubbleProps = {
  readonly role: 'user' | 'ai';
  readonly content: string;
  readonly model?: string;
  readonly timestamp?: string;
};

export function MessageBubble({ role, content, model, timestamp }: MessageBubbleProps) {
  const sanitized = DOMPurify.sanitize(content);
  const time = timestamp ? new Date(timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '';

  if (role === 'user') {
    return (
      <div className="mb-4 flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-neutral-800 px-4 py-3 text-sm text-neutral-200">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-start gap-2">
      <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-sm font-bold text-neutral-300">
        G
      </div>
      <div className="max-w-[80%] rounded-2xl bg-neutral-800 px-4 py-3 text-sm text-neutral-300">
        {model && (
          <div className="mb-1 flex items-center gap-2 text-xs text-neutral-500">
            {model && <span>{model}</span>}
            {time && <span>{time}</span>}
          </div>
        )}
        <div className="prose prose-sm prose-invert max-w-none">
          <ReactMarkdown>{sanitized}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
