'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { ConversationCard } from '@/components/cards/conversation-card';

const API = '/api';

type ConversationSummary = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
};

export default function ConversationsPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [conversations, setConversations] = useState<ReadonlyArray<ConversationSummary>>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchConversations = useCallback(async (loadMore = false) => {
    const token = await user?.getIdToken();
    const params = new URLSearchParams({ limit: '20' });
    if (loadMore && cursor) params.set('cursor', cursor);

    const res = await fetch(`${API}/v1/conversations?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setConversations((prev) => loadMore ? [...prev, ...data.data] : data.data);
      setHasMore(data.has_more);
      setCursor(data.next_cursor);
    }
    setLoading(false);
  }, [user, cursor]);

  useEffect(() => {
    fetchConversations(); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewConversation = async () => {
    const token = await user?.getIdToken();
    const res = await fetch(`${API}/v1/conversations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新しい会話' }),
    });
    const data = await res.json();
    router.push(`/conversation/${data.id}`);
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-700 px-6">
        <h1 className="text-lg font-bold text-neutral-200">会話一覧</h1>
        <button
          onClick={handleNewConversation}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + 新しい会話
        </button>
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
            />
          ))}
        </div>

        {hasMore && (
          <div className="mt-8 flex flex-col items-center gap-1">
            <button
              onClick={() => fetchConversations(true)}
              className="flex flex-col items-center gap-1 text-sm text-neutral-400 transition-colors hover:text-neutral-200"
            >
              <span>もっと見る</span>
              <ChevronDown size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
