import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('db');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  logger.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const queryClient = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
