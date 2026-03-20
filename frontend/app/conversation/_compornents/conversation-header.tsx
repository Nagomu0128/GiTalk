import { ArrowLeft, Trash2, Search, Save } from 'lucide-react';

export const ConversationHeader = ({
  title,
  onBack,
  onSearch,
  onPush,
  onDelete,
  branchSelector,
}: {
  readonly title: string;
  readonly onBack: () => void;
  readonly onSearch: () => void;
  readonly onPush: () => void;
  readonly onDelete: () => void;
  readonly branchSelector: React.ReactNode;
}) => (
  <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-300 px-4 dark:border-neutral-700">
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-neutral-800 transition-colors hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-neutral-100"
      >
        <ArrowLeft size={16} />
        <span>ツリーを表示する</span>
      </button>
      <span className="text-neutral-300 dark:text-neutral-600">|</span>
      <span className="truncate text-sm text-neutral-700 dark:text-neutral-400">{title}</span>
    </div>
    <div className="flex items-center gap-2">
      {branchSelector}
      <button
        onClick={onPush}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-300 px-2.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        title="リポジトリに保存"
      >
        <Save size={14} />
        <span>保存</span>
      </button>
      <button
        onClick={onSearch}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        title="検索"
      >
        <Search size={14} />
      </button>
      <button
        onClick={onDelete}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition-colors hover:bg-red-50 hover:text-red-600 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-red-950 dark:hover:text-red-400"
        title="削除"
      >
        <Trash2 size={14} />
      </button>
    </div>
  </header>
);
