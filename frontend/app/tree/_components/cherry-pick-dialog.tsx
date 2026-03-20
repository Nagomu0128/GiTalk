import { Button } from '@/components/ui/button';

export const CherryPickConfirmDialog = ({
  visible,
  onConfirm,
  onCancel,
}: {
  readonly visible: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-800 shadow-xl">
        <h3 className="mb-2 text-base font-bold text-neutral-900 dark:text-neutral-100">このコンテキストを取り込みますか？</h3>
        <p className="mb-5 text-sm text-neutral-400">
          選択したノードの内容を現在のアクティブブランチにコピーします。
        </p>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            onClick={onCancel}
          >
            キャンセル
          </Button>
          <Button
            size="sm"
            className="bg-amber-500 text-neutral-900 hover:bg-amber-400"
            onClick={onConfirm}
          >
            取り込む
          </Button>
        </div>
      </div>
    </div>
  );
};
