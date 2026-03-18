'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

type TreeNodeData = {
  readonly userMessage: string;
  readonly aiResponse: string;
  readonly model: string;
  readonly createdAt: string;
  readonly branchColor: string;
  readonly isActive: boolean;
  readonly isOrphan: boolean;
  readonly nodeType: 'message' | 'summary' | 'system';
};

const truncate = (text: string, maxLength: number): string =>
  text.length > maxLength ? text.slice(0, maxLength) + '...' : text;

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

export function TreeNode({ data }: NodeProps) {
  const nodeData = data as unknown as TreeNodeData;
  const {
    userMessage,
    aiResponse,
    model,
    createdAt,
    branchColor,
    isActive,
    isOrphan,
  } = nodeData;

  return (
    <div
      className={`rounded-lg border-2 bg-white px-3 py-2 shadow-sm transition-all ${
        isActive
          ? 'border-blue-500 shadow-lg shadow-blue-200'
          : 'border-gray-200'
      }`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: branchColor,
        opacity: isOrphan ? 0.4 : 1,
        width: 240,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      <div className="mb-1 text-xs text-gray-700">
        <span>👤 </span>
        <span>{truncate(userMessage, 40)}</span>
      </div>
      <div className="mb-2 text-xs text-gray-500">
        <span>🤖 </span>
        <span>{truncate(aiResponse, 40)}</span>
      </div>
      <div className="flex items-center gap-2 border-t pt-1 text-[10px] text-gray-400">
        <span>{formatTime(createdAt)}</span>
        <span>{model}</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}
