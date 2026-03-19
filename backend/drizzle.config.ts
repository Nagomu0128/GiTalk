import { defineConfig } from 'drizzle-kit';

const parseDatabaseUrl = () => {
  const url = process.env.DATABASE_URL || '';

  // Cloud SQL Unix socket format: postgresql://user:pass@/dbname?host=/cloudsql/...
  const hostMatch = url.match(/[?&]host=([^&]+)/);
  if (hostMatch) {
    // Extract user:password from URL (before @)
    const authMatch = url.match(/\/\/([^:]+):([^@]+)@/);
    // Extract database name (between @ and ?)
    const dbMatch = url.match(/@\/([^?]+)/);

    return {
      host: hostMatch[1],
      port: 5432,
      database: dbMatch?.[1] || 'gitalk',
      user: authMatch?.[1] || 'app',
      password: authMatch?.[2] || '',
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
