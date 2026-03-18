'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

const API = '/api';

type ConversationResult = {
  readonly id: string;
  readonly title: string;
};

type NodeResult = {
  readonly id: string;
  readonly conversation_id: string;
  readonly conversation_title: string;
  readonly branch_name: string;
  readonly user_message_excerpt: string;
  readonly ai_response_excerpt: string;
};

export function SearchBar() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ conversations: ReadonlyArray<ConversationResult>; nodes: ReadonlyArray<NodeResult> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    const token = await user?.getIdToken();
    const res = await fetch(`${API}/v1/search?q=${encodeURIComponent(query.trim())}&scope=all&limit=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setResults(data);
      setShowResults(true);
    }
    setLoading(false);
  }, [query, user]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
      if (e.key === 'Escape') setShowResults(false);
    },
    [handleSearch],
  );

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results && setShowResults(true)}
          placeholder="🔍 検索..."
          className="w-48 rounded border border-gray-300 px-3 py-1 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {showResults && results && (
        <div className="absolute right-0 top-full z-50 mt-1 w-96 rounded-xl border bg-white shadow-lg">
          <div className="max-h-80 overflow-y-auto p-3">
            {results.conversations.length === 0 && results.nodes.length === 0 && (
              <p className="text-center text-sm text-gray-400">「{query}」に一致する結果はありませんでした</p>
            )}

            {results.conversations.length > 0 && (
              <div className="mb-3">
                <h4 className="mb-1 text-xs font-medium text-gray-500">会話</h4>
                {results.conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => { router.push(`/conversation/${conv.id}`); setShowResults(false); }}
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    📝 {conv.title}
                  </button>
                ))}
              </div>
            )}

            {results.nodes.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-medium text-gray-500">メッセージ</h4>
                {results.nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => { router.push(`/conversation/${node.conversation_id}`); setShowResults(false); }}
                    className="w-full rounded px-2 py-1.5 text-left hover:bg-gray-50"
                  >
                    <div className="text-xs text-gray-600">{node.conversation_title} / 🌿 {node.branch_name}</div>
                    {node.user_message_excerpt && (
                      <div className="truncate text-xs text-gray-400">👤 {node.user_message_excerpt}</div>
                    )}
                    {node.ai_response_excerpt && (
                      <div className="truncate text-xs text-gray-400">🤖 {node.ai_response_excerpt}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="border-t px-3 py-2">
            <button onClick={() => setShowResults(false)} className="text-xs text-gray-400 hover:text-gray-600">
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
