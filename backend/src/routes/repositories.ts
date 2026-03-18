import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser, getOptionalAuthUser } from '../middleware/auth.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import * as repoInfra from '../infra/repository.js';
import * as repoService from '../service/repository.service.js';
import { findConversationById } from '../infra/conversation.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('repositoriesRoute');

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional().default(null),
  visibility: z.enum(['private', 'public']).default('private'),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  visibility: z.enum(['private', 'public']).optional(),
});

const pushSchema = z.object({
  conversation_id: z.string().uuid(),
  branch_ids: z.array(z.string().uuid()).optional(),
});

export const repositoriesRouter = new Hono();

// POST /v1/repositories (auth required)
repositoriesRouter.post('/', authMiddleware, async (c) => {
  const user = getAuthUser(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);

  const result = await repoInfra.createRepository({ ownerId: user.dbUser.id, ...parsed.data });
  return result.match(
    (repo) => c.json(repo, 201),
    (error) => { logger.error(error.message); return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create repository' } }, 500); },
  );
});

// GET /v1/repositories (auth required - own repos)
repositoriesRouter.get('/', authMiddleware, async (c) => {
  const user = getAuthUser(c);
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);

  const result = await repoInfra.listRepositoriesByOwner(user.dbUser.id, cursor, limit);
  return result.match(
    (repos) => c.json({ data: repos, next_cursor: repos.length === limit ? repos[repos.length - 1]?.id ?? null : null, has_more: repos.length === limit }),
    (error) => { logger.error(error.message); return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list repositories' } }, 500); },
  );
});

// GET /v1/repositories/:id (conditional auth)
repositoriesRouter.get('/:id', optionalAuthMiddleware, async (c) => {
  const repoId = c.req.param('id');
  if (!repoId) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);

  const result = await repoInfra.findRepositoryById(repoId);
  return result.match(
    (repo) => {
      if (!repo) return c.json({ error: { code: 'NOT_FOUND', message: 'Repository not found' } }, 404);
      const authUser = getOptionalAuthUser(c);
      if (repo.visibility === 'private' && repo.ownerId !== authUser?.dbUser.id) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Repository not found' } }, 404);
      }
      return c.json(repo);
    },
    (error) => { logger.error(error.message); return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get repository' } }, 500); },
  );
});

// PATCH /v1/repositories/:id (auth required)
repositoriesRouter.patch('/:id', authMiddleware, async (c) => {
  const user = getAuthUser(c);
  const repoId = c.req.param('id');
  if (!repoId) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);

  const result = await repoInfra.updateRepository(repoId, user.dbUser.id, parsed.data);
  return result.match(
    (repo) => repo ? c.json(repo) : c.json({ error: { code: 'NOT_FOUND', message: 'Repository not found' } }, 404),
    (error) => { logger.error(error.message); return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update repository' } }, 500); },
  );
});

// DELETE /v1/repositories/:id (auth required, soft delete)
repositoriesRouter.delete('/:id', authMiddleware, async (c) => {
  const user = getAuthUser(c);
  const repoId = c.req.param('id');
  if (!repoId) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);

  const result = await repoInfra.softDeleteRepository(repoId, user.dbUser.id);
  return result.match(
    (repo) => repo ? c.json({ message: 'Repository deleted' }) : c.json({ error: { code: 'NOT_FOUND', message: 'Repository not found' } }, 404),
    (error) => { logger.error(error.message); return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete repository' } }, 500); },
  );
});

// GET /v1/repositories/:id/branches (conditional auth)
repositoriesRouter.get('/:id/branches', optionalAuthMiddleware, async (c) => {
  const repoId = c.req.param('id');
  if (!repoId) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);

  const repoResult = await repoInfra.findRepositoryById(repoId);
  if (repoResult.isErr() || !repoResult.value) return c.json({ error: { code: 'NOT_FOUND', message: 'Repository not found' } }, 404);
  const repo = repoResult.value;
  const authUser = getOptionalAuthUser(c);
  if (repo.visibility === 'private' && repo.ownerId !== authUser?.dbUser.id) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Repository not found' } }, 404);
  }

  const result = await repoInfra.listRepositoryBranches(repoId);
  return result.match(
    (branches) => c.json({ data: branches }),
    (error) => { logger.error(error.message); return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list branches' } }, 500); },
  );
});

// GET /v1/repositories/:id/nodes (conditional auth)
repositoriesRouter.get('/:id/nodes', optionalAuthMiddleware, async (c) => {
  const repoId = c.req.param('id');
  if (!repoId) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);

  const repoResult = await repoInfra.findRepositoryById(repoId);
  if (repoResult.isErr() || !repoResult.value) return c.json({ error: { code: 'NOT_FOUND', message: 'Repository not found' } }, 404);
  const repo = repoResult.value;
  const authUser = getOptionalAuthUser(c);
  if (repo.visibility === 'private' && repo.ownerId !== authUser?.dbUser.id) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Repository not found' } }, 404);
  }

  const branchesResult = await repoInfra.listRepositoryBranches(repoId);
  if (branchesResult.isErr()) return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list branches' } }, 500);

  const branchesWithNodes = await Promise.all(
    branchesResult.value.map(async (branch) => {
      const nodesResult = await repoInfra.listRepositoryNodes(branch.id);
      return {
        repository_branch_id: branch.id,
        name: branch.name,
        nodes: nodesResult.isOk() ? nodesResult.value : [],
      };
    }),
  );

  return c.json({ branches: branchesWithNodes });
});

// POST /v1/repositories/:id/push (auth required)
repositoriesRouter.post('/:id/push', authMiddleware, async (c) => {
  const user = getAuthUser(c);
  const repoId = c.req.param('id');
  if (!repoId) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parsed = pushSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);

  const repoResult = await repoInfra.findRepositoryById(repoId);
  if (repoResult.isErr() || !repoResult.value) return c.json({ error: { code: 'NOT_FOUND', message: 'Repository not found' } }, 404);
  if (repoResult.value.ownerId !== user.dbUser.id) return c.json({ error: { code: 'FORBIDDEN', message: 'Not the owner' } }, 403);

  const convResult = await findConversationById(parsed.data.conversation_id, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);

  const result = await repoService.pushBranches(repoId, parsed.data.conversation_id, parsed.data.branch_ids);
  if (!result.ok) return c.json({ error: { code: result.code, message: result.message } }, result.status as 400 | 500);

  return c.json({ pushed_branches: result.data });
});
