import { PenLine, Search, LayoutDashboard, ChevronLeft, FolderGit2 } from 'lucide-react';
import Image from 'next/image';

export const Sidebar = ({
  collapsed,
  onToggle,
  onNewChat,
  onSearch,
  onDashboard,
  onRepositories,
}: {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly onNewChat: () => void;
  readonly onSearch: () => void;
  readonly onDashboard: () => void;
  readonly onRepositories: () => void;
}) => (
  <aside
    className={`flex h-full shrink-0 flex-col border-r border-neutral-700 bg-neutral-950 transition-all ${
      collapsed ? 'w-12' : 'w-64'
    }`}
  >
    <div className="flex h-10 items-center justify-between px-3">
      <div className="flex items-center gap-2">
        <Image src="/dark_mode_logo.png" alt="GiTalk" width={20} height={20} className="shrink-0" />
        {!collapsed && <span className="text-sm font-bold text-neutral-200">GiTalk</span>}
      </div>
      <button
        onClick={onToggle}
        className="text-neutral-400 transition-colors hover:text-neutral-200"
      >
        <ChevronLeft
          size={18}
          className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
        />
      </button>
    </div>

    <nav className="flex flex-col gap-1 px-2">
      <button
        onClick={onNewChat}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <PenLine size={16} className="shrink-0" />
        {!collapsed && <span>新規チャットを作る</span>}
      </button>

      <button
        onClick={onSearch}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <Search size={16} className="shrink-0" />
        {!collapsed && <span>検索</span>}
      </button>

      <button
        onClick={onDashboard}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <LayoutDashboard size={16} className="shrink-0" />
        {!collapsed && <span>Dash Board</span>}
      </button>

      <button
        onClick={onRepositories}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800"
      >
        <FolderGit2 size={16} className="shrink-0" />
        {!collapsed && <span>リポジトリ</span>}
      </button>
    </nav>
  </aside>
);
