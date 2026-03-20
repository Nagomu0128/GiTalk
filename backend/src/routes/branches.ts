import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../middleware/auth.js';
import * as branchInfra from '../infra/branch.js';
import * as conversationInfra from '../infra/conversation.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('branchesRoute');

const createSchema = z.object({
  name: z.string().min(1).max(100),
  base_node_id: z.string().uuid(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const branchesRouter = new Hono();

// POST /v1/conversations/:conversationId/branches
branchesRouter.post('/', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  if (!conversationId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing conversationId' } }, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);

  if (convResult.isErr()) {
    logger.error(convResult.error.message);
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Database error' } }, 500);
  }

  if (!convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const result = await branchInfra.createBranch({
    conversationId,
    name: parsed.data.name,
    baseNodeId: parsed.data.base_node_id,
  });

  return result.match(
    (value) => c.json(value, 201),
    (error) => {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return c.json({ error: { code: 'CONFLICT', message: 'Branch name already exists' } }, 409);
      }
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create branch' } }, 500);
    },
  );
});

// GET /v1/conversations/:conversationId/branches
branchesRouter.get('/', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  if (!conversationId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing conversationId' } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const result = await branchInfra.listBranchesByConversation(conversationId);

  return result.match(
    (value) => c.json({ data: value }),
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list branches' } }, 500);
    },
  );
});

// PATCH /v1/conversations/:conversationId/branches/:branchId
branchesRouter.patch('/:branchId', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  const branchId = c.req.param('branchId');
  if (!conversationId || !branchId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing required params' } }, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  if (!parsed.data.name) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'No update fields provided' } }, 400);
  }

  const result = await branchInfra.updateBranchName(branchId, conversationId, parsed.data.name);

  return result.match(
    (value) => {
      if (!value) return c.json({ error: { code: 'NOT_FOUND', message: 'Branch not found' } }, 404);
      return c.json(value);
    },
    (error) => {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return c.json({ error: { code: 'CONFLICT', message: 'Branch name already exists' } }, 409);
      }
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update branch' } }, 500);
    },
  );
});

// DELETE /v1/conversations/:conversationId/branches/:branchId
branchesRouter.delete('/:branchId', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  const branchId = c.req.param('branchId');
  if (!conversationId || !branchId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing required params' } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const branchResult = await branchInfra.findBranchById(branchId, conversationId);
  if (branchResult.isErr() || !branchResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Branch not found' } }, 404);
  }

  if (branchResult.value.isDefault) {
    return c.json({ error: { code: 'DEFAULT_BRANCH_UNDELETABLE', message: 'Cannot delete the default branch' } }, 403);
  }

  const result = await branchInfra.deleteBranch(branchId, conversationId);

  return result.match(
    () => c.json({ message: 'Branch deleted' }),
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete branch' } }, 500);
    },
  );
});
