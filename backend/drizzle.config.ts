import { defineConfig } from 'drizzle-kit';

const parseDatabaseUrl = () => {
  const url = process.env.DATABASE_URL || '';

  // Cloud SQL Unix socket format: postgresql://user:pass@/dbname?host=/cloudsql/...
  const hostMatch = url.match(/[?&]host=([^&]+)/);
  if (hostMatch) {
    const baseUrl = url.replace(/[?&]host=[^&]+/, '');
    const parsed = new URL(baseUrl.replace(/^postgresql:/, 'http:'));
    return {
      host: hostMatch[1],
      port: 5432,
      database: parsed.pathname.slice(1) || 'gitalk',
      user: parsed.username || 'app',
      password: parsed.password || '',
    };
  }

  // Standard TCP URL
  return { url };
};

const credentials = parseDatabaseUrl();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: 'url' in credentials
    ? { url: credentials.url }
    : {
        host: credentials.host,
        port: credentials.port,
        database: credentials.database,
        user: credentials.user,
        password: credentials.password,
      },
});
