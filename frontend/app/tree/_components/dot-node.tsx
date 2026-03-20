'use client';

import { memo } from 'react';
import { Handle, Position, type Node as RFNode, type NodeProps } from '@xyflow/react';
import type { DotNodeData } from './types';

export const DotNodeComponent = memo(({ data }: NodeProps<RFNode<DotNodeData>>) => {
  const dotColor = data.dotColor;
  const outerSize = data.isMergeDot ? 'h-3 w-3' : 'h-5 w-5';

  return (
    <div
      className={`group flex items-center justify-center ${outerSize} rounded-full cursor-pointer ${
        data.isSelected ? 'ring-2 ring-amber-400/60 ring-offset-1 ring-offset-transparent' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      {data.isMergeDot ? (
        <span className={`block h-[8px] w-[8px] rounded-full border-[2px] border-violet-500 bg-transparent transition-all`} />
      ) : (
        <span className={`block h-[10px] w-[10px] group-hover:h-[14px] group-hover:w-[14px] rounded-full ${dotColor} transition-all`} />
      )}
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
});
DotNodeComponent.displayName = 'DotNodeComponent';
