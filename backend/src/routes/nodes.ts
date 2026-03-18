import { Hono } from 'hono';
import { getAuthUser } from '../middleware/auth.js';
import * as nodeInfra from '../infra/node.js';
import * as conversationInfra from '../infra/conversation.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('nodesRoute');

export const nodesRouter = new Hono();

// GET /v1/conversations/:conversationId/nodes
nodesRouter.get('/', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  if (!conversationId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing conversationId' } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const result = await nodeInfra.listNodesByConversation(conversationId);

  return result.match(
    (value) => c.json({ nodes: value }),
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list nodes' } }, 500);
    },
  );
});

// GET /v1/conversations/:conversationId/nodes/:nodeId
nodesRouter.get('/:nodeId', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  const nodeId = c.req.param('nodeId');
  if (!conversationId || !nodeId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing required params' } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const result = await nodeInfra.findNodeById(nodeId, conversationId);

  return result.match(
    (value) => {
      if (!value) return c.json({ error: { code: 'NOT_FOUND', message: 'Node not found' } }, 404);
      return c.json(value);
    },
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get node' } }, 500);
    },
  );
});

// GET /v1/conversations/:conversationId/nodes/:nodeId/path
nodesRouter.get('/:nodeId/path', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  const nodeId = c.req.param('nodeId');
  if (!conversationId || !nodeId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing required params' } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const result = await nodeInfra.getPathToRoot(nodeId);

  return result.match(
    (value) => c.json({ path: value }),
    (error) => {
      logger.error(error.message);
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get path' } }, 500);
    },
  );
});
