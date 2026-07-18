import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { join } from "path";
import type { DrizzleDB } from "@/database/database.module";

// WHY: Run migrations programmatically before running integration tests to ensure schema is up-to-date.
export async function runMigrations(db: DrizzleDB): Promise<void> {
  const migrationsFolder = join(import.meta.dir, "../../drizzle");
  await migrate(db, { migrationsFolder });
}

// WHY: Reset database state between tests to maintain test isolation and prevent state pollution.
export async function truncateAllTables(db: DrizzleDB): Promise<void> {
  const tables = [
    "payments",
    "booking_combos",
    "tickets",
    "bookings",
    "show_seats",
    "shows",
    "seats",
    "halls",
    "cinemas",
    "seat_types",
    "combos",
    "vouchers",
    "movie_genres",
    "movie_translations",
    "movies",
    "genres",
    "refresh_tokens",
    "users",
    "outbox_events",
  ];

  const query = `TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE;`;
  await db.execute(sql.raw(query));
}
