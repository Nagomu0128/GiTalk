import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';
import { db } from '../db/client.js';
import { conversations } from '../db/schema.js';
import { errorBuilder, type InferError } from '../shared/error.js';

export const DBSearchError = errorBuilder('DBSearchError');
export type DBSearchError = InferError<typeof DBSearchError>;

type ConversationSearchResult = {
  readonly id: string;
  readonly title: string;
  readonly matched_field: string;
};

type NodeSearchResult = {
  readonly id: string;
  readonly conversation_id: string;
  readonly conversation_title: string;
  readonly branch_name: string;
  readonly user_message_excerpt: string;
  readonly ai_response_excerpt: string;
};

export const searchConversations = (
  ownerId: string,
  query: string,
  limit: number = 20,
): ResultAsync<ReadonlyArray<ConversationSearchResult>, DBSearchError> =>
  ResultAsync.fromPromise(
    db
      .select({
        id: conversations.id,
        title: conversations.title,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.ownerId, ownerId),
          isNull(conversations.deletedAt),
          sql`${conversations.title} ILIKE ${'%' + query + '%'}`,
        ),
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .then((rows) =>
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          matched_field: 'title' as const,
        })),
      ),
    DBSearchError.handle,
  );

export const searchNodes = (
  ownerId: string,
  query: string,
  limit: number = 20,
): ResultAsync<ReadonlyArray<NodeSearchResult>, DBSearchError> =>
  ResultAsync.fromPromise(
    db.execute(sql`
      SELECT
        n.id,
        n.conversation_id,
        c.title AS conversation_title,
        b.name AS branch_name,
        CASE
          WHEN n.user_message ILIKE ${'%' + query + '%'}
          THEN SUBSTRING(n.user_message, 1, 200)
          ELSE ''
        END AS user_message_excerpt,
        CASE
          WHEN n.ai_response ILIKE ${'%' + query + '%'}
          THEN SUBSTRING(n.ai_response, 1, 200)
          ELSE ''
        END AS ai_response_excerpt
      FROM node n
      JOIN conversation c ON c.id = n.conversation_id
      JOIN branch b ON b.id = n.branch_id
      WHERE c.owner_id = ${ownerId}::uuid
        AND c.deleted_at IS NULL
        AND (
          n.user_message ILIKE ${'%' + query + '%'}
          OR n.ai_response ILIKE ${'%' + query + '%'}
        )
      ORDER BY n.created_at DESC
      LIMIT ${limit}
    `).then((rows) =>
      [...rows].map((row: Record<string, unknown>) => ({
        id: String(row.id),
        conversation_id: String(row.conversation_id),
        conversation_title: String(row.conversation_title),
        branch_name: String(row.branch_name),
        user_message_excerpt: String(row.user_message_excerpt || ''),
        ai_response_excerpt: String(row.ai_response_excerpt || ''),
      })),
    ),
    DBSearchError.handle,
  );
