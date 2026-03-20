'use client';

import { memo } from 'react';
import { Handle, Position, type Node as RFNode, type NodeProps } from '@xyflow/react';
import type { DotNodeData } from './types';

export const DotNodeComponent = memo(({ data }: NodeProps<RFNode<DotNodeData>>) => {
  const dotColor = data.dotColor;

  return (
    <div
      className={`flex items-center justify-center h-5 w-5 rounded-full hover:bg-neutral-700 cursor-pointer ${data.isSelected ? 'ring-2 ring-amber-400/50' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <span className={`block h-3 w-3 rounded-full ${dotColor} transition-colors`} />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
});
DotNodeComponent.displayName = 'DotNodeComponent';
