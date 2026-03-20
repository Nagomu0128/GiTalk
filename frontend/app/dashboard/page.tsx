'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { ThemedLogo } from '@/components/themed-logo';
import { useAuthStore } from '@/stores/auth-store';
import { ConversationCard } from '@/components/cards/conversation-card';
import { SaveToRepoDialog } from '@/components/dialogs/save-to-repo-dialog';

const API = '/api';

type ConversationSummary = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [conversations, setConversations] = useState<ReadonlyArray<ConversationSummary>>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<ConversationSummary | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchConversations = async () => {
      const token = await user.getIdToken();
      const res = await fetch(`${API}/v1/conversations?limit=6`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.data);
        setHasMore(data.has_more);
        setCursor(data.next_cursor);
      }
      setLoading(false);
    };
    fetchConversations();
  }, [user?.uid]);

  const handleLoadMore = async () => {
    if (!cursor) return;
    const token = await user?.getIdToken();
    const params = new URLSearchParams({ limit: '6', cursor });
    const res = await fetch(`${API}/v1/conversations?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setConversations((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newItems = (data.data as ReadonlyArray<ConversationSummary>).filter((c) => !existingIds.has(c.id));
        return [...prev, ...newItems];
      });
      setHasMore(data.has_more);
      setCursor(data.next_cursor);
    }
  };

  const handleDelete = async (conversationId: string) => {
    const token = await user?.getIdToken();
    const res = await fetch(`${API}/v1/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center border-b border-neutral-300 px-6 dark:border-neutral-700">
        <div className="flex items-center gap-3">
          <ThemedLogo />
          <h1 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">会話一覧</h1>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading && <p className="text-sm text-neutral-500">読み込み中...</p>}
        {!loading && conversations.length === 0 && (
          <p className="text-sm text-neutral-500">まだ会話がありません。新しい会話を始めましょう。</p>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {conversations.map((conv) => (
            <ConversationCard
              key={conv.id}
              id={conv.id}
              title={conv.title}
              updatedAt={conv.updatedAt}
              onDelete={handleDelete}
              onSave={() => setSaveTarget(conv)}
            />
          ))}
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="mt-8 flex flex-col items-center gap-1">
            <button
              onClick={handleLoadMore}
              className="flex flex-col items-center gap-1 text-sm text-neutral-400 transition-colors hover:text-neutral-200"
            >
              <span className="text-neutral-500 dark:text-neutral-400">もっと見る</span>
              <ChevronDown size={18} />
            </button>
          </div>
        )}
      </div>

      {saveTarget && (
        <SaveToRepoDialog
          conversationId={saveTarget.id}
          conversationTitle={saveTarget.title}
          onClose={() => setSaveTarget(null)}
        />
      )}
    </div>
  );
}
