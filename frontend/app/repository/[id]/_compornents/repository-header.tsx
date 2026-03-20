import { ArrowLeft, Copy } from 'lucide-react';

export const RepositoryHeader = ({
  title,
  visibility,
  description,
  onBack,
  onClone,
}: {
  readonly title: string;
  readonly visibility: 'private' | 'public';
  readonly description: string | null;
  readonly onBack: () => void;
  readonly onClone: () => void;
}) => (
  <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-300 px-4 dark:border-neutral-700">
    <div className="flex items-center gap-3">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-neutral-800 transition-colors hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-neutral-100"
      >
        <ArrowLeft size={16} />
        <span>リポジトリ一覧</span>
      </button>
      <span className="text-neutral-300 dark:text-neutral-600">|</span>
      <span className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">{title}</span>
      <span className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
        {visibility}
      </span>
      {description && (
        <>
          <span className="text-neutral-300 dark:text-neutral-600">|</span>
          <span className="truncate text-xs text-neutral-500">{description}</span>
        </>
      )}
    </div>
    <div className="flex items-center gap-2">
      <button
        onClick={onClone}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      >
        <Copy size={13} />
        <span>コピーして使う</span>
      </button>
    </div>
  </header>
);
