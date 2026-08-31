import { randomUUID } from "crypto";
import { join } from "path";
import type { Pool, PoolConfig } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { env } from "@/env";
import type { DrizzleDB } from "@/database/database.module";
import {
  normalizeDatabaseUrl,
  createDatabasePool,
  createDrizzleClient,
  clearSchemaTablesCache,
} from "@/database/database.connection";

/**
 * Encapsulates the isolated database resources provisioned for a test worker suite.
 */
export interface TestDatabaseContext {
  pool: Pool;
  db: DrizzleDB;
  schemaName: string;
}

/**
 * Generates a unique, timestamp-prefixed worker schema name conforming to the GC contract.
 */
export function generateWorkerSchemaName(): string {
  const timestamp = String(Date.now());
  const uuid = randomUUID().replace(/-/g, "_");
  return `test_${timestamp}_${uuid}`;
}

/**
 * Normalizes the test database URL by unpooling cloud endpoints and mapping SSL modes.
 */
export function getNormalizedTestDbUrl(): string | undefined {
  return normalizeDatabaseUrl(env.DB_URL);
}

/**
 * Creates a PostgreSQL connection pool configured for the test environment.
 *
 * @param overrides - Optional connection pool configuration overrides
 */
export function createTestPool(overrides?: PoolConfig): Pool {
  return createDatabasePool(overrides);
}

/**
 * Provisions a completely isolated PostgreSQL schema for a test worker, runs Drizzle
 * migrations into that schema, and returns a dedicated Drizzle client and Pool.
 *
 * @param existingAdminPool - Optional existing admin pool; creates a temporary one if omitted
 * @param customSchemaName - Optional schema name override (defaults to generated UUID schema)
 */
export async function createWorkerTestDatabase(
  existingAdminPool?: Pool,
  customSchemaName?: string,
): Promise<TestDatabaseContext> {
  const schemaName = customSchemaName ?? generateWorkerSchemaName();
  const adminPool = existingAdminPool ?? createTestPool();
  const shouldCloseAdminPool = !existingAdminPool;

  try {
    await adminPool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);

    // Server-side instant table cloning from pre-migrated test_template schema
    const cloneQuery = `
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'test_template' AND tablename != '__drizzle_migrations') LOOP
          EXECUTE format('CREATE TABLE "%I"."%I" (LIKE "test_template"."%I" INCLUDING ALL);', '${schemaName}', r.tablename, r.tablename);
        END LOOP;
      END $$;
    `;
    await adminPool.query(cloneQuery);

    const pool = createTestPool({
      options: `-c search_path="${schemaName}",public`,
      max: 15,
    });

    const db = createDrizzleClient(pool);
    return { pool, db, schemaName };
  } catch {
    // Fallback: direct migration if template cloning encounters missing template
    const pool = createTestPool({
      options: `-c search_path="${schemaName}",public`,
      max: 15,
    });

    const db = createDrizzleClient(pool);
    const migrationsFolder = join(import.meta.dir, "../../drizzle");
    await migrate(db, { migrationsFolder, migrationsSchema: schemaName });
    return { pool, db, schemaName };
  } finally {
    if (shouldCloseAdminPool) {
      await adminPool.end().catch(() => undefined);
    }
  }
}

/**
 * Safely resets database tables within a worker's isolated schema between test cases.
 *
 * @param db - Drizzle DB client of the worker
 * @param schemaName - Target schema to truncate (defaults to 'public' if not specified)
 */

/**
 * Tears down a worker's isolated database context by ending its pool and dropping its schema.
 *
 * @param ctx - The test database context to tear down
 * @param existingAdminPool - Optional admin pool to perform DROP SCHEMA
 */
export async function teardownWorkerTestDatabase(
  ctx: TestDatabaseContext,
  existingAdminPool?: Pool,
): Promise<void> {
  // Close worker connection pool gracefully to release all open client sockets
  await ctx.pool.end().catch(() => undefined);
  clearSchemaTablesCache(ctx.schemaName);

  // Drop the isolated schema using an admin pool connection
  const adminPool = existingAdminPool ?? createTestPool();
  const shouldCloseAdminPool = !existingAdminPool;

  try {
    await dropTestSchema(adminPool, ctx.schemaName);
  } finally {
    if (shouldCloseAdminPool) {
      await adminPool.end().catch(() => undefined);
    }
  }
}

/**
 * Safely drops a test schema after verifying its naming convention against SQL injection.
 *
 * @param pool - PostgreSQL connection pool
 * @param schemaName - Target test schema name to drop
 */
export async function dropTestSchema(
  pool: Pool,
  schemaName: string,
): Promise<void> {
  if (/^test_\d+_[a-f0-9_]+$/.test(schemaName)) {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
  }
}

/**
 * Runs database migrations for a Drizzle instance.
 *
 * @param db - Drizzle database client
 */
export async function runMigrations(db: DrizzleDB): Promise<void> {
  const migrationsFolder = join(import.meta.dir, "../../drizzle");
  await migrate(db, { migrationsFolder });
}
