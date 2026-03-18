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

  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
        role === 'user'
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-900'
      }`}>
        <div className="mb-1 flex items-center gap-2 text-xs opacity-70">
          <span>{role === 'user' ? '👤' : '🤖'}</span>
          {model && role === 'ai' && <span>{model}</span>}
          {time && <span>{time}</span>}
        </div>
        <div className={`prose prose-sm max-w-none ${role === 'user' ? 'prose-invert' : ''}`}>
          <ReactMarkdown>{sanitized}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
