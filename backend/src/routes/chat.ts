import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { getAuthUser } from '../middleware/auth.js';
import * as conversationInfra from '../infra/conversation.js';
import { createNode } from '../infra/node.js';
import { updateBranchHead } from '../infra/branch.js';
import { processChat } from '../service/chat.service.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('chatRoute');

const chatSchema = z.object({
  branch_id: z.string().uuid(),
  message: z.string().min(1).max(50000),
  model: z.string().default('gemini-2.0-flash'),
  context_mode: z.enum(['full', 'summary', 'minimal']).default('summary'),
});

const retrySaveSchema = z.object({
  branch_id: z.string().uuid(),
  parent_node_id: z.string().uuid().nullable(),
  user_message: z.string().min(1),
  ai_response: z.string().min(1),
  model: z.string(),
  token_count: z.number().int().min(0),
});

export const chatRouter = new Hono();

// POST /v1/conversations/:conversationId/chat
chatRouter.post('/', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  if (!conversationId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing conversationId' } }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = chatSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  return streamSSE(c, async (stream) => {
    await processChat(
      {
        conversationId,
        branchId: parsed.data.branch_id,
        message: parsed.data.message,
        model: parsed.data.model,
        contextMode: parsed.data.context_mode,
        userId: user.dbUser.id,
      },
      {
        onChunk: async (content) => {
          await stream.writeSSE({ data: JSON.stringify({ type: 'chunk', content }) });
        },
        onDone: async (nodeId, tokenCount) => {
          await stream.writeSSE({
            data: JSON.stringify({ type: 'done', node_id: nodeId, token_count: tokenCount }),
          });
        },
        onError: async (code, message) => {
          await stream.writeSSE({ data: JSON.stringify({ type: 'error', code, message }) });
        },
        onSaveFailed: async (userMessage, aiResponse) => {
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'save_failed',
              message: 'ノードの保存に失敗しました',
              user_message: userMessage,
              ai_response: aiResponse,
            }),
          });
        },
        onTitleGenerated: async (title) => {
          await stream.writeSSE({ data: JSON.stringify({ type: 'title_generated', title }) });
        },
      },
    );
  });
});

// POST /v1/conversations/:conversationId/retry-save
chatRouter.post('/retry-save', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  if (!conversationId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing conversationId' } }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = retrySaveSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const nodeResult = await createNode({
    conversationId,
    branchId: parsed.data.branch_id,
    parentId: parsed.data.parent_node_id,
    nodeType: 'message',
    userMessage: parsed.data.user_message,
    aiResponse: parsed.data.ai_response,
    model: parsed.data.model,
    tokenCount: parsed.data.token_count,
    metadata: null,
    createdBy: user.dbUser.id,
  });

  return nodeResult.match(
    (node) => {
      updateBranchHead(parsed.data.branch_id, node.id, parsed.data.parent_node_id ?? '');
      return c.json(node, 201);
    },
    (error) => {
      logger.error('Retry save failed', { error: error.message });
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to save node' } }, 500);
    },
  );
});
