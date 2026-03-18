import type { NodeRecord } from '../infra/node.js';

export const findLCA = (
  pathA: ReadonlyArray<NodeRecord>,
  pathB: ReadonlyArray<NodeRecord>,
): NodeRecord | undefined => {
  const ancestorsA = new Set(pathA.map((n) => n.id));
  return pathB.find((n) => ancestorsA.has(n.id));
};
