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
  <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-700 px-4">
    <button
      onClick={onBack}
      className="flex items-center gap-2 text-sm text-neutral-300 transition-colors hover:text-neutral-100"
    >
      <ArrowLeft size={16} />
      <span>チャットに戻る</span>
    </button>
    <span className="truncate text-sm text-neutral-400">{title}</span>
    <div className="flex items-center gap-2">
      <button
        onClick={onSearch}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-600 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
      >
        <Search size={14} />
      </button>
      <button
        onClick={onHelp}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-600 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
      >
        <HelpCircle size={14} />
      </button>
    </div>
  </header>
);
