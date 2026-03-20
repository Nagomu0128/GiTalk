'use client';

import { useState, useCallback, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export const RenameBranchDialog = ({
  open,
  currentName,
  loading,
  onSubmit,
  onClose,
}: {
  readonly open: boolean;
  readonly currentName: string;
  readonly loading: boolean;
  readonly onSubmit: (name: string) => void;
  readonly onClose: () => void;
}) => {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  const validate = useCallback((value: string): boolean => {
    if (!value.trim()) { setError('ブランチ名を入力してください'); return false; }
    if (value.length > 100) { setError('100文字以内で入力してください'); return false; }
    setError('');
    return true;
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed === currentName) { onClose(); return; }
    if (validate(trimmed)) onSubmit(trimmed);
  }, [name, currentName, validate, onSubmit, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="!max-w-md border-neutral-600 bg-neutral-800 text-neutral-100 shadow-2xl shadow-black/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-neutral-100">
            <Pencil size={16} />
            ブランチ名を変更
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit(); }}
            autoFocus
            className="border-neutral-600 bg-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-neutral-200 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? '変更中...' : '変更'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
