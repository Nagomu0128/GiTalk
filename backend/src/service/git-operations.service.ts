import type { Content } from '@google/generative-ai';
import { findBranchById, updateBranchHead } from '../infra/branch.js';
import { getPathToRoot, createNode, type NodeRecord } from '../infra/node.js';
import { updateConversation } from '../infra/conversation.js';
import { generateContentWithMetadata } from '../infra/gemini.js';
import { findLCA } from '../domain/lca.js';
import { errorBuilder, type InferError } from '../shared/error.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('gitOperationsService');

export const GitOperationError = errorBuilder('GitOperationError');
export type GitOperationError = InferError<typeof GitOperationError>;

// ============================================================
// Switch
// ============================================================
export const switchBranch = async (
  conversationId: string,
  branchId: string,
  userId: string,
): Promise<
  | { ok: true; data: { activeBranchId: string; branch: { id: string; name: string; headNodeId: string | null } } }
  | { ok: false; code: string; message: string; status: number }
> => {
  const branchResult = await findBranchById(branchId, conversationId);
  if (branchResult.isErr() || !branchResult.value) {
    return { ok: false, code: 'NOT_FOUND', message: 'Branch not found', status: 404 };
  }

  const updateResult = await updateConversation(conversationId, userId, { activeBranchId: branchId });
  if (updateResult.isErr() || !updateResult.value) {
    return { ok: false, code: 'INTERNAL_ERROR', message: 'Failed to update active branch', status: 500 };
  }

  const branch = branchResult.value;
  return {
    ok: true,
    data: {
      activeBranchId: branchId,
      branch: { id: branch.id, name: branch.name, headNodeId: branch.headNodeId },
    },
  };
};

// ============================================================
// Reset
// ============================================================
export const resetBranch = async (
  conversationId: string,
  branchId: string,
  targetNodeId: string,
): Promise<
  | { ok: true; data: { branchId: string; headNodeId: string } }
  | { ok: false; code: string; message: string; status: number }
> => {
  const branchResult = await findBranchById(branchId, conversationId);
  if (branchResult.isErr() || !branchResult.value) {
    return { ok: false, code: 'NOT_FOUND', message: 'Branch not found', status: 404 };
  }

  const branch = branchResult.value;

  // target_node_id が head からルートまでのパス上にあるか検証
  if (branch.headNodeId) {
    const pathResult = await getPathToRoot(branch.headNodeId);
    if (pathResult.isErr()) {
      return { ok: false, code: 'INTERNAL_ERROR', message: 'Failed to get path', status: 500 };
    }
    const pathIds = new Set(pathResult.value.map((n) => n.id));
    if (!pathIds.has(targetNodeId)) {
      return { ok: false, code: 'BAD_REQUEST', message: 'Target node is not on this branch path', status: 400 };
    }
  }

  // head を直接更新（reset は楽観的ロック不要 — ユーザーの明示的操作）
  const updateResult = await updateBranchHead(branchId, targetNodeId, branch.headNodeId);
  if (updateResult.isErr() || !updateResult.value) {
    return { ok: false, code: 'CONFLICT', message: 'Branch was modified concurrently', status: 409 };
  }

  return { ok: true, data: { branchId, headNodeId: targetNodeId } };
};

// ============================================================
// Diff
// ============================================================
export const diffBranches = async (
  conversationId: string,
  branchAId: string,
  branchBId: string,
): Promise<
  | { ok: true; data: { lcaNodeId: string | null; branchA: { branchId: string; name: string; nodes: ReadonlyArray<NodeRecord> }; branchB: { branchId: string; name: string; nodes: ReadonlyArray<NodeRecord> } } }
  | { ok: false; code: string; message: string; status: number }
> => {
  const [branchAResult, branchBResult] = await Promise.all([
    findBranchById(branchAId, conversationId),
    findBranchById(branchBId, conversationId),
  ]);

  if (branchAResult.isErr() || !branchAResult.value) {
    return { ok: false, code: 'NOT_FOUND', message: 'Branch A not found', status: 404 };
  }
  if (branchBResult.isErr() || !branchBResult.value) {
    return { ok: false, code: 'NOT_FOUND', message: 'Branch B not found', status: 404 };
  }

  const branchA = branchAResult.value;
  const branchB = branchBResult.value;

  if (!branchA.headNodeId || !branchB.headNodeId) {
    return { ok: false, code: 'BAD_REQUEST', message: 'Both branches must have at least one node', status: 400 };
  }

  const [pathAResult, pathBResult] = await Promise.all([
    getPathToRoot(branchA.headNodeId),
    getPathToRoot(branchB.headNodeId),
  ]);

  if (pathAResult.isErr() || pathBResult.isErr()) {
    return { ok: false, code: 'INTERNAL_ERROR', message: 'Failed to get paths', status: 500 };
  }

  const pathA = pathAResult.value;
  const pathB = pathBResult.value;
  const lca = findLCA(pathA, pathB);

  const lcaNodeId = lca?.id ?? null;
  const nodesAfterLCA_A = lca ? pathA.filter((n) => new Date(n.createdAt) > new Date(lca.createdAt)) : pathA;
  const nodesAfterLCA_B = lca ? pathB.filter((n) => new Date(n.createdAt) > new Date(lca.createdAt)) : pathB;

  return {
    ok: true,
    data: {
      lcaNodeId,
      branchA: { branchId: branchA.id, name: branchA.name, nodes: nodesAfterLCA_A },
      branchB: { branchId: branchB.id, name: branchB.name, nodes: nodesAfterLCA_B },
    },
  };
};

