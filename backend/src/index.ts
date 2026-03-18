import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import { authMiddleware } from './middleware/auth.js';
import { conversationsRouter } from './routes/conversations.js';
import { branchesRouter } from './routes/branches.js';
import { nodesRouter } from './routes/nodes.js';
import { appLogger } from './shared/logger.js';

const logger = appLogger('server');

const app = new Hono();

// ============================================================
// Global middleware
// ============================================================
app.use('*', errorHandler);
app.use('*', requestLogger);

app.use(
  '*',
  cors({
    origin: [
      'http://localhost:3000',
      ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
    ],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

// ============================================================
// Health check
// ============================================================
app.get('/health', (c) => c.json({ status: 'ok' }));

// ============================================================
// Auth-protected routes
// ============================================================
app.use('/v1/*', authMiddleware);

app.route('/v1/conversations', conversationsRouter);
app.route('/v1/conversations/:conversationId/branches', branchesRouter);
app.route('/v1/conversations/:conversationId/nodes', nodesRouter);

// ============================================================
// Start server
// ============================================================
const port = Number(process.env.PORT) || 8080;

serve({ fetch: app.fetch, port }, (info) => {
  logger.info(`Server is running on http://localhost:${info.port}`);
});

export default app;
