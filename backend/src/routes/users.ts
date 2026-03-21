import { Hono } from 'hono';
import { getAuthUser, getOptionalAuthUser } from '../middleware/auth.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { findUserById, searchUsersByName } from '../infra/user.js';
import { listRepositoriesByOwner, listPublicRepositoriesByOwner } from '../infra/repository.js';
import { createFollow, deleteFollow, isFollowing, getFollowCounts } from '../infra/follow.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('usersRoute');

export const usersRouter = new Hono();

// GET /v1/users/me (auth required)
usersRouter.get('/me', authMiddleware, (c) => {
  const user = getAuthUser(c);
  return c.json({
    id: user.dbUser.id,
    displayName: user.dbUser.displayName,
    avatarUrl: user.dbUser.avatarUrl,
  });
});

// GET /v1/users/search?q=... (optional auth)
usersRouter.get('/search', optionalAuthMiddleware, async (c) => {
  const query = c.req.query('q');
  if (!query || query.trim().length === 0) {
    return c.json({ data: [] });
  }

  const limit = Math.min(Number(c.req.query('limit')) || 10, 50);
  const result = await searchUsersByName(query.trim(), limit);

  return result.match(
    (users) =>
      c.json({
        data: users.map((u) => ({
          id: u.id,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
        })),
      }),
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to search users' } }, 500);
    },
  );
});

// POST /v1/users/:userId/follow (auth required)
usersRouter.post('/:userId/follow', authMiddleware, async (c) => {
  const user = getAuthUser(c);
  const targetUserId = c.req.param('userId');
  if (!targetUserId) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing userId' } }, 400);
  if (user.dbUser.id === targetUserId) return c.json({ error: { code: 'BAD_REQUEST', message: 'Cannot follow yourself' } }, 400);

  const result = await createFollow(user.dbUser.id, targetUserId);
  return result.match(
    () => c.json({ ok: true }, 201),
    (error) => {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return c.json({ ok: true }, 200);
      }
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to follow user' } }, 500);
    },
  );
});

// DELETE /v1/users/:userId/follow (auth required)
usersRouter.delete('/:userId/follow', authMiddleware, async (c) => {
  const user = getAuthUser(c);
  const targetUserId = c.req.param('userId');
  if (!targetUserId) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing userId' } }, 400);

  const result = await deleteFollow(user.dbUser.id, targetUserId);
  return result.match(
    () => c.json({ ok: true }),
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to unfollow user' } }, 500);
    },
  );
});

// GET /v1/users/:userId/repositories (optional auth)
usersRouter.get('/:userId/repositories', optionalAuthMiddleware, async (c) => {
  const userId = c.req.param('userId');
  if (!userId) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing userId' } }, 400);

  const userResult = await findUserById(userId);
  if (userResult.isErr()) {
    logger.error(userResult.error.message);
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to find user' } }, 500);
  }
  if (!userResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404);
  }

  const targetUser = userResult.value;
  const authUser = getOptionalAuthUser(c);
  const isOwner = authUser?.dbUser.id === targetUser.id;

  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);

  const [reposResult, countsResult, followingResult] = await Promise.all([
    isOwner
      ? listRepositoriesByOwner(targetUser.id, cursor, limit)
      : listPublicRepositoriesByOwner(targetUser.id, cursor, limit),
    getFollowCounts(targetUser.id),
    authUser ? isFollowing(authUser.dbUser.id, targetUser.id) : Promise.resolve({ isOk: () => true, value: false, isErr: () => false } as const),
  ]);

  const followCounts = countsResult.isOk() ? countsResult.value : { followersCount: 0, followingCount: 0 };
  const isFollowingUser = 'value' in followingResult ? followingResult.value : false;

  return reposResult.match(
    (repos) =>
      c.json({
        user: {
          id: targetUser.id,
          displayName: targetUser.displayName,
          avatarUrl: targetUser.avatarUrl,
          followersCount: followCounts.followersCount,
          followingCount: followCounts.followingCount,
          isFollowing: isFollowingUser,
        },
        data: repos,
        next_cursor: repos.length === limit ? repos[repos.length - 1]?.id ?? null : null,
        has_more: repos.length === limit,
      }),
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list repositories' } }, 500);
    },
  );
});
