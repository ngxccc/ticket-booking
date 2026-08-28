import { randomUUID } from "crypto";
import { join } from "path";
import { Pool, type PoolConfig } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import { env } from "@/env";
import * as schema from "@/database/schemas";
import type { DrizzleDB } from "@/database/database.module";
export type { DrizzleDB };

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
  if (!env.DB_URL) return undefined;
  return env.DB_URL.replace("-pooler.", ".").replace(
    /sslmode=(require|prefer|verify-ca)/gi,
    "sslmode=verify-full",
  );
}

/**
 * Creates a PostgreSQL connection pool configured for the test environment.
 *
 * @param overrides - Optional connection pool configuration overrides
 */
export function createTestPool(overrides?: PoolConfig): Pool {
  const dbUrl = getNormalizedTestDbUrl();
  return dbUrl
    ? new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 3000,
        ...overrides,
      })
    : new Pool({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USERNAME,
        password: env.DB_PASSWORD,
        database: env.DB_DATABASE,
        connectionTimeoutMillis: 3000,
        ...overrides,
      });
}

/**
 * Creates a configured Drizzle ORM client with schema relations and JIT enabled.
 *
 * @param pool - PostgreSQL connection pool
 */
export function createDrizzleClient(pool: Pool): DrizzleDB {
  return drizzle({
    client: pool,
    relations: schema.schemaRelations,
    jit: true,
  }) as unknown as DrizzleDB;
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

    const pool = createTestPool({
      options: `-c search_path="${schemaName}",public`,
      max: 10,
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
export async function truncateAllTables(
  db: DrizzleDB,
  schemaName = "public",
): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Safety Guard Violation: truncateAllTables can only be executed when NODE_ENV=test!",
    );
  }

  const result = await db.execute(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = ${schemaName};`,
  );

  const tables = (result.rows as { tablename: string }[])
    .map((r: { tablename: string }) => r.tablename)
    .filter((t: string) => t !== "__drizzle_migrations");
  if (tables.length === 0) return;

  // Safe truncation with CASCADE within the isolated worker schema
  const query = `TRUNCATE TABLE ${tables.map((t) => `"${schemaName}"."${t}"`).join(", ")} CASCADE;`;
  await db.execute(sql.raw(query));
}

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
