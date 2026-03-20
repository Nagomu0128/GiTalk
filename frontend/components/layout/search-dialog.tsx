'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MessageSquare, GitBranch, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const API = '/api';

const ellipsis = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}...` : text;

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

type SearchResults = {
  readonly conversations: ReadonlyArray<ConversationResult>;
  readonly nodes: ReadonlyArray<NodeResult>;
  readonly has_more: boolean;
};

export const SearchDialog = ({
  open,
  onOpenChange,
  conversationId,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly conversationId?: string;
}) => {
  const isConversationScope = !!conversationId;
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults(null);
      setSearched(false);
    }
  }, [open]);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setSearched(true);
    try {
      const token = await user?.getIdToken();
      const params = new URLSearchParams({
        q: trimmed,
        scope: isConversationScope ? 'nodes' : 'all',
        limit: '20',
      });
      if (conversationId) params.set('conversation_id', conversationId);
      const res = await fetch(
        `${API}/v1/search?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        setResults(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [query, user, isConversationScope, conversationId]);

  const highlightText = useCallback((container: HTMLElement, searchText: string) => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const lowerSearch = searchText.toLowerCase();
    const matches: { node: Text; index: number }[] = [];

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const idx = node.textContent?.toLowerCase().indexOf(lowerSearch) ?? -1;
      if (idx >= 0) matches.push({ node, index: idx });
    }

    const marks: HTMLElement[] = [];
    matches.forEach(({ node: textNode, index }) => {
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + searchText.length);
      const mark = document.createElement('mark');
      mark.className = 'bg-yellow-400/60 text-inherit rounded-sm px-0.5';
      range.surroundContents(mark);
      marks.push(mark);
    });

    if (marks[0]) {
      marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 3秒後にハイライト解除
    setTimeout(() => {
      marks.forEach((mark) => {
        const parent = mark.parentNode;
        if (!parent) return;
        parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
        parent.normalize();
      });
    }, 3000);
  }, []);

  const handleNavigate = useCallback(
    (targetConversationId: string, nodeId?: string) => {
      onOpenChange(false);

      if (isConversationScope && nodeId) {
        setTimeout(() => {
          const el = document.getElementById(`node-${nodeId}`);
          if (!el) return;
          highlightText(el, query.trim());
        }, 100);
        return;
      }

      router.push(`/conversation/${targetConversationId}`);
    },
    [onOpenChange, router, isConversationScope, highlightText, query],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch],
  );

  const totalResults = (results?.conversations.length ?? 0) + (results?.nodes.length ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-2xl overflow-hidden border-neutral-500 bg-neutral-700 p-6 text-neutral-100 shadow-2xl shadow-black/60"
      >
        <DialogHeader>
          <DialogTitle className="text-lg text-neutral-100">
            {isConversationScope ? 'この会話内を検索' : '検索'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isConversationScope ? 'この会話内のメッセージを検索...' : '会話やメッセージを検索...'}
              className="h-10 border-neutral-500 bg-neutral-600 pl-9 text-neutral-100 placeholder:text-neutral-400 focus-visible:border-neutral-400 focus-visible:ring-neutral-400/30"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="shrink-0 rounded-lg bg-neutral-600 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-500 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : '検索'}
          </button>
        </div>

        {searched && (
          <ScrollArea className="mt-1 max-h-96">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-neutral-400" />
              </div>
            ) : totalResults === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">
                「{query}」に一致する結果はありませんでした
              </p>
            ) : (
              <div className="space-y-5">
                {!isConversationScope && results && results.conversations.length > 0 && (
                  <div>
                    <h4 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      会話
                    </h4>
                    <div className="space-y-1">
                      {results.conversations.map((conv) => (
                        <button
                          key={conv.id}
                          onClick={() => handleNavigate(conv.id)}
                          className="flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-neutral-100 transition-colors hover:bg-neutral-600"
                        >
                          <MessageSquare size={15} className="shrink-0 text-neutral-400" />
                          <span className="min-w-0 truncate">{conv.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {results && results.nodes.length > 0 && (
                  <div>
                    <h4 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      メッセージ
                    </h4>
                    <div className="space-y-1">
                      {results.nodes.map((node) => (
                        <button
                          key={node.id}
                          onClick={() => handleNavigate(node.conversation_id, node.id)}
                          className="block w-full min-w-0 overflow-hidden rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-600"
                        >
                          <div className="flex min-w-0 items-center gap-1.5 text-xs text-neutral-200">
                            <span className="min-w-0 truncate font-medium">{node.conversation_title}</span>
                            <span className="shrink-0 text-neutral-500">/</span>
                            <GitBranch size={11} className="shrink-0 text-neutral-400" />
                            <span className="min-w-0 truncate">{node.branch_name}</span>
                          </div>
                          {node.user_message_excerpt && (
                            <p className="mt-1 text-xs text-neutral-300">
                              You: {ellipsis(node.user_message_excerpt, 80)}
                            </p>
                          )}
                          {node.ai_response_excerpt && (
                            <p className="text-xs text-neutral-400">
                              AI: {ellipsis(node.ai_response_excerpt, 80)}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
