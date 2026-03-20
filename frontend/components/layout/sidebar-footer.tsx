'use client';

import { Sun, Moon, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useTheme } from 'next-themes';
import { getFirebaseAuth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type UserInfo = {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly photoURL: string | null;
};

export const SidebarFooter = ({
  user,
  collapsed = false,
}: {
  readonly user: UserInfo | null;
  readonly collapsed?: boolean;
}) => {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <>
      {/* Theme toggle */}
      <div className="border-t border-neutral-300 px-2 py-2 dark:border-neutral-700">
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          {resolvedTheme === 'dark' ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
          {!collapsed && <span>{resolvedTheme === 'dark' ? 'ライトモード' : 'ダークモード'}</span>}
        </button>
      </div>

      {/* User info */}
      {user && (
        <div className="border-t border-neutral-300 px-2 py-3 dark:border-neutral-700">
          <Popover>
            <PopoverTrigger
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? ''}
                  className="h-7 w-7 shrink-0 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                  {(user.displayName ?? user.email ?? '?')[0]?.toUpperCase()}
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm text-neutral-800 dark:text-neutral-200">{user.displayName ?? 'User'}</p>
                  <p className="truncate text-xs text-neutral-500">{user.email}</p>
                </div>
              )}
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              sideOffset={8}
              className="w-48 !rounded-2xl border-neutral-200 bg-white p-1 dark:border-neutral-600 dark:bg-neutral-800"
            >
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 !rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-neutral-700 dark:hover:text-red-300"
                onClick={() => signOut(getFirebaseAuth())}
              >
                <LogOut size={14} />
                ログアウト
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </>
  );
};
