'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { useAuthStore } from '@/stores/auth-store';

const API = '/api';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleNewChat = useCallback(async () => {
    try {
      const token = await user?.getIdToken();
      if (!token) return;
      const res = await fetch(`${API}/v1/conversations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新しい会話' }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.id) return;
      router.push(`/conversation/${data.id}`);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }, [user, router]);

  return (
    <div className="flex h-screen w-full bg-neutral-50 dark:bg-neutral-900">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        onNewChat={handleNewChat}
        onDashboard={() => router.push('/dashboard')}
        onRepositories={() => router.push('/dashboard/repositories')}
        user={user ? { displayName: user.displayName, email: user.email, photoURL: user.photoURL } : null}
      />
      <main className="flex flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