// ============================================================
// Merge
// ============================================================
type SummaryStrategy = 'concise' | 'detailed' | 'conclusion_only';

const STRATEGY_PROMPTS: Record<SummaryStrategy, string> = {
  concise: '1-2文で要点のみを簡潔にまとめてください',
  detailed: '主要な論点、議論の流れ、得られた結論をすべて含めて要約してください',
  conclusion_only: '最終的な結論・決定事項のみを抽出してください',
};

export const mergeBranches = async (
  conversationId: string,
  sourceBranchId: string,
  targetBranchId: string,
  summaryStrategy: SummaryStrategy,
  userId: string,
  model: string = 'gemini-2.5-flash',
): Promise<
  | { ok: true; data: { node: NodeRecord; updatedBranch: { id: string; headNodeId: string } } }
  | { ok: false; code: string; message: string; status: number }
> => {
  if (sourceBranchId === targetBranchId) {
    return { ok: false, code: 'BAD_REQUEST', message: 'Source and target branches must be different', status: 400 };
  }

  const [sourceResult, targetResult] = await Promise.all([
    findBranchById(sourceBranchId, conversationId),
    findBranchById(targetBranchId, conversationId),
  ]);

  if (sourceResult.isErr() || !sourceResult.value) {
    return { ok: false, code: 'NOT_FOUND', message: 'Source branch not found', status: 404 };
  }
  if (targetResult.isErr() || !targetResult.value) {
    return { ok: false, code: 'NOT_FOUND', message: 'Target branch not found', status: 404 };
  }

  const sourceBranch = sourceResult.value;
  const targetBranch = targetResult.value;

  if (!sourceBranch.headNodeId) {
    return { ok: false, code: 'BAD_REQUEST', message: 'Source branch has no nodes', status: 400 };
  }

  // ソースブランチの base → head のパスを取得
  const pathResult = await getPathToRoot(sourceBranch.headNodeId);
  if (pathResult.isErr()) {
    return { ok: false, code: 'INTERNAL_ERROR', message: 'Failed to get source branch path', status: 500 };
  }

  const sourcePath = pathResult.value;
  // base_node_id 以降のノードのみ（base_node_id 自体は含まない）
  const baseIdx = sourceBranch.baseNodeId
    ? sourcePath.findIndex((n) => n.id === sourceBranch.baseNodeId)
    : -1;
  const branchNodes = baseIdx >= 0 ? sourcePath.slice(baseIdx + 1) : sourcePath;

  if (branchNodes.length === 0) {
    return { ok: false, code: 'BAD_REQUEST', message: 'Source branch has no nodes after base', status: 400 };
  }

  // 要約プロンプトを構築
  const conversationText = branchNodes
    .map((n) => `ユーザー: ${n.userMessage}\nAI: ${n.aiResponse}`)
    .join('\n\n');

  const prompt = `以下は「${sourceBranch.name}」というトピックでの一連の会話です。\nこの会話を${STRATEGY_PROMPTS[summaryStrategy]}で要約してください。\n\n会話内容:\n${conversationText}`;

  const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];

  // Gemini で要約生成（トークン数も取得）
  const summaryResult = await generateContentWithMetadata(contents, model);
  if (summaryResult.isErr()) {
    logger.error('Merge summary generation failed', { error: summaryResult.error.message });
    return { ok: false, code: 'AI_SERVICE_UNAVAILABLE', message: 'Failed to generate summary', status: 502 };
  }

  const { text: summaryText, tokenCount: summaryTokenCount } = summaryResult.value;

  // 要約ノードを作成
  const nodeResult = await createNode({
    conversationId,
    branchId: targetBranchId,
    parentId: targetBranch.headNodeId,
    nodeType: 'summary',
    userMessage: `${sourceBranch.name} ブランチの統合`,
    aiResponse: summaryText,
    model,
    tokenCount: summaryTokenCount,
    metadata: {
      merge_source_branch_id: sourceBranchId,
      merge_source_branch_name: sourceBranch.name,
      merge_source_head_node_id: sourceBranch.headNodeId,
      summary_strategy: summaryStrategy,
    },
    createdBy: userId,
  });

  if (nodeResult.isErr()) {
    logger.error('Failed to create summary node', { error: nodeResult.error.message });
    return { ok: false, code: 'INTERNAL_ERROR', message: 'Failed to create summary node', status: 500 };
  }

  const summaryNode = nodeResult.value;

  // ターゲットブランチの head を更新
  const headResult = await updateBranchHead(targetBranchId, summaryNode.id, targetBranch.headNodeId);
  if (headResult.isErr() || !headResult.value) {
    logger.error('Failed to update target branch head');
    return { ok: false, code: 'CONFLICT', message: 'Target branch was modified concurrently', status: 409 };
  }

  return {
    ok: true,
    data: {
      node: summaryNode,
      updatedBranch: { id: targetBranchId, headNodeId: summaryNode.id },
    },
  };
};
