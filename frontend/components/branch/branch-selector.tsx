'use client';

import { useState, useRef, useEffect } from 'react';
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
      <span className="text-sm text-gray-500">🌿</span>
      <select
        value={activeBranchId ?? ''}
        onChange={(e) => onSwitch(e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-sm"
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
          className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-lg border bg-white py-1 shadow-lg">
            <button
              onClick={() => { onDiff(); setMenuOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              📊 ブランチを比較
              <span className="block text-xs text-gray-400">二つの話題の違いを確認します</span>
            </button>
            <button
              onClick={() => { onMerge(); setMenuOpen(false); }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              🔀 会話を統合
              <span className="block text-xs text-gray-400">別の話題の結論をこちらに取り込みます</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
