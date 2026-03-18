import { listBranchesByConversation } from '../infra/branch.js';
import { getPathToRoot } from '../infra/node.js';
import {
  upsertRepositoryBranch,
  deleteRepositoryNodesByBranch,
  insertRepositoryNodes,
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
