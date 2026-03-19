'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type ConversationCardProps = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly onDelete?: (id: string) => void;
};

const formatRelativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  return new Date(iso).toLocaleDateString('ja-JP');
};

export function ConversationCard({ id, title, updatedAt, onDelete }: ConversationCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    <>
      <div className="relative w-full rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
        <button
          onClick={() => router.push(`/tree/${id}`)}
          className="w-full text-left"
        >
          <h3 className="mb-2 truncate pr-8 text-sm font-medium text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400">{formatRelativeTime(updatedAt)}</p>
        </button>

        {/* ミートボールメニュー */}
        <div className="absolute right-3 top-3" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((prev) => !prev); }}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border bg-white py-1 shadow-lg">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShowDeleteConfirm(true); }}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                🗑 削除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold">会話を削除しますか？</h3>
            <p className="mb-4 text-sm text-gray-500">
              「{title}」を削除します。30日以内であれば復元できます。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
              >
                キャンセル
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); onDelete?.(id); }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
