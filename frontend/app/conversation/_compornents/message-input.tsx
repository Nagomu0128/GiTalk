'use client';

import { useState, useCallback } from 'react';
import { MessageSquare, ChevronDown } from 'lucide-react';

type MessageInputProps = {
  readonly onSend: (message: string, model: string, contextMode: string) => void;
  readonly disabled?: boolean;
};

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'] as const;
const CONTEXT_MODES = [
  { value: 'full', label: 'フル' },
  { value: 'summary', label: '要約' },
  { value: 'minimal', label: '最小' },
] as const;

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [model, setModel] = useState<string>(MODELS[0]);
  const [contextMode, setContextMode] = useState<string>('summary');
  const [showOptions, setShowOptions] = useState(false);

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, model, contextMode);
    setMessage('');
  }, [message, model, contextMode, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="shrink-0 px-8 pb-6 pt-2">
      {/* Options row */}
      {showOptions && (
        <div className="mb-2 flex items-center gap-2 px-4">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 outline-none"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={contextMode}
            onChange={(e) => setContextMode(e.target.value)}
            className="rounded-lg border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 outline-none"
          >
            {CONTEXT_MODES.map((cm) => (
              <option key={cm.value} value={cm.value}>{cm.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-3 rounded-full border border-neutral-600 bg-neutral-800 px-4 py-2.5">
        <MessageSquare size={20} className="shrink-0 text-white" />
        <div className="h-5 w-px bg-neutral-600" />
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? '送信中...' : 'したいことはありますか？'}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-neutral-200 placeholder-neutral-500 outline-none disabled:opacity-50"
        />
        <button
          onClick={() => setShowOptions((prev) => !prev)}
          className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200"
        >
          <ChevronDown size={14} className={`transition-transform ${showOptions ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}
