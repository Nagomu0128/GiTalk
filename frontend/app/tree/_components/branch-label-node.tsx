'use client';

import { memo } from 'react';
import { Handle, Position, type Node as RFNode, type NodeProps } from '@xyflow/react';
import { Badge } from '@/components/ui/badge';
import type { BranchLabelNodeData } from './types';

export const BranchLabelNodeComponent = memo(({ data }: NodeProps<RFNode<BranchLabelNodeData>>) => {
  const isMergeHighlighted = data.isMergeHighlighted;

  return (
    <div className="flex items-center gap-1">
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Badge
        variant="outline"
        className={`h-8 cursor-pointer justify-center transition-colors px-3 ${
          isMergeHighlighted
            ? 'border-amber-500 bg-amber-500/20 text-amber-300'
            : data.isSelected
              ? 'border-amber-500 bg-amber-500/20 text-amber-300'
              : 'border-neutral-600 bg-neutral-800 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-700'
        }`}
      >
        {data.branchName}
      </Badge>
      {data.mergeRole && (
        <span className="text-xs text-amber-400 whitespace-nowrap">
          {data.mergeRole === 'merge-target' ? 'merge to 選択中' : 'merge 選択中'}
        </span>
      )}
    </div>
  );
});
BranchLabelNodeComponent.displayName = 'BranchLabelNodeComponent';
