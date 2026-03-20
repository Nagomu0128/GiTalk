'use client';

import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getFirebaseAuth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';
import { SearchBar } from './search-bar';

export function GlobalHeader() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(getFirebaseAuth());
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4">
      <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-lg font-bold text-gray-900">
        <Image src="/light_mode_logo.png" alt="GiTalk" width={24} height={24} />
        GiTalk
      </button>
      <div className="flex items-center gap-4">
        <SearchBar />
        <span className="text-sm text-gray-600">{user?.displayName ?? 'User'}</span>
        <button
          onClick={handleLogout}
          className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}
