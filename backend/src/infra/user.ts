import { eq } from 'drizzle-orm';
import { ResultAsync } from 'neverthrow';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { errorBuilder, type InferError } from '../shared/error.js';

export const DBUserError = errorBuilder('DBUserError');
export type DBUserError = InferError<typeof DBUserError>;

export type UserRecord = typeof users.$inferSelect;

export const findUserByFirebaseUid = (
  firebaseUid: string,
): ResultAsync<UserRecord | undefined, DBUserError> =>
  ResultAsync.fromPromise(
    db.query.users.findFirst({
      where: eq(users.firebaseUid, firebaseUid),
    }),
    DBUserError.handle,
  );

export const upsertUserByFirebaseUid = (params: {
  readonly firebaseUid: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}): ResultAsync<UserRecord, DBUserError> =>
  ResultAsync.fromPromise(
    db
      .insert(users)
      .values({
        firebaseUid: params.firebaseUid,
        displayName: params.displayName,
        avatarUrl: params.avatarUrl,
      })
      .onConflictDoUpdate({
        target: users.firebaseUid,
        set: { updatedAt: new Date() },
      })
      .returning()
      .then((rows) => rows[0]!),
    DBUserError.handle,
  );
