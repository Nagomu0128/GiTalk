'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { UserSearchBar } from './_components/user-search-bar';

const API = '/api';

export default function RepositoriesPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const redirect = async () => {
      const token = await user?.getIdToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API}/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        router.replace(`/dashboard/repositories/${data.id}`);
      } else {
        setLoading(false);
      }
    };
    redirect(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
        <UserSearchBar />
        <p className="text-sm text-neutral-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
      <UserSearchBar />
      <p className="text-sm text-neutral-500">ログインしてください</p>
    </div>
  );
}
