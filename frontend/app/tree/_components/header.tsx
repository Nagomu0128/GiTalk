import { ArrowLeft, Search, HelpCircle } from 'lucide-react';

export const Header = ({
  title,
  onBack,
  onSearch,
  onHelp,
}: {
  readonly title: string;
  readonly onBack: () => void;
  readonly onSearch: () => void;
  readonly onHelp: () => void;
}) => (
  <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-700">
    <button
      onClick={onBack}
      className="flex items-center gap-2 text-sm text-neutral-800 transition-colors hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-neutral-100"
    >
      <ArrowLeft size={16} />
      <span>チャットに戻る</span>
    </button>
    <span className="truncate text-sm text-neutral-700 dark:text-neutral-400">{title}</span>
    <div className="flex items-center gap-2">
      <button
        onClick={onSearch}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
      >
        <Search size={14} />
      </button>
      <button
        onClick={onHelp}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-600 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
      >
        <HelpCircle size={14} />
      </button>
    </div>
  </header>
);
