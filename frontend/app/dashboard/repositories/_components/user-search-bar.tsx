'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

type UserResult = {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
};

const API = '/api';

export function UserSearchBar() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReadonlyArray<UserResult>>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    const token = await user?.getIdToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API}/v1/users/search?q=${encodeURIComponent(q.trim())}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setResults(data.data);
      setShowDropdown(true);
    }
    setLoading(false);
  }, [user]);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  }, [search]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (userId: string) => {
    setShowDropdown(false);
    setQuery('');
    router.push(`/dashboard/repositories/${userId}`);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
          placeholder="ユーザーを検索..."
          className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm text-neutral-800 placeholder-neutral-400 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:placeholder-neutral-500 dark:focus:border-neutral-500"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-neutral-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
          {loading && (
            <p className="px-3 py-2 text-xs text-neutral-500">検索中...</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-neutral-500">ユーザーが見つかりません</p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => handleSelect(u.id)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt={u.displayName} className="h-8 w-8 rounded-full" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600 dark:bg-neutral-600 dark:text-neutral-300">
                  {u.displayName.charAt(0)}
                </div>
              )}
              <span className="text-sm text-neutral-800 dark:text-neutral-200">{u.displayName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
