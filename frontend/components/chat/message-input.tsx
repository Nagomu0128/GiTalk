'use client';

import { useState, useCallback } from 'react';

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

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, model, contextMode);
    setMessage('');
  }, [message, model, contextMode, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="border-t bg-white p-4">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="メッセージを入力..."
        disabled={disabled}
        rows={3}
        className="w-full resize-none rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={contextMode}
            onChange={(e) => setContextMode(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            {CONTEXT_MODES.map((cm) => (
              <option key={cm.value} value={cm.value}>{cm.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled || !message.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {disabled ? '送信中...' : '送信 ➤'}
        </button>
      </div>
    </div>
  );
}
