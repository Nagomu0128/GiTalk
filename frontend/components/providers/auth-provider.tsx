'use client';

import { useEffect } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { getFirebaseAuth } from '@/lib/firebase';
import { useAuthStore } from '@/stores/auth-store';

const PUBLIC_PATHS = ['/', '/login'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(getFirebaseAuth(), (firebaseUser) => {
      setUser(firebaseUser);
    });
    return unsubscribe;
  }, [setUser]);

  useEffect(() => {
    if (loading) return;

    const isPublicPath = PUBLIC_PATHS.includes(pathname);

    if (!user && !isPublicPath) {
      router.push('/login');
    }

    if (user && pathname === '/login') {
      router.push('/dashboard');
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
