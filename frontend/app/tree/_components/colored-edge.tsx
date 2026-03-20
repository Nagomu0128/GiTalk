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

  // Merge/cherry-pick: curved dashed line from source to target
  if (isDashedArrow) {
    const midY = (sourceY + targetY) / 2;
    const path = `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;

    return (
      <path
        id={id}
        d={path}
        fill="none"
        stroke={edgeColor}
        strokeWidth={strokeWidth}
        strokeDasharray="6 4"
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
