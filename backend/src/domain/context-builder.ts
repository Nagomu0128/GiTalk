import { match } from 'ts-pattern';
import type { NodeRecord } from '../infra/node.js';

type Content = {
  readonly role: 'user' | 'model';
  readonly parts: ReadonlyArray<{ readonly text: string }>;
};

type ContextMode = 'full' | 'summary' | 'minimal';

const MINIMAL_NODE_COUNT = 10;
const SUMMARY_THRESHOLD_TOKENS = 100_000;
const SUMMARY_TARGET_TOKENS = 80_000;

const nodeToContents = (node: NodeRecord): ReadonlyArray<Content> =>
  match(node.nodeType)
    .with('system', () => [] as ReadonlyArray<Content>)
    .with('summary', () => {
      const metadata = node.metadata as { merge_source_branch_name?: string } | null;
      const branchName = metadata?.merge_source_branch_name ?? '';
      return [
        { role: 'user' as const, parts: [{ text: `以下は別トピック「${branchName}」の要約です` }] },
        { role: 'model' as const, parts: [{ text: node.aiResponse }] },
      ];
    })
    .with('message', () => [
      { role: 'user' as const, parts: [{ text: node.userMessage }] },
      { role: 'model' as const, parts: [{ text: node.aiResponse }] },
    ])
    .exhaustive();

const applyMinimalMode = (path: ReadonlyArray<NodeRecord>): ReadonlyArray<NodeRecord> =>
  path.slice(-MINIMAL_NODE_COUNT);

const applySummaryMode = (
  path: ReadonlyArray<NodeRecord>,
): { readonly nodes: ReadonlyArray<NodeRecord>; readonly needsSummarization: boolean; readonly summarizeUpTo: number } => {
  const totalTokens = path.reduce((sum, n) => sum + n.tokenCount, 0);

  if (totalTokens <= SUMMARY_THRESHOLD_TOKENS) {
    return { nodes: path, needsSummarization: false, summarizeUpTo: 0 };
  }

  let runningTokens = totalTokens;
  let summarizeUpTo = 0;

  path.some((node, idx) => {
    if (runningTokens <= SUMMARY_TARGET_TOKENS) return true;
    runningTokens -= node.tokenCount;
    summarizeUpTo = idx + 1;
    return false;
  });

  return { nodes: path, needsSummarization: true, summarizeUpTo };
};

export const buildContextContents = (
  path: ReadonlyArray<NodeRecord>,
  mode: ContextMode,
): ReadonlyArray<Content> =>
  match(mode)
    .with('full', () => path.flatMap(nodeToContents))
    .with('minimal', () => applyMinimalMode(path).flatMap(nodeToContents))
    .with('summary', () => {
      const result = applySummaryMode(path);
      if (!result.needsSummarization) {
        return result.nodes.flatMap(nodeToContents);
      }
      return result.nodes.slice(result.summarizeUpTo).flatMap(nodeToContents);
    })
    .exhaustive();

export const getSummarizationRange = (
  path: ReadonlyArray<NodeRecord>,
): { readonly needsSummarization: boolean; readonly summarizeUpTo: number } =>
  applySummaryMode(path);
