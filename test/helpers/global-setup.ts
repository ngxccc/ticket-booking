import type { Pool } from "pg";
import { env } from "@/env";
import { TIME_IN_MS } from "@/common/constants/time.constant";
export const ORPHAN_SCHEMA_MAX_AGE_MS = TIME_IN_MS.HOUR;

/**
 * Sweeps and purges leftover test schemas from crashed or interrupted test executions.
 *
 * @param pool - Active PostgreSQL connection pool
 */
export async function cleanupOrphanTestSchemas(pool: Pool): Promise<void> {
  const result = await pool.query<{ schema_name: string }>(
    "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'test_%';",
  );

  const now = Date.now();
  for (const row of result.rows) {
    const parts = row.schema_name.split("_");
    if (parts.length >= 3) {
      const createdTimestamp = Number.parseInt(parts[1] ?? "0", 10);

      // Regex validation prevents SQL injection; age threshold protects active peer workers.
      if (
        !Number.isNaN(createdTimestamp) &&
        now - createdTimestamp > ORPHAN_SCHEMA_MAX_AGE_MS &&
        /^test_\d+_[a-f0-9_]+$/.test(row.schema_name)
      ) {
        await pool.query(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE;`);
      }
    }
  }
}

/**
 * Global pre-flight initialization hook executed before parallel test workers spawn.
 * Fails open gracefully if the database is unreachable (e.g. during unit test runs).
 */
export async function setupGlobalTestEnvironment(): Promise<void> {
  if (env.NODE_ENV !== "test") return;

  const { Pool } = await import("pg");
  let pool: Pool | undefined;

  try {
    pool = env.DB_URL
      ? new Pool({
          connectionString: env.DB_URL,
          connectionTimeoutMillis: 3000,
        })
      : new Pool({
          host: env.DB_HOST,
          port: env.DB_PORT,
          user: env.DB_USERNAME,
          password: env.DB_PASSWORD,
          database: env.DB_DATABASE,
          connectionTimeoutMillis: 3000,
        });

    // Pre-installing btree_gist globally in public schema avoids per-worker catalog lock contention on pg_extension.
    await pool.query(
      "CREATE EXTENSION IF NOT EXISTS btree_gist SCHEMA public;",
    );

    await cleanupOrphanTestSchemas(pool);
  } catch {
    // Fail-open resilience: allow offline unit test suites (e.g. bun test src/) to pass when PostgreSQL is unreachable.
  } finally {
    if (pool) {
      await pool.end().catch(() => undefined);
    }
  }
}

// Bunfig preload executes this file before worker suites spawn; top-level await guarantees pre-flight completion.
await setupGlobalTestEnvironment();
