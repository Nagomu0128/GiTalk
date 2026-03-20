'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { PenLine, Search, LayoutDashboard, ChevronLeft, FolderGit2 } from 'lucide-react';
import Image from 'next/image';
import { SearchDialog } from '@/components/layout/search-dialog';
import { SidebarFooter } from '@/components/layout/sidebar-footer';
import { useThemeImage } from '@/hooks/use-theme-image';

type UserInfo = {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly photoURL: string | null;
};

export const AppSidebar = ({
  collapsed,
  onToggle,
  onNewChat,
  onDashboard,
  onRepositories,
  user,
}: {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly onNewChat: () => void;
  readonly onDashboard: () => void;
  readonly onRepositories: () => void;
  readonly user: UserInfo | null;
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const logo = useThemeImage('logo');
  const pathname = usePathname();

  const navItems = [
    { icon: Search, label: '検索', onClick: () => setSearchOpen(true), active: false },
    { icon: PenLine, label: '新規チャットを作る', onClick: onNewChat, active: false },
    { icon: LayoutDashboard, label: '会話一覧', onClick: onDashboard, active: pathname === '/dashboard' },
    { icon: FolderGit2, label: 'リポジトリ', onClick: onRepositories, active: pathname === '/dashboard/repositories' },
  ];

  return (
    <>
      <aside
        className={`flex h-full shrink-0 flex-col border-r border-neutral-300 bg-neutral-50 transition-all dark:border-neutral-700 dark:bg-neutral-950 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="flex h-12 items-center justify-between px-3">
          <div className="flex items-center gap-2.5">
            <Image src={logo} alt="GiTalk" width={32} height={32} className="shrink-0" />
            {!collapsed && <span className="text-base font-bold text-neutral-800 dark:text-neutral-200">GiTalk</span>}
          </div>
          <button
            onClick={onToggle}
            className="text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <ChevronLeft
              size={18}
              className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                item.active
                  ? 'bg-neutral-200 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              <item.icon size={16} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <SidebarFooter user={user} collapsed={collapsed} />
      </aside>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
};
