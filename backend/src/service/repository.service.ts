import { listBranchesByConversation } from '../infra/branch.js';
import { createNode, getPathToRoot } from '../infra/node.js';
import { createBranch } from '../infra/branch.js';
import { createConversation } from '../infra/conversation.js';
import {
  findRepositoryById,
  upsertRepositoryBranch,
  deleteRepositoryNodesByBranch,
  insertRepositoryNodes,
  listRepositoryBranches,
  listRepositoryNodes,
} from '../infra/repository.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('repositoryService');

type PushResult = {
  readonly repositoryBranchId: string;
  readonly name: string;
  readonly nodeCount: number;
  readonly pushedAt: Date;
};

export const pushBranches = async (
  repositoryId: string,
  conversationId: string,
  branchIds: ReadonlyArray<string> | undefined,
): Promise<
  | { ok: true; data: ReadonlyArray<PushResult> }
  | { ok: false; code: string; message: string; status: number }
> => {
  // ブランチ一覧を取得（branchIds が空なら全ブランチ）
  const allBranchesResult = await listBranchesByConversation(conversationId);
  if (allBranchesResult.isErr()) {
    return { ok: false, code: 'INTERNAL_ERROR', message: 'Failed to list branches', status: 500 };
  }

  const targetBranches = (!branchIds || branchIds.length === 0)
    ? allBranchesResult.value
    : allBranchesResult.value.filter((b) => branchIds.includes(b.id));

  if (targetBranches.length === 0) {
    return { ok: false, code: 'BAD_REQUEST', message: 'No branches to push', status: 400 };
  }

  const results: PushResult[] = [];

  // 各ブランチを順次 push
  for (const branch of targetBranches) {
    if (!branch.headNodeId) continue;

    // 1. RepositoryBranch を UPSERT
    const repoBranchResult = await upsertRepositoryBranch({
      repositoryId,
      sourceBranchId: branch.id,
      name: branch.name,
    });

    if (repoBranchResult.isErr()) {
      logger.error('Failed to upsert repository branch', { error: repoBranchResult.error.message });
      continue;
    }

    const repoBranch = repoBranchResult.value;

    // 2. 既存の RepositoryNode を削除
    const deleteResult = await deleteRepositoryNodesByBranch(repoBranch.id);
    if (deleteResult.isErr()) {
      logger.error('Failed to delete existing repository nodes', { error: deleteResult.error.message });
      continue;
    }

    // 3. head → root のパスを取得
    const pathResult = await getPathToRoot(branch.headNodeId);
    if (pathResult.isErr()) {
      logger.error('Failed to get path to root', { error: pathResult.error.message });
      continue;
    }

    const path = pathResult.value;

    // 4. NodeRecord → RepositoryNode に変換（parent_id のマッピングが必要）
    const nodeIdMap = new Map<string, string>();
    const repoNodes = path.map((node) => {
      const repoNodeId = crypto.randomUUID();
      nodeIdMap.set(node.id, repoNodeId);
      return {
        id: repoNodeId,
        repositoryBranchId: repoBranch.id,
        originalNodeId: node.id,
        parentRepositoryNodeId: node.parentId ? nodeIdMap.get(node.parentId) ?? null : null,
        nodeType: node.nodeType as 'message' | 'summary' | 'system',
        userMessage: node.userMessage,
        aiResponse: node.aiResponse,
        model: node.model,
        tokenCount: node.tokenCount,
        metadata: node.metadata,
        originalBranchName: branch.name,
        originalCreatedAt: new Date(node.createdAt),
      };
    });

    // 5. RepositoryNode を INSERT
    if (repoNodes.length > 0) {
      const insertResult = await insertRepositoryNodes(repoNodes);
      if (insertResult.isErr()) {
        logger.error('Failed to insert repository nodes', { error: insertResult.error.message });
        continue;
      }
    }

    results.push({
      repositoryBranchId: repoBranch.id,
      name: branch.name,
      nodeCount: repoNodes.length,
      pushedAt: repoBranch.pushedAt,
    });
  }

  return { ok: true, data: results };
};

// ============================================================
// Clone
// ============================================================
export const cloneRepository = async (
  repositoryId: string,
  userId: string,
): Promise<
  | { ok: true; data: { conversationId: string; title: string } }
  | { ok: false; code: string; message: string; status: number }
> => {
  const repoResult = await findRepositoryById(repositoryId);
  if (repoResult.isErr() || !repoResult.value) {
    return { ok: false, code: 'NOT_FOUND', message: 'Repository not found', status: 404 };
  }

  const repo = repoResult.value;

  // 公開リポジトリまたは所有者のみ clone 可能
  if (repo.visibility === 'private' && repo.ownerId !== userId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Repository not found', status: 404 };
  }

  // RepositoryBranch + RepositoryNode を取得
  const repoBranchesResult = await listRepositoryBranches(repositoryId);
  if (repoBranchesResult.isErr()) {
    return { ok: false, code: 'INTERNAL_ERROR', message: 'Failed to list branches', status: 500 };
  }

  // 新 Conversation 作成
  const convResult = await createConversation({
    ownerId: userId,
    title: `${repo.title} (clone)`,
  });
  if (convResult.isErr()) {
    return { ok: false, code: 'INTERNAL_ERROR', message: 'Failed to create conversation', status: 500 };
  }

  const conversationId = convResult.value.conversation.id;
  const repoBranches = repoBranchesResult.value;

  // 各 RepositoryBranch を Branch + Node にコピー
  for (const repoBranch of repoBranches) {
    const repoNodesResult = await listRepositoryNodes(repoBranch.id);
    if (repoNodesResult.isErr()) continue;

    const repoNodes = repoNodesResult.value;
    if (repoNodes.length === 0) continue;

    // RepositoryNode → Node にコピー（parent_id のマッピング）
    const nodeIdMap = new Map<string, string>();

    // ノードを親子順にソート（parentRepositoryNodeId が null のものが先）
    const sortedNodes = [...repoNodes].sort((a, b) => {
      if (!a.parentRepositoryNodeId) return -1;
      if (!b.parentRepositoryNodeId) return 1;
      return new Date(a.originalCreatedAt).getTime() - new Date(b.originalCreatedAt).getTime();
    });

    // ブランチ作成（最初のブランチは main として既に作成済み）
    const isFirst = repoBranch === repoBranches[0];
    const branchId = isFirst
      ? convResult.value.branch.id
      : await (async () => {
          const firstNodeId = nodeIdMap.values().next().value;
          const brResult = await createBranch({
            conversationId,
            name: repoBranch.name,
            baseNodeId: firstNodeId ?? convResult.value.branch.headNodeId ?? '',
          });
          return brResult.isOk() ? brResult.value.id : '';
        })();

    if (!branchId) continue;

    // ノードを順に作成
    for (const repoNode of sortedNodes) {
      const nodeResult = await createNode({
        conversationId,
        branchId,
        parentId: repoNode.parentRepositoryNodeId ? nodeIdMap.get(repoNode.parentRepositoryNodeId) ?? null : null,
        nodeType: repoNode.nodeType as 'message' | 'summary' | 'system',
        userMessage: repoNode.userMessage,
        aiResponse: repoNode.aiResponse,
        model: repoNode.model,
        tokenCount: repoNode.tokenCount,
        metadata: repoNode.metadata,
        createdBy: userId,
      });

      if (nodeResult.isOk()) {
        nodeIdMap.set(repoNode.id, nodeResult.value.id);
      }
    }
  }

  return { ok: true, data: { conversationId, title: `${repo.title} (clone)` } };
};
