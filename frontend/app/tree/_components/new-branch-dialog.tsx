'use client';

import { useState, useCallback } from 'react';
import { GitBranch } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export const NewBranchDialog = ({
  visible,
  loading,
  onConfirm,
  onCancel,
}: {
  readonly visible: boolean;
  readonly loading: boolean;
  readonly onConfirm: (name: string) => void;
  readonly onCancel: () => void;
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const validate = useCallback((value: string): boolean => {
    if (!value.trim()) { setError('ブランチ名を入力してください'); return false; }
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) { setError('英数字・ハイフン・アンダースコアのみ使用できます'); return false; }
    if (value.length > 100) { setError('100文字以内で入力してください'); return false; }
    setError('');
    return true;
  }, []);

  const handleSubmit = useCallback(() => {
    if (validate(name)) onConfirm(name);
  }, [name, validate, onConfirm]);

  const handleClose = useCallback(() => {
    setName('');
    setError('');
    onCancel();
  }, [onCancel]);

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="!max-w-md border-neutral-600 bg-neutral-800 text-neutral-100 shadow-2xl shadow-black/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-neutral-100">
            <GitBranch size={18} />
            新しいブランチを作成
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            選択したノードから新しい分岐を作成します
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          <label className="block text-sm font-medium text-neutral-300">ブランチ名</label>
          <Input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit(); }}
            placeholder="例: pricing-discussion"
            autoFocus
            className="border-neutral-600 bg-neutral-700 text-neutral-100 placeholder:text-neutral-500 focus-visible:border-blue-500 focus-visible:ring-blue-500/30"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <p className="text-xs text-neutral-500">英数字・ハイフン・アンダースコアのみ使用できます</p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={handleClose}
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
            {loading ? '作成中...' : '作成'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
