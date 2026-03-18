import { eq, and, isNull } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';
import { db } from '../db/client.js';
import { branches } from '../db/schema.js';
import { errorBuilder, type InferError } from '../shared/error.js';

export const DBBranchError = errorBuilder('DBBranchError');
export type DBBranchError = InferError<typeof DBBranchError>;

export type BranchRecord = typeof branches.$inferSelect;

export const createBranch = (params: {
  readonly conversationId: string;
  readonly name: string;
  readonly baseNodeId: string;
}): ResultAsync<BranchRecord, DBBranchError> =>
  ResultAsync.fromPromise(
    db
      .insert(branches)
      .values({
        conversationId: params.conversationId,
        name: params.name,
        headNodeId: params.baseNodeId,
        baseNodeId: params.baseNodeId,
        isDefault: false,
      })
      .returning()
      .then((rows) => rows[0]!),
    DBBranchError.handle,
  );

export const findBranchById = (
  branchId: string,
  conversationId: string,
): ResultAsync<BranchRecord | undefined, DBBranchError> =>
  ResultAsync.fromPromise(
    db.query.branches.findFirst({
      where: and(eq(branches.id, branchId), eq(branches.conversationId, conversationId)),
    }),
    DBBranchError.handle,
  );

export const listBranchesByConversation = (
  conversationId: string,
): ResultAsync<ReadonlyArray<BranchRecord>, DBBranchError> =>
  ResultAsync.fromPromise(
    db.query.branches.findMany({
      where: eq(branches.conversationId, conversationId),
    }),
    DBBranchError.handle,
  );

export const updateBranchName = (
  branchId: string,
  conversationId: string,
  name: string,
): ResultAsync<BranchRecord | undefined, DBBranchError> =>
  ResultAsync.fromPromise(
    db
      .update(branches)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(branches.id, branchId), eq(branches.conversationId, conversationId)))
      .returning()
      .then((rows) => rows[0]),
    DBBranchError.handle,
  );

export const updateBranchHead = (
  branchId: string,
  newHeadNodeId: string,
  expectedHeadNodeId: string | null,
): ResultAsync<BranchRecord | undefined, DBBranchError> =>
  ResultAsync.fromPromise(
    db
      .update(branches)
      .set({ headNodeId: newHeadNodeId, updatedAt: new Date() })
      .where(
        and(
          eq(branches.id, branchId),
          expectedHeadNodeId === null
            ? isNull(branches.headNodeId)
            : eq(branches.headNodeId, expectedHeadNodeId),
        ),
      )
      .returning()
      .then((rows) => rows[0]),
    DBBranchError.handle,
  );

export const deleteBranch = (
  branchId: string,
  conversationId: string,
): ResultAsync<BranchRecord | undefined, DBBranchError> =>
  ResultAsync.fromPromise(
    db
      .delete(branches)
      .where(and(eq(branches.id, branchId), eq(branches.conversationId, conversationId)))
      .returning()
      .then((rows) => rows[0]),
    DBBranchError.handle,
  );
