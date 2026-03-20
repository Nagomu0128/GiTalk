import { Hono } from 'hono';
import { z } from 'zod';
import { getAuthUser } from '../middleware/auth.js';
import * as conversationInfra from '../infra/conversation.js';
import * as gitOps from '../service/git-operations.service.js';
const switchSchema = z.object({
  branch_id: z.string().uuid(),
});

const cherryPickSchema = z.object({
  source_node_id: z.string().uuid(),
  target_branch_id: z.string().uuid(),
});

const resetSchema = z.object({
  branch_id: z.string().uuid(),
  target_node_id: z.string().uuid(),
});

const mergeSchema = z.object({
  source_branch_id: z.string().uuid(),
  target_branch_id: z.string().uuid(),
  summary_strategy: z.enum(['concise', 'detailed', 'conclusion_only']).default('detailed'),
});

export const gitOperationsRouter = new Hono();

// POST /v1/conversations/:conversationId/switch
gitOperationsRouter.post('/switch', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  if (!conversationId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing conversationId' } }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = switchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const result = await gitOps.switchBranch(conversationId, parsed.data.branch_id, user.dbUser.id);

  if (!result.ok) {
    return c.json({ error: { code: result.code, message: result.message } }, result.status as 400 | 404 | 500);
  }

  return c.json({
    active_branch_id: result.data.activeBranchId,
    branch: {
      id: result.data.branch.id,
      name: result.data.branch.name,
      head_node_id: result.data.branch.headNodeId,
    },
  });
});

// POST /v1/conversations/:conversationId/reset
gitOperationsRouter.post('/reset', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  if (!conversationId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing conversationId' } }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const result = await gitOps.resetBranch(conversationId, parsed.data.branch_id, parsed.data.target_node_id);

  if (!result.ok) {
    return c.json({ error: { code: result.code, message: result.message } }, result.status as 400 | 404 | 409 | 500);
  }

  return c.json(result.data);
});

// GET /v1/conversations/:conversationId/diff
gitOperationsRouter.get('/diff', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  if (!conversationId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing conversationId' } }, 400);
  }

  const branchAId = c.req.query('branch_a');
  const branchBId = c.req.query('branch_b');
  if (!branchAId || !branchBId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing branch_a or branch_b query params' } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const result = await gitOps.diffBranches(conversationId, branchAId, branchBId);

  if (!result.ok) {
    return c.json({ error: { code: result.code, message: result.message } }, result.status as 400 | 404 | 500);
  }

  return c.json({
    lca_node_id: result.data.lcaNodeId,
    branch_a: result.data.branchA,
    branch_b: result.data.branchB,
  });
});

// POST /v1/conversations/:conversationId/merge
gitOperationsRouter.post('/merge', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  if (!conversationId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing conversationId' } }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const result = await gitOps.mergeBranches(
    conversationId,
    parsed.data.source_branch_id,
    parsed.data.target_branch_id,
    parsed.data.summary_strategy,
    user.dbUser.id,
  );

  if (!result.ok) {
    return c.json({ error: { code: result.code, message: result.message } }, result.status as 400 | 404 | 409 | 500 | 502);
  }

  return c.json({
    node: result.data.node,
    updated_branch: result.data.updatedBranch,
  });
});

// POST /v1/conversations/:conversationId/cherry-pick
gitOperationsRouter.post('/cherry-pick', async (c) => {
  const user = getAuthUser(c);
  const conversationId = c.req.param('conversationId');
  if (!conversationId) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing conversationId' } }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = cherryPickSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.message } }, 400);
  }

  const convResult = await conversationInfra.findConversationById(conversationId, user.dbUser.id);
  if (convResult.isErr() || !convResult.value) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Conversation not found' } }, 404);
  }

  const result = await gitOps.cherryPickNode(
    conversationId,
    parsed.data.source_node_id,
    parsed.data.target_branch_id,
    user.dbUser.id,
  );

  if (!result.ok) {
    return c.json({ error: { code: result.code, message: result.message } }, result.status as 400 | 404 | 409 | 500);
  }

  return c.json({
    node: result.data.node,
    updated_branch: result.data.updatedBranch,
  });
});
