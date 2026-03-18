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

const createQueryClient = (): ReturnType<typeof postgres> => {
  const url = getDatabaseUrl();

  // Cloud SQL Unix socket format: postgresql://user:pass@/dbname?host=/cloudsql/...
  // new URL() cannot parse this because there is no hostname after '@'.
  const socketMatch = url.match(
    /^postgresql:\/\/([^:]*):([^@]*)@\/([^?]*)\?host=(.+)$/,
  );
  if (socketMatch) {
    const [, username, password, database, socketPath] = socketMatch;

    return postgres({
      host: socketPath!,
      port: 5432,
      database: database || 'gitalk',
      username: username || 'app',
      password: decodeURIComponent(password || ''),
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  // Standard TCP connection (local dev)
  return postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
};

let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export const getDb = (): ReturnType<typeof drizzle<typeof schema>> => {
  if (!_db) {
    const queryClient = createQueryClient();
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

export const checkDbConnection = async (): Promise<{
  ok: boolean;
  databaseUrlSet: boolean;
  databaseUrlFormat: string;
  error?: string;
}> => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return { ok: false, databaseUrlSet: false, databaseUrlFormat: 'none', error: 'DATABASE_URL is not set' };
  }

  const isUnixSocket = /[?&]host=/.test(url);
  const format = isUnixSocket ? 'unix_socket' : 'tcp';
  const maskedUrl = url.replace(/:([^@]+)@/, ':***@');

  try {
    const queryClient = createQueryClient();
    await queryClient`SELECT 1 AS ping`;
    await queryClient.end();
    return { ok: true, databaseUrlSet: true, databaseUrlFormat: format };
  } catch (e) {
    return {
      ok: false,
      databaseUrlSet: true,
      databaseUrlFormat: format,
      error: `${maskedUrl} → ${e instanceof Error ? e.message : String(e)}`,
    };
  }
};
