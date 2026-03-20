import { ArrowLeft, HelpCircle, MoreVertical, Search, Save } from 'lucide-react';

export const ConversationHeader = ({
  title,
  onBack,
  onSearch,
  onHelp,
  onPush,
  onMore,
  branchSelector,
}: {
  readonly title: string;
  readonly onBack: () => void;
  readonly onSearch: () => void;
  readonly onHelp: () => void;
  readonly onPush: () => void;
  readonly onMore: () => void;
  readonly branchSelector: React.ReactNode;
}) => (
  <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-700 px-4">
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-neutral-300 transition-colors hover:text-neutral-100"
      >
        <ArrowLeft size={16} />
        <span>ツリーを表示する</span>
      </button>
      <span className="text-neutral-600">|</span>
      <span className="truncate text-sm text-neutral-400">{title}</span>
    </div>
    <div className="flex items-center gap-2">
      {branchSelector}
      <button
        onClick={onPush}
        className="flex h-8 items-center gap-1.5 rounded-full border border-neutral-600 px-3 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
      >
        <Save size={14} />
        <span>保存</span>
      </button>
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
      <button
        onClick={onMore}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-600 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
      >
        <MoreVertical size={14} />
      </button>
    </div>
  </header>
);
