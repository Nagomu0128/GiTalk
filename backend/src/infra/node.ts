import { eq, and, sql } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';
import { db } from '../db/client.js';
import { nodes } from '../db/schema.js';
import { errorBuilder, type InferError } from '../shared/error.js';

export const DBNodeError = errorBuilder('DBNodeError');
export type DBNodeError = InferError<typeof DBNodeError>;

export type NodeRecord = typeof nodes.$inferSelect;

export const findNodeById = (
  nodeId: string,
  conversationId: string,
): ResultAsync<NodeRecord | undefined, DBNodeError> =>
  ResultAsync.fromPromise(
    db.query.nodes.findFirst({
      where: and(eq(nodes.id, nodeId), eq(nodes.conversationId, conversationId)),
    }),
    DBNodeError.handle,
  );

export const listNodesByConversation = (
  conversationId: string,
): ResultAsync<ReadonlyArray<NodeRecord>, DBNodeError> =>
  ResultAsync.fromPromise(
    db.query.nodes.findMany({
      where: eq(nodes.conversationId, conversationId),
    }),
    DBNodeError.handle,
  );

export const getPathToRoot = (
  nodeId: string,
): ResultAsync<ReadonlyArray<NodeRecord>, DBNodeError> =>
  ResultAsync.fromPromise(
    db.execute<NodeRecord>(sql`
      WITH RECURSIVE path AS (
        SELECT * FROM node WHERE id = ${nodeId}::uuid
        UNION ALL
        SELECT n.* FROM node n
        JOIN path p ON n.id = p.parent_id
      )
      SELECT * FROM path ORDER BY created_at ASC
    `).then((rows) => [...rows] as ReadonlyArray<NodeRecord>),
    DBNodeError.handle,
  );

export const createNode = (params: {
  readonly conversationId: string;
  readonly branchId: string;
  readonly parentId: string | null;
  readonly nodeType: 'message' | 'summary' | 'system';
  readonly userMessage: string;
  readonly aiResponse: string;
  readonly model: string;
  readonly tokenCount: number;
  readonly metadata: unknown;
  readonly createdBy: string;
}): ResultAsync<NodeRecord, DBNodeError> =>
  ResultAsync.fromPromise(
    db
      .insert(nodes)
      .values({
        conversationId: params.conversationId,
        branchId: params.branchId,
        parentId: params.parentId,
        nodeType: params.nodeType,
        userMessage: params.userMessage,
        aiResponse: params.aiResponse,
        model: params.model,
        tokenCount: params.tokenCount,
        metadata: params.metadata,
        createdBy: params.createdBy,
      })
      .returning()
      .then((rows) => rows[0]!),
    DBNodeError.handle,
  );
