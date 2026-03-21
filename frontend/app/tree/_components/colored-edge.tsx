'use client';

import { memo } from 'react';
import {
  type Edge as RFEdge,
  type EdgeProps,
  getBezierPath,
  BaseEdge,
} from '@xyflow/react';
import type { ColoredEdgeData } from './types';
import { HIGHLIGHT_COLOR } from './types';

export const ColoredEdgeComponent = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  sourcePosition,
  targetPosition,
}: EdgeProps<RFEdge<ColoredEdgeData>>) => {
  const edgeType = data?.edgeType ?? 'segment';
  const isHighlighted = data?.isHighlighted ?? false;
  const isDashedArrow = edgeType === 'merge-arrow' || edgeType === 'cherry-pick-arrow';

  const edgeColor = isHighlighted ? HIGHLIGHT_COLOR : (data?.edgeColor ?? '#888');
  const strokeWidth = isHighlighted ? 3 : isDashedArrow ? 1.5 : 2;

  // Merge/cherry-pick: straight dashed line, shortened to not overlap nodes
  if (isDashedArrow) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const pad = 8;
    const ratio = len > pad * 2 ? pad / len : 0;
    const x1 = sourceX + dx * ratio;
    const y1 = sourceY + dy * ratio;
    const x2 = targetX - dx * ratio;
    const y2 = targetY - dy * ratio;

    return (
      <line
        id={id}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={edgeColor}
        strokeWidth={strokeWidth}
        strokeDasharray="4 3"
        style={{ transition: 'stroke 0.2s' }}
      />
    );
  }

  // Regular edges: smooth bezier curves
  const curvature = edgeType === 'segment' ? 0.1 : 0.4;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: edgeColor,
        strokeWidth,
        transition: 'stroke 0.2s, stroke-width 0.2s',
      }}
    />
  );
});
ColoredEdgeComponent.displayName = 'ColoredEdgeComponent';
