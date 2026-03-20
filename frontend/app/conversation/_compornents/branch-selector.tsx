'use client';

import { useState, useRef, useEffect } from 'react';
import { GitBranch } from 'lucide-react';
import { useConversationStore } from '@/stores/conversation-store';

type BranchSelectorProps = {
  readonly onSwitch: (branchId: string) => void;
  readonly onMerge: () => void;
  readonly onDiff: () => void;
};

export function BranchSelector({ onSwitch, onMerge, onDiff }: BranchSelectorProps) {
  const branches = useConversationStore((s) => s.branches);
  const activeBranchId = useConversationStore((s) => s.activeBranchId);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <GitBranch size={14} className="text-neutral-400" />
      <select
        value={activeBranchId ?? ''}
        onChange={(e) => onSwitch(e.target.value)}
        className="rounded-lg border border-neutral-600 bg-neutral-800 px-2 py-1 text-xs text-neutral-300 outline-none"
      >
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}{branch.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-600 text-xs text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
        >
          ···
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-xl border border-neutral-600 bg-neutral-800 py-1 shadow-lg">
            <button
              onClick={() => { onDiff(); setMenuOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
            >
              ブランチを比較
              <span className="block text-xs text-neutral-500">二つの話題の違いを確認します</span>
            </button>
            <button
              onClick={() => { onMerge(); setMenuOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
            >
              会話を統合
              <span className="block text-xs text-neutral-500">別の話題の結論をこちらに取り込みます</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
