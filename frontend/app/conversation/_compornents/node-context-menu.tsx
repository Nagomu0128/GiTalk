'use client';

import { useEffect, useRef } from 'react';

type NodeContextMenuProps = {
  readonly x: number;
  readonly y: number;
  readonly nodeId: string;
  readonly isOtherBranch?: boolean;
  readonly onBranch: (nodeId: string) => void;
  readonly onReset: (nodeId: string) => void;
  readonly onCherryPick?: (nodeId: string) => void;
  readonly onClose: () => void;
};

export function NodeContextMenu({ x, y, nodeId, isOtherBranch, onBranch, onReset, onCherryPick, onClose }: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-56 rounded-lg border bg-white py-1 shadow-lg"
      style={{ left: x, top: y }}
    >
      <button
        onClick={() => { onBranch(nodeId); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
      >
        <span className="font-medium">🌿 新しい分岐を作成</span>
        <span className="block text-xs text-gray-400">ここから別の話題を探索します</span>
      </button>
      <div className="mx-3 border-t" />
      <button
        onClick={() => { onReset(nodeId); onClose(); }}
        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
      >
        <span className="font-medium">⏪ ここまで戻す</span>
        <span className="block text-xs text-gray-400">この時点から会話をやり直します</span>
      </button>
      {isOtherBranch && onCherryPick && (
        <>
          <div className="mx-3 border-t" />
          <button
            onClick={() => { onCherryPick(nodeId); onClose(); }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
          >
            <span className="font-medium">📋 このノードを取り込む</span>
            <span className="block text-xs text-gray-400">この会話を今の話題にコピーします</span>
          </button>
        </>
      )}
    </div>
  );
}
