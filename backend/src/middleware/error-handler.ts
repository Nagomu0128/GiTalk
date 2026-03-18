import type { Context, Next } from 'hono';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('errorHandler');

export const errorHandler = async (c: Context, next: Next): Promise<Response> => {
  try {
    await next();
  } catch (e) {
    logger.error(e);
    return c.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      500,
    );
  }
  return c.res;
};
