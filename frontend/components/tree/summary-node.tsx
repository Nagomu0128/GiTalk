'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

type SummaryNodeData = {
  readonly aiResponse: string;
  readonly sourceBranchName: string;
  readonly createdAt: string;
  readonly branchColor: string;
  readonly isActive: boolean;
};

const truncate = (text: string, maxLength: number): string =>
  text.length > maxLength ? text.slice(0, maxLength) + '...' : text;

const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

export function SummaryNode({ data }: NodeProps) {
  const nodeData = data as unknown as SummaryNodeData;
  const { aiResponse, sourceBranchName, createdAt, branchColor, isActive } = nodeData;

  return (
    <div
      className={`rounded-lg border-2 border-dashed bg-white px-3 py-2 shadow-sm ${
        isActive ? 'border-blue-500 shadow-lg shadow-blue-200' : 'border-gray-300'
      }`}
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: branchColor,
        borderLeftStyle: 'solid',
        width: 240,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      <div className="mb-1 text-xs font-medium text-gray-700">
        🔀 {sourceBranchName} の要約
      </div>
      <div className="mb-2 text-xs text-gray-500">
        {truncate(aiResponse, 60)}
      </div>
      <div className="border-t pt-1 text-[10px] text-gray-400">
        {formatTime(createdAt)}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}
