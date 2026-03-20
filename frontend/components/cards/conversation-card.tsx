'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type ConversationCardProps = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly description?: string;
  readonly onDelete?: (id: string) => void;
  readonly onSave?: (id: string) => void;
};

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });

export function ConversationCard({ id, title, updatedAt, description, onDelete, onSave }: ConversationCardProps) {
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
      <div className="relative rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
        <button
          onClick={() => router.push(`/conversation/${id}`)}
          className="w-full text-left"
        >
          <h3 className="mb-1 truncate pr-6 text-sm font-bold text-neutral-900">{title}</h3>
          <p className="mb-2 text-xs text-neutral-500">作成日: {formatDate(updatedAt)}</p>
          {description && (
            <p className="line-clamp-4 text-xs leading-relaxed text-neutral-600">{description}</p>
          )}
        </button>

        <div className="absolute right-3 top-3" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((prev) => !prev); }}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-10 mt-1 w-36 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
              {onSave && (
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onSave(id); }}
                  className="w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  リポジトリに保存
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShowDeleteConfirm(true); }}
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                削除
              </button>
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-neutral-800 p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-bold text-neutral-200">会話を削除しますか？</h3>
            <p className="mb-4 text-sm text-neutral-400">
              「{title}」を削除します。30日以内であれば復元できます。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-700"
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
