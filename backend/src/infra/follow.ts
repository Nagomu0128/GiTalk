import { eq, and, sql } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';
import { db } from '../db/client.js';
import { follows } from '../db/schema.js';
import { errorBuilder, type InferError } from '../shared/error.js';

export const DBFollowError = errorBuilder('DBFollowError');
export type DBFollowError = InferError<typeof DBFollowError>;

export const createFollow = (
  followerId: string,
  followingId: string,
): ResultAsync<{ id: string }, DBFollowError> =>
  ResultAsync.fromPromise(
    db
      .insert(follows)
      .values({ followerId, followingId })
      .returning({ id: follows.id })
      .then((rows) => rows[0]!),
    DBFollowError.handle,
  );

export const deleteFollow = (
  followerId: string,
  followingId: string,
): ResultAsync<boolean, DBFollowError> =>
  ResultAsync.fromPromise(
    db
      .delete(follows)
      .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
      .returning({ id: follows.id })
      .then((rows) => rows.length > 0),
    DBFollowError.handle,
  );

export const isFollowing = (
  followerId: string,
  followingId: string,
): ResultAsync<boolean, DBFollowError> =>
  ResultAsync.fromPromise(
    db.query.follows
      .findFirst({
        where: and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)),
      })
      .then((row) => !!row),
    DBFollowError.handle,
  );

export const getFollowCounts = (
  userId: string,
): ResultAsync<{ followersCount: number; followingCount: number }, DBFollowError> =>
  ResultAsync.fromPromise(
    Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(follows)
        .where(eq(follows.followingId, userId))
        .then((rows) => rows[0]?.count ?? 0),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(follows)
        .where(eq(follows.followerId, userId))
        .then((rows) => rows[0]?.count ?? 0),
    ]).then(([followersCount, followingCount]) => ({ followersCount, followingCount })),
    DBFollowError.handle,
  );
