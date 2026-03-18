'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { ConversationCard } from '@/components/cards/conversation-card';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">会話一覧</h1>
        <button
          onClick={handleNewConversation}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + 新しい会話を始める
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400">読み込み中...</p>}
      {!loading && conversations.length === 0 && (
        <p className="text-sm text-gray-400">まだ会話がありません。新しい会話を始めましょう。</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {conversations.map((conv) => (
          <ConversationCard key={conv.id} id={conv.id} title={conv.title} updatedAt={conv.updatedAt} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={() => fetchConversations(true)}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            もっと読み込む
          </button>
        </div>
      )}
    </div>
  );
}
