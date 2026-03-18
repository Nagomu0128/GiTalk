'use client';

import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { getFirebaseAuth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';

const API = 'http://localhost:8080';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(getFirebaseAuth());
  };

  const handleNewConversation = async () => {
    const token = await user?.getIdToken();
    const res = await fetch(`${API}/v1/conversations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新しい会話' }),
    });
    const data = await res.json();
    router.push(`/conversation/${data.id}`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-gray-600">ようこそ、{user?.displayName ?? 'User'}さん</p>
      <div className="flex gap-2">
        <button
          onClick={handleNewConversation}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + 新しい会話を始める
        </button>
        <button
          onClick={handleLogout}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300"
        >
          ログアウト
        </button>
      </div>
    </div>
  );
}
