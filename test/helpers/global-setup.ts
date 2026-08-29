import "@nestjs/core";
import "@nestjs/testing";
import type { Pool } from "pg";
import { env } from "@/env";
import { TIME_IN_MS } from "@/common/constants/time.constant";
import { createTestPool, dropTestSchema } from "./database.helper";
import { Logger } from "@nestjs/common";
import { spyOn } from "bun:test";

// Suppress intentional NestJS log noise during unit test suites to keep terminal output clean.
spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
spyOn(Logger.prototype, "verbose").mockImplementation(() => undefined);
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

      // Age threshold protects active peer workers while allowing cleanup of stale schemas.
      if (
        !Number.isNaN(createdTimestamp) &&
        now - createdTimestamp > ORPHAN_SCHEMA_MAX_AGE_MS
      ) {
        await dropTestSchema(pool, row.schema_name);
      }
    }
  }
}

/**
 * Global pre-flight initialization hook executed before parallel test workers spawn.
 * Fails open gracefully if the database is unreachable (e.g. during unit test runs).
 */
export async function setupGlobalTestEnvironment(): Promise<void> {
  if (env.NODE_ENV !== "test" || !env.DB_URL) return;

  let pool: Pool | undefined;

  try {
    pool = createTestPool();

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
