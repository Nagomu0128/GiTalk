import { eq, and, isNull, desc, gt } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';
import { db } from '../db/client.js';
import { repositories, repositoryBranches, repositoryNodes } from '../db/schema.js';
import { errorBuilder, type InferError } from '../shared/error.js';

export const DBRepositoryError = errorBuilder('DBRepositoryError');
export type DBRepositoryError = InferError<typeof DBRepositoryError>;

export type RepositoryRecord = typeof repositories.$inferSelect;
export type RepositoryBranchRecord = typeof repositoryBranches.$inferSelect;
export type RepositoryNodeRecord = typeof repositoryNodes.$inferSelect;

export const createRepository = (params: {
  readonly ownerId: string;
  readonly title: string;
  readonly description: string | null;
  readonly visibility: 'private' | 'public';
}): ResultAsync<RepositoryRecord, DBRepositoryError> =>
  ResultAsync.fromPromise(
    db.insert(repositories).values(params).returning().then((rows) => rows[0]!),
    DBRepositoryError.handle,
  );

export const findRepositoryById = (
  repositoryId: string,
): ResultAsync<RepositoryRecord | undefined, DBRepositoryError> =>
  ResultAsync.fromPromise(
    db.query.repositories.findFirst({
      where: and(eq(repositories.id, repositoryId), isNull(repositories.deletedAt)),
    }),
    DBRepositoryError.handle,
  );

export const listRepositoriesByOwner = (
  ownerId: string,
  cursor?: string,
  limit: number = 20,
): ResultAsync<ReadonlyArray<RepositoryRecord>, DBRepositoryError> =>
  ResultAsync.fromPromise(
    db.query.repositories.findMany({
      where: and(
        eq(repositories.ownerId, ownerId),
        isNull(repositories.deletedAt),
        ...(cursor ? [gt(repositories.id, cursor)] : []),
      ),
      orderBy: [desc(repositories.updatedAt)],
      limit,
    }),
    DBRepositoryError.handle,
  );

export const listPublicRepositoriesByOwner = (
  ownerId: string,
  cursor?: string,
  limit: number = 20,
): ResultAsync<ReadonlyArray<RepositoryRecord>, DBRepositoryError> =>
  ResultAsync.fromPromise(
    db.query.repositories.findMany({
      where: and(
        eq(repositories.ownerId, ownerId),
        eq(repositories.visibility, 'public'),
        isNull(repositories.deletedAt),
        ...(cursor ? [gt(repositories.id, cursor)] : []),
      ),
      orderBy: [desc(repositories.updatedAt)],
      limit,
    }),
    DBRepositoryError.handle,
  );

export const updateRepository = (
  repositoryId: string,
  ownerId: string,
  data: { readonly title?: string; readonly description?: string | null; readonly visibility?: 'private' | 'public' },
): ResultAsync<RepositoryRecord | undefined, DBRepositoryError> =>
  ResultAsync.fromPromise(
    db.update(repositories)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(repositories.id, repositoryId), eq(repositories.ownerId, ownerId), isNull(repositories.deletedAt)))
      .returning().then((rows) => rows[0]),
    DBRepositoryError.handle,
  );

export const softDeleteRepository = (
  repositoryId: string,
  ownerId: string,
): ResultAsync<RepositoryRecord | undefined, DBRepositoryError> =>
  ResultAsync.fromPromise(
    db.update(repositories)
      .set({ deletedAt: new Date() })
      .where(and(eq(repositories.id, repositoryId), eq(repositories.ownerId, ownerId), isNull(repositories.deletedAt)))
      .returning().then((rows) => rows[0]),
    DBRepositoryError.handle,
  );

export const listRepositoryBranches = (
  repositoryId: string,
): ResultAsync<ReadonlyArray<RepositoryBranchRecord>, DBRepositoryError> =>
  ResultAsync.fromPromise(
    db.query.repositoryBranches.findMany({
      where: eq(repositoryBranches.repositoryId, repositoryId),
    }),
    DBRepositoryError.handle,
  );

export const listRepositoryNodes = (
  repositoryBranchId: string,
): ResultAsync<ReadonlyArray<RepositoryNodeRecord>, DBRepositoryError> =>
  ResultAsync.fromPromise(
    db.query.repositoryNodes.findMany({
      where: eq(repositoryNodes.repositoryBranchId, repositoryBranchId),
    }),
    DBRepositoryError.handle,
  );

export const upsertRepositoryBranch = (params: {
  readonly repositoryId: string;
  readonly sourceBranchId: string;
  readonly name: string;
}): ResultAsync<RepositoryBranchRecord, DBRepositoryError> =>
  ResultAsync.fromPromise(
    db.insert(repositoryBranches)
      .values({
        repositoryId: params.repositoryId,
        sourceBranchId: params.sourceBranchId,
        name: params.name,
        pushedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [repositoryBranches.repositoryId, repositoryBranches.sourceBranchId],
        set: { name: params.name, pushedAt: new Date() },
      })
      .returning().then((rows) => rows[0]!),
    DBRepositoryError.handle,
  );

export const deleteRepositoryNodesByBranch = (
  repositoryBranchId: string,
): ResultAsync<void, DBRepositoryError> =>
  ResultAsync.fromPromise(
    db.delete(repositoryNodes).where(eq(repositoryNodes.repositoryBranchId, repositoryBranchId)).then(() => undefined),
    DBRepositoryError.handle,
  );

export const insertRepositoryNodes = (
  nodes: ReadonlyArray<typeof repositoryNodes.$inferInsert>,
): ResultAsync<ReadonlyArray<RepositoryNodeRecord>, DBRepositoryError> =>
  ResultAsync.fromPromise(
    db.insert(repositoryNodes).values([...nodes]).returning(),
    DBRepositoryError.handle,
  );
