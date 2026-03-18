'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { ConversationCard } from '@/components/cards/conversation-card';

const API = '/api';

type ConversationSummary = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [conversations, setConversations] = useState<ReadonlyArray<ConversationSummary>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      const token = await user?.getIdToken();
      const res = await fetch(`${API}/v1/conversations?limit=6`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.data);
      }
      setLoading(false);
    };
    fetchConversations();
  }, [user]);

  const handleNewConversation = async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) { console.error('Failed to get token'); return; }
      const res = await fetch(`${API}/v1/conversations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新しい会話' }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error('Create conversation failed:', res.status, errBody);
        return;
      }
      const data = await res.json();
      if (!data.id) { console.error('No id in response:', data); return; }
      router.push(`/conversation/${data.id}`);
    } catch (error) {
      console.error('handleNewConversation error:', error);
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
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">ようこそ、{user?.displayName ?? 'User'}さん</h1>
        <button
          onClick={handleNewConversation}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + 新しい会話を始める
        </button>
      </div>

      <section>
        <h2 className="mb-4 text-sm font-medium text-gray-500">最近の会話</h2>
        {loading && <p className="text-sm text-gray-400">読み込み中...</p>}
        {!loading && conversations.length === 0 && (
          <p className="text-sm text-gray-400">まだ会話がありません。新しい会話を始めましょう。</p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {conversations.map((conv) => (
            <ConversationCard key={conv.id} id={conv.id} title={conv.title} updatedAt={conv.updatedAt} onDelete={handleDelete} />
          ))}
        </div>
      </section>
    </div>
  );
}
