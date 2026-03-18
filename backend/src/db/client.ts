import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('db');

const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    logger.error('DATABASE_URL environment variable is not set');
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
};

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export const getDb = (): ReturnType<typeof drizzle<typeof schema>> => {
  if (!_db) {
    const queryClient = postgres(getDatabaseUrl(), {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
    _db = drizzle(queryClient, { schema });
  }
  return _db;
};

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get: (_, prop) => {
    const instance = getDb();
    return (instance as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type Database = ReturnType<typeof drizzle<typeof schema>>;
