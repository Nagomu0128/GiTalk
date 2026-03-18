import type { Context, Next } from 'hono';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('request');

export const requestLogger = async (c: Context, next: Next): Promise<void> => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  logger.info(`${method} ${path} ${status} ${duration}ms`, {
    method,
    path,
    status,
    duration,
  });
};
