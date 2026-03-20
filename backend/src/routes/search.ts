import { Hono } from 'hono';
import { getAuthUser } from '../middleware/auth.js';
import * as searchInfra from '../infra/search.js';
export const searchRouter = new Hono();

// GET /v1/search?q=keyword&scope=all
searchRouter.get('/', async (c) => {
  const user = getAuthUser(c);
  const query = c.req.query('q');
  const scope = c.req.query('scope') || 'all';
  const limit = Math.min(Number(c.req.query('limit')) || 20, 100);
  const conversationId = c.req.query('conversation_id') || undefined;

  if (!query || query.trim().length === 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Search query (q) is required' } }, 400);
  }

  const trimmedQuery = query.trim();
  const searchConversations = scope === 'all' || scope === 'conversations';
  const searchNodes = scope === 'all' || scope === 'nodes';

  const [convResults, nodeResults] = await Promise.all([
    searchConversations
      ? searchInfra.searchConversations(user.dbUser.id, trimmedQuery, limit)
      : Promise.resolve({ isOk: () => true, value: [] } as { isOk: () => true; value: ReadonlyArray<unknown> }),
    searchNodes
      ? searchInfra.searchNodes(user.dbUser.id, trimmedQuery, limit, conversationId)
      : Promise.resolve({ isOk: () => true, value: [] } as { isOk: () => true; value: ReadonlyArray<unknown> }),
  ]);

  const conversations = 'match' in convResults
    ? convResults.match((v: unknown) => v, () => [])
    : [];
  const nodes = 'match' in nodeResults
    ? nodeResults.match((v: unknown) => v, () => [])
    : [];

  return c.json({
    conversations,
    nodes,
    has_more: false,
  });
});
