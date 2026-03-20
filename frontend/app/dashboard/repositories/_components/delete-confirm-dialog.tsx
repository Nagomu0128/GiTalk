'use client';

export function DeleteConfirmDialog({
  title,
  onCancel,
  onConfirm,
}: {
  readonly title: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-800">
        <h3 className="mb-2 text-lg font-bold text-neutral-900 dark:text-neutral-200">リポジトリを削除しますか？</h3>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          「{title}」を削除します。この操作は取り消せません。
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
