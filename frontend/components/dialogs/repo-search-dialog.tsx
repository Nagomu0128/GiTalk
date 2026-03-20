'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Search, GitBranch, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

type RepoNode = {
  readonly id: string;
  readonly parentRepositoryNodeId: string | null;
  readonly nodeType: string;
  readonly userMessage: string;
  readonly aiResponse: string;
  readonly model: string;
  readonly originalCreatedAt: string;
};

type RepoBranch = {
  readonly repository_branch_id: string;
  readonly name: string;
  readonly nodes: ReadonlyArray<RepoNode>;
};

type SearchHit = {
  readonly branchId: string;
  readonly branchName: string;
  readonly node: RepoNode;
  readonly matchField: 'user' | 'ai';
  readonly excerpt: string;
};

const ellipsis = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}...` : text;

const extractExcerpt = (text: string, query: string, contextLen: number): string => {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx < 0) return ellipsis(text, contextLen * 2);
  const start = Math.max(0, idx - contextLen);
  const end = Math.min(text.length, idx + query.length + contextLen);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
};

export const RepoSearchDialog = ({
  open,
  onOpenChange,
  branches,
  onNavigate,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly branches: ReadonlyArray<RepoBranch>;
  readonly onNavigate: (branchId: string, nodeId: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery('');
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  const hits = useMemo((): ReadonlyArray<SearchHit> => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const results: SearchHit[] = [];
    branches.forEach((branch) => {
      branch.nodes.forEach((node) => {
        if (node.userMessage && node.userMessage.toLowerCase().includes(trimmed)) {
          results.push({
            branchId: branch.repository_branch_id,
            branchName: branch.name,
            node,
            matchField: 'user',
            excerpt: extractExcerpt(node.userMessage, query.trim(), 40),
          });
        }
        if (node.aiResponse && node.aiResponse.toLowerCase().includes(trimmed)) {
          results.push({
            branchId: branch.repository_branch_id,
            branchName: branch.name,
            node,
            matchField: 'ai',
            excerpt: extractExcerpt(node.aiResponse, query.trim(), 40),
          });
        }
      });
    });
    return results;
  }, [query, branches]);

  const handleSelect = useCallback(
    (hit: SearchHit) => {
      onNavigate(hit.branchId, hit.node.id);
      handleOpenChange(false);
    },
    [onNavigate, handleOpenChange],
  );

  const searched = query.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-2xl overflow-hidden border-neutral-300 bg-neutral-50 p-6 text-neutral-900 shadow-2xl dark:border-neutral-500 dark:bg-neutral-700 dark:text-neutral-100 dark:shadow-black/60"
      >
        <DialogHeader>
          <DialogTitle className="text-lg text-neutral-900 dark:text-neutral-100">
            リポジトリ内を検索
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="メッセージを検索..."
            className="h-10 border-neutral-300 bg-neutral-50 pl-9 pr-9 text-neutral-900 placeholder:text-neutral-400 focus-visible:border-blue-400 focus-visible:ring-blue-400/30 dark:border-neutral-500 dark:bg-neutral-600 dark:text-neutral-100"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {searched && (
          <ScrollArea className="mt-1 max-h-96">
            {hits.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">
                「{query.trim()}」に一致する結果はありませんでした
              </p>
            ) : (
              <div>
                <p className="mb-2 px-1 text-xs text-neutral-400">
                  {hits.length} 件の結果
                </p>
                <div className="space-y-1">
                  {hits.map((hit, i) => (
                    <button
                      key={`${hit.node.id}-${hit.matchField}-${i}`}
                      onClick={() => handleSelect(hit)}
                      className="block w-full min-w-0 overflow-hidden rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-600"
                    >
                      <div className="flex min-w-0 items-center gap-1.5 text-xs text-neutral-800 dark:text-neutral-200">
                        <GitBranch size={11} className="shrink-0 text-neutral-400" />
                        <span className="min-w-0 truncate font-medium">{hit.branchName}</span>
                        <span className="shrink-0 rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-600 dark:text-neutral-400">
                          {hit.matchField === 'user' ? 'You' : 'AI'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                        {hit.excerpt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
