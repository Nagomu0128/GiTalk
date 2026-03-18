import { eq, and, isNull, isNotNull, desc, gt, sql } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';
import { db } from '../db/client.js';
import { conversations, branches } from '../db/schema.js';
import { errorBuilder, type InferError } from '../shared/error.js';

export const DBConversationError = errorBuilder('DBConversationError');
export type DBConversationError = InferError<typeof DBConversationError>;

export type ConversationRecord = typeof conversations.$inferSelect;
export type BranchRecord = typeof branches.$inferSelect;

export const createConversation = (params: {
  readonly ownerId: string;
  readonly title: string;
}): ResultAsync<{ conversation: ConversationRecord; branch: BranchRecord }, DBConversationError> =>
  ResultAsync.fromPromise(
    db.transaction(async (tx) => {
      const [conversation] = await tx
        .insert(conversations)
        .values({ ownerId: params.ownerId, title: params.title })
        .returning();

      const [branch] = await tx
        .insert(branches)
        .values({
          conversationId: conversation!.id,
          name: 'main',
          isDefault: true,
        })
        .returning();

      await tx
        .update(conversations)
        .set({ activeBranchId: branch!.id })
        .where(eq(conversations.id, conversation!.id));

      const updated = { ...conversation!, activeBranchId: branch!.id };
      return { conversation: updated, branch: branch! };
    }),
    DBConversationError.handle,
  );

export const findConversationById = (
  conversationId: string,
  ownerId: string,
): ResultAsync<ConversationRecord | undefined, DBConversationError> =>
  ResultAsync.fromPromise(
    db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.ownerId, ownerId),
        isNull(conversations.deletedAt),
      ),
    }),
    DBConversationError.handle,
  );

export const listConversationsByOwner = (
  ownerId: string,
  cursor?: string,
  limit: number = 20,
): ResultAsync<ReadonlyArray<ConversationRecord>, DBConversationError> =>
  ResultAsync.fromPromise(
    db.query.conversations.findMany({
      where: and(
        eq(conversations.ownerId, ownerId),
        isNull(conversations.deletedAt),
        ...(cursor ? [gt(conversations.id, cursor)] : []),
      ),
      orderBy: [desc(conversations.updatedAt)],
      limit,
    }),
    DBConversationError.handle,
  );

export const updateConversation = (
  conversationId: string,
  ownerId: string,
  data: { readonly title?: string; readonly activeBranchId?: string; readonly contextMode?: string },
): ResultAsync<ConversationRecord | undefined, DBConversationError> =>
  ResultAsync.fromPromise(
    db
      .update(conversations)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.ownerId, ownerId),
          isNull(conversations.deletedAt),
        ),
      )
      .returning()
      .then((rows) => rows[0]),
    DBConversationError.handle,
  );

export const softDeleteConversation = (
  conversationId: string,
  ownerId: string,
): ResultAsync<ConversationRecord | undefined, DBConversationError> =>
  ResultAsync.fromPromise(
    db
      .update(conversations)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.ownerId, ownerId),
          isNull(conversations.deletedAt),
        ),
      )
      .returning()
      .then((rows) => rows[0]),
    DBConversationError.handle,
  );

export const listDeletedConversations = (
  ownerId: string,
): ResultAsync<ReadonlyArray<ConversationRecord>, DBConversationError> =>
  ResultAsync.fromPromise(
    db.query.conversations.findMany({
      where: and(
        eq(conversations.ownerId, ownerId),
        isNotNull(conversations.deletedAt),
        gt(conversations.deletedAt, sql`NOW() - INTERVAL '30 days'`),
      ),
      orderBy: [desc(conversations.deletedAt)],
    }),
    DBConversationError.handle,
  );

export const restoreConversation = (
  conversationId: string,
  ownerId: string,
): ResultAsync<ConversationRecord | undefined, DBConversationError> =>
  ResultAsync.fromPromise(
    db
      .update(conversations)
      .set({ deletedAt: null })
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.ownerId, ownerId),
          isNotNull(conversations.deletedAt),
        ),
      )
      .returning()
      .then((rows) => rows[0]),
    DBConversationError.handle,
  );
