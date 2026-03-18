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

type RawNodeRow = {
  readonly id: string;
  readonly conversation_id: string;
  readonly branch_id: string;
  readonly parent_id: string | null;
  readonly node_type: 'message' | 'summary' | 'system';
  readonly user_message: string;
  readonly ai_response: string;
  readonly model: string;
  readonly token_count: number;
  readonly metadata: unknown;
  readonly created_by: string;
  readonly created_at: Date;
};

const mapRawToNodeRecord = (raw: RawNodeRow): NodeRecord => ({
  id: raw.id,
  conversationId: raw.conversation_id,
  branchId: raw.branch_id,
  parentId: raw.parent_id,
  nodeType: raw.node_type,
  userMessage: raw.user_message,
  aiResponse: raw.ai_response,
  model: raw.model,
  tokenCount: raw.token_count,
  metadata: raw.metadata,
  createdBy: raw.created_by,
  createdAt: raw.created_at,
});

export const getPathToRoot = (
  nodeId: string,
): ResultAsync<ReadonlyArray<NodeRecord>, DBNodeError> =>
  ResultAsync.fromPromise(
    db.execute<RawNodeRow>(sql`
      WITH RECURSIVE path AS (
        SELECT * FROM node WHERE id = ${nodeId}::uuid
        UNION ALL
        SELECT n.* FROM node n
        JOIN path p ON n.id = p.parent_id
      )
      SELECT * FROM path ORDER BY created_at ASC
    `).then((rows) => [...rows].map(mapRawToNodeRecord)),
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
