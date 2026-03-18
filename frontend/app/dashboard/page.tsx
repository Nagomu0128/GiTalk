'use client';

import { signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    await signOut(getFirebaseAuth());
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-gray-600">ようこそ、{user?.displayName ?? 'User'}さん</p>
      <button
        onClick={handleLogout}
        className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300"
      >
        ログアウト
      </button>
    </div>
  );
}
