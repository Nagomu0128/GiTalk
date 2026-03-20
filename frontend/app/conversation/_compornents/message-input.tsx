'use client';

import { useState, useCallback } from 'react';
import { ArrowUp, ChevronDown, Sparkles, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type MessageInputProps = {
  readonly onSend: (message: string, model: string, contextMode: string) => void;
  readonly disabled?: boolean;
};

const MODELS = [
  { value: 'gemini-2.5-flash', label: '2.5 Flash', description: '高速・低コスト' },
  { value: 'gemini-2.5-pro', label: '2.5 Pro', description: '高精度・推論向け' },
  { value: 'gemini-2.0-flash', label: '2.0 Flash', description: 'バランス型' },
  { value: 'gemini-2.0-flash-lite', label: '2.0 Flash Lite', description: '軽量・超低コスト' },
] as const;

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [model, setModel] = useState<string>(MODELS[0].value);

  const handleSubmit = useCallback(() => {
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, model, 'summary');
    setMessage('');
  }, [message, model, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const currentModel = MODELS.find((m) => m.value === model) ?? MODELS[0];
  return (
    <div className="shrink-0 px-4 pb-6 pt-2">
      <div className="mx-auto max-w-3xl">
        {/* Model selector */}
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <Popover>
            <PopoverTrigger className="flex items-center gap-1 rounded-full border border-neutral-600 bg-neutral-800 px-3 py-1 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:bg-neutral-750 hover:text-neutral-200">
              <Sparkles size={12} />
              <span>{currentModel.label}</span>
              <ChevronDown size={12} />
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={6}
              className="!w-48 border-neutral-600 bg-neutral-800 p-1"
            >
              {MODELS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setModel(m.value)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-700"
                >
                  <div>
                    <p className="text-sm text-neutral-200">{m.label}</p>
                    <p className="text-xs text-neutral-500">{m.description}</p>
                  </div>
                  {model === m.value && <Check size={14} className="shrink-0 text-blue-400" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        {/* Input bar */}
        <div className="flex items-center gap-2 rounded-2xl border border-neutral-600 bg-neutral-800 px-4 py-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? '送信中...' : 'メッセージを入力...'}
            disabled={disabled}
            rows={1}
            className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm leading-6 text-neutral-200 placeholder-neutral-500 outline-none disabled:opacity-50"
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || !message.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-900 transition-colors hover:bg-white disabled:bg-neutral-600 disabled:text-neutral-400"
          >
            <ArrowUp size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
