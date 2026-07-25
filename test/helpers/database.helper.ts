import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "path";
import type { DrizzleDB } from "@/database/database.module";

// WHY: Run migrations programmatically before running integration tests to ensure schema is up-to-date.
export async function runMigrations(db: DrizzleDB): Promise<void> {
  const migrationsFolder = join(import.meta.dir, "../../drizzle");
  await migrate(db, { migrationsFolder });
}

// WHY: Reset database state dynamically between tests by querying pg_tables, avoiding manual table list maintenance.
export async function truncateAllTables(db: DrizzleDB): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Safety Guard Violation: truncateAllTables can only be executed when NODE_ENV=test!",
    );
  }
  const result = await db.execute<{ tablename: string }>(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public';`,
  );

  const tables = result.rows
    .map((r) => r.tablename)
    .filter((t) => t !== "__drizzle_migrations");

  if (tables.length === 0) return;

  const query = `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE;`;
  await db.execute(sql.raw(query));
}
