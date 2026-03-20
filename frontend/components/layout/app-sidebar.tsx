'use client';

import { PenLine, Search, LayoutDashboard, ChevronLeft, FolderGit2, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type UserInfo = {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly photoURL: string | null;
};

export const AppSidebar = ({
  collapsed,
  onToggle,
  onNewChat,
  onSearch,
  onDashboard,
  onRepositories,
  user,
}: {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly onNewChat: () => void;
  readonly onSearch: () => void;
  readonly onDashboard: () => void;
  readonly onRepositories: () => void;
  readonly user: UserInfo | null;
}) => (
  <aside
    className={`flex h-full shrink-0 flex-col border-r border-neutral-700 bg-neutral-950 transition-all ${
      collapsed ? 'w-12' : 'w-64'
    }`}
  >
    <button
      onClick={onToggle}
      className="flex h-10 items-center justify-end px-3 text-neutral-400 transition-colors hover:text-neutral-200"
    >
      <ChevronLeft
        size={18}
        className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
      />
    </button>

    <nav className="flex flex-1 flex-col gap-1 px-2">
      <button
        onClick={onNewChat}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <PenLine size={16} className="shrink-0" />
        {!collapsed && <span>新規チャットを作る</span>}
      </button>

      <button
        onClick={onSearch}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <Search size={16} className="shrink-0" />
        {!collapsed && <span>検索</span>}
      </button>

      <button
        onClick={onDashboard}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <LayoutDashboard size={16} className="shrink-0" />
        {!collapsed && <span>Dash Board</span>}
      </button>

      <button
        onClick={onRepositories}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <FolderGit2 size={16} className="shrink-0" />
        {!collapsed && <span>リポジトリ</span>}
      </button>
    </nav>

    {/* User info */}
    {user && (
      <div className="border-t border-neutral-700 px-2 py-3">
        <Popover>
          <PopoverTrigger
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-neutral-800"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? ''}
                className="h-7 w-7 shrink-0 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-xs font-bold text-neutral-300">
                {(user.displayName ?? user.email ?? '?')[0]?.toUpperCase()}
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm text-neutral-200">{user.displayName ?? 'User'}</p>
                <p className="truncate text-xs text-neutral-500">{user.email}</p>
              </div>
            )}
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            sideOffset={8}
            className="w-48 !rounded-2xl border-neutral-600 bg-neutral-800 p-1"
          >
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 !rounded-xl text-red-400 hover:bg-neutral-700 hover:text-red-300"
              onClick={() => signOut(getFirebaseAuth())}
            >
              <LogOut size={14} />
              ログアウト
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    )}
  </aside>
);
