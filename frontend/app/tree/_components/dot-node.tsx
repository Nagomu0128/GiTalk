'use client';

import { memo } from 'react';
import { Handle, Position, type Node as RFNode, type NodeProps } from '@xyflow/react';
import type { DotNodeData } from './types';

export const DotNodeComponent = memo(({ data }: NodeProps<RFNode<DotNodeData>>) => {
  const dotColor = data.dotColor;
  const size = data.isMergeDot ? 'h-[6px] w-[6px]' : 'h-[10px] w-[10px]';
  const outerSize = data.isMergeDot ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div
      className={`flex items-center justify-center ${outerSize} rounded-full cursor-pointer transition-all ${
        data.isSelected ? 'ring-2 ring-amber-400/60 ring-offset-1 ring-offset-transparent' : ''
      } ${!data.isMergeDot ? 'hover:scale-150' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <span className={`block ${size} rounded-full ${dotColor} transition-colors`} />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
});
DotNodeComponent.displayName = 'DotNodeComponent';
