import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../middleware/auth.js';
import * as conversationInfra from '../infra/conversation.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('conversationsRoute');

const createSchema = z.object({
  title: z.string().min(1).max(200).optional().default('新しい会話'),
});

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  active_branch_id: z.string().uuid().optional(),
  context_mode: z.enum(['full', 'summary', 'minimal']).optional(),
});

export const conversationsRouter = new Hono();

// POST /v1/conversations
conversationsRouter.post('/', async (c) => {
  const user = getAuthUser(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const result = await conversationInfra.createConversation({
    ownerId: user.dbUser.id,
    title: parsed.data.title,
  });

  return result.match(
    (value) =>
      c.json({
        id: value.conversation.id,
        title: value.conversation.title,
        active_branch_id: value.conversation.activeBranchId,
        context_mode: value.conversation.contextMode,
        branches: [
          {
            id: value.branch.id,
            name: value.branch.name,
            is_default: value.branch.isDefault,
            head_node_id: value.branch.headNodeId,
          },
        ],
        created_at: value.conversation.createdAt,
      }, 201),
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create conversation' } }, 500);
    },
  );
});

// GET /v1/conversations
conversationsRouter.get('/', async (c) => {
  const user = getAuthUser(c);
  const cursor = c.req.query('cursor');
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);

  const result = await conversationInfra.listConversationsByOwner(user.dbUser.id, cursor, limit);

  return result.match(
    (value) =>
      c.json({
        data: value,
        next_cursor: value.length === limit ? value[value.length - 1]?.id ?? null : null,
        has_more: value.length === limit,
      }),
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list conversations' } }, 500);
    },
  );
});

// GET /v1/conversations/deleted
conversationsRouter.get('/deleted', async (c) => {
  const user = getAuthUser(c);
  const result = await conversationInfra.listDeletedConversations(user.dbUser.id);

  return result.match(
    (value) => c.json({ data: value }),
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list deleted conversations' } }, 500);
    },
  );
});

// GET /v1/conversations/:id
conversationsRouter.get('/:id', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('id');

  const result = await conversationInfra.findConversationById(conversationId, user.dbUser.id);

  return result.match(
    (value) => {
      if (!value) return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
      return c.json(value);
    },
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get conversation' } }, 500);
    },
  );
});

// PATCH /v1/conversations/:id
conversationsRouter.patch('/:id', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const data = {
    ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
    ...(parsed.data.active_branch_id !== undefined ? { activeBranchId: parsed.data.active_branch_id } : {}),
    ...(parsed.data.context_mode !== undefined ? { contextMode: parsed.data.context_mode } : {}),
  };

  const result = await conversationInfra.updateConversation(conversationId, user.dbUser.id, data);

  return result.match(
    (value) => {
      if (!value) return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
      return c.json(value);
    },
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update conversation' } }, 500);
    },
  );
});

// DELETE /v1/conversations/:id
conversationsRouter.delete('/:id', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('id');

  const result = await conversationInfra.softDeleteConversation(conversationId, user.dbUser.id);

  return result.match(
    (value) => {
      if (!value) return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
      return c.json({ message: 'Conversation deleted' });
    },
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete conversation' } }, 500);
    },
  );
});

// POST /v1/conversations/:id/restore
conversationsRouter.post('/:id/restore', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('id');

  const result = await conversationInfra.restoreConversation(conversationId, user.dbUser.id);

  return result.match(
    (value) => {
      if (!value) return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
      return c.json(value);
    },
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to restore conversation' } }, 500);
    },
  );
});
