'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: '💬 会話', matchPath: '/dashboard' },
  { href: '/dashboard/conversations', label: '📂 会話一覧', matchPath: '/dashboard/conversations' },
  { href: '/dashboard/repositories', label: '📦 リポジトリ', matchPath: '/dashboard/repositories' },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-48 flex-col border-r bg-gray-50 p-3">
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.matchPath;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-blue-50 font-medium text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
