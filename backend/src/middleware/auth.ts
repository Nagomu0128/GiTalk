import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { verifyFirebaseToken, type AuthUser } from '../infra/firebase-auth.js';
import { upsertUserByFirebaseUid, type UserRecord } from '../infra/user.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('authMiddleware');

type AuthenticatedUser = {
  readonly firebaseUser: AuthUser;
  readonly dbUser: UserRecord;
};

type Env = {
  Variables: {
    authUser: AuthenticatedUser;
  };
};

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      401,
    );
  }

  const firebaseResult = await verifyFirebaseToken(token);

  if (firebaseResult.isErr()) {
    logger.warn('Invalid Firebase token', { error: firebaseResult.error.message });
    return c.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid authentication token' } },
      401,
    );
  }

  const firebaseUser = firebaseResult.value;

  const dbUserResult = await upsertUserByFirebaseUid({
    firebaseUid: firebaseUser.uid,
    displayName: firebaseUser.displayName ?? 'User',
    avatarUrl: firebaseUser.photoURL ?? null,
  });

  if (dbUserResult.isErr()) {
    logger.error('Failed to upsert user', { error: dbUserResult.error.message });
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      500,
    );
  }

  c.set('authUser', {
    firebaseUser,
    dbUser: dbUserResult.value,
  });

  await next();
});

type OptionalEnv = {
  Variables: {
    authUser: AuthenticatedUser | undefined;
  };
};

export const optionalAuthMiddleware = createMiddleware<OptionalEnv>(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (token) {
    const firebaseResult = await verifyFirebaseToken(token);

    if (firebaseResult.isOk()) {
      const dbUserResult = await upsertUserByFirebaseUid({
        firebaseUid: firebaseResult.value.uid,
        displayName: firebaseResult.value.displayName ?? 'User',
        avatarUrl: firebaseResult.value.photoURL ?? null,
      });

      if (dbUserResult.isOk()) {
        c.set('authUser', {
          firebaseUser: firebaseResult.value,
          dbUser: dbUserResult.value,
        });
      }
    }
  }

  await next();
});

export const getAuthUser = (c: Context): AuthenticatedUser => {
  const user = c.get('authUser') as AuthenticatedUser | undefined;
  if (!user) {
    throw new Error('authMiddleware must be applied before calling getAuthUser');
  }
  return user;
};

export const getOptionalAuthUser = (c: Context): AuthenticatedUser | undefined =>
  c.get('authUser') as AuthenticatedUser | undefined;
