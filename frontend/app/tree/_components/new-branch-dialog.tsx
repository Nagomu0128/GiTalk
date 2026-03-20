import { Button } from '@/components/ui/button';

export const NewBranchDialog = ({
  visible,
  loading,
  onConfirm,
  onCancel,
  position,
}: {
  readonly visible: boolean;
  readonly loading: boolean;
  readonly position: { readonly x: number; readonly y: number };
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) => {
  if (!visible) return null;

  return (
    <div
      className="fixed z-50 rounded-xl border border-neutral-600 bg-neutral-200 px-6 py-5 shadow-xl"
      style={{ left: position.x, top: position.y, transform: 'translate(-50%, -50%)' }}
    >
      <p className="mb-4 text-center text-sm text-neutral-800">あたらしいチャットに移動しますか？</p>
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="min-w-[70px] border-neutral-400 bg-white text-neutral-800 hover:bg-neutral-100"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? '...' : 'Yes'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-w-[70px] border-neutral-400 bg-white text-neutral-800 hover:bg-neutral-100"
          onClick={onCancel}
          disabled={loading}
        >
          cancel
        </Button>
      </div>
    </div>
  );
};
