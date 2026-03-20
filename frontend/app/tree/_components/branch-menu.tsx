import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { BranchMenuState } from './types';
import { BRANCH_MENU_ITEMS } from './types';

export const BranchPopover = ({
  state,
  onAction,
  onClose,
}: {
  readonly state: BranchMenuState;
  readonly onAction: (action: string, branchIndex: number) => void;
  readonly onClose: () => void;
}) => (
  <Popover key={`branch-${state.branchIndex}-${state.x}-${state.y}`} open={state.visible} onOpenChange={(open) => { if (!open) onClose(); }}>
    <PopoverTrigger
      className="pointer-events-none fixed h-0 w-0"
      style={{ left: state.x, top: state.y }}
    />
    <PopoverContent
      side="right"
      sideOffset={8}
      align="start"
      className="w-auto min-w-[120px] !rounded-2xl border-neutral-600 bg-neutral-800 p-1"
    >
      {BRANCH_MENU_ITEMS.map((item) => (
        <Button
          key={item}
          variant="ghost"
          size="sm"
          className="w-full justify-start !rounded-xl text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100"
          onClick={() => {
            onAction(item, state.branchIndex);
            onClose();
          }}
        >
          {item}
        </Button>
      ))}
    </PopoverContent>
  </Popover>
);
