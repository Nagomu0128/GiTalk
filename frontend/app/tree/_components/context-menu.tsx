import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ContextMenuState } from './types';
import { CONTEXT_MENU_ITEMS } from './types';

export const NodeContextMenuPopover = ({
  state,
  onAction,
  onClose,
}: {
  readonly state: ContextMenuState;
  readonly onAction: (action: string, nodeId: string) => void;
  readonly onClose: () => void;
}) => (
  <Popover key={`${state.nodeId}-${state.x}-${state.y}`} open={state.visible} onOpenChange={(open) => { if (!open) onClose(); }}>
    <PopoverTrigger
      className="pointer-events-none fixed h-0 w-0"
      style={{ left: state.x, top: state.y }}
    />
    <PopoverContent
      side="right"
      sideOffset={8}
      align="start"
      className="w-auto min-w-[140px] !rounded-2xl border-neutral-600 bg-neutral-800 p-1"
    >
      {CONTEXT_MENU_ITEMS.map((item) => (
        <Button
          key={item}
          variant="ghost"
          size="sm"
          className="w-full justify-start !rounded-xl text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100"
          onClick={() => {
            onAction(item, state.nodeId);
            onClose();
          }}
        >
          {item}
        </Button>
      ))}
    </PopoverContent>
  </Popover>
);
