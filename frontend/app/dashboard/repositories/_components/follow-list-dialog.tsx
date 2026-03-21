'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const API = '/api';

type FollowUser = {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
};

export const FollowListDialog = ({
  open,
  onOpenChange,
  userId,
  mode,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly userId: string;
  readonly mode: 'followers' | 'following';
}) => {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [users, setUsers] = useState<ReadonlyArray<FollowUser>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchList = async () => {
      setLoading(true);
      const token = await user?.getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API}/v1/users/${userId}/${mode}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data);
      }
      setLoading(false);
    };
    fetchList();
  }, [open, userId, mode, user]);

  const handleNavigate = (targetUserId: string) => {
    onOpenChange(false);
    router.push(`/dashboard/repositories/${targetUserId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-sm border-neutral-200 bg-white text-neutral-900 shadow-2xl dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100">
        <DialogHeader>
          <DialogTitle className="text-neutral-900 dark:text-neutral-100">
            {mode === 'followers' ? 'Followers' : 'Following'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-80">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-neutral-400" />
            </div>
          ) : users.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-500">
              {mode === 'followers' ? 'No followers yet' : 'Not following anyone'}
            </p>
          ) : (
            <div className="space-y-1">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleNavigate(u.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
                >
                  {u.avatarUrl ? (
                    <img
                      src={u.avatarUrl}
                      alt={u.displayName}
                      className="h-9 w-9 shrink-0 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-600 dark:bg-neutral-600 dark:text-neutral-300">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    {u.displayName}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
