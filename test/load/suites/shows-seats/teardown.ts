import { Logger } from "@nestjs/common";
import { resolve } from "node:path";
import { unlink } from "node:fs/promises";
import { inArray } from "drizzle-orm";
import {
  showSeats,
  shows,
  seats,
  halls,
  cinemas,
  movies,
  movieTranslations,
  seatTypes,
} from "@/database/schemas";
import { createTestPool } from "../../../helpers/database.helper";
import { createDrizzleClient } from "@/database/database.connection";
import type { ShowsSeatsLoadFixture } from "../../shared/types";

const logger = new Logger("TeardownShowsSeats");

export async function teardownShowsSeatsData(): Promise<void> {
  const fixtureFilePath = resolve(
    process.cwd(),
    "test/load/.dist/shows-seats-fixtures.json",
  );
  let fixture: ShowsSeatsLoadFixture;

  try {
    const content = await Bun.file(fixtureFilePath).text();
    fixture = JSON.parse(content) as ShowsSeatsLoadFixture;
  } catch {
    logger.warn(
      `No fixture file found at ${fixtureFilePath}, skipping teardown.`,
    );
    return;
  }

  const pool = createTestPool();
  const db = createDrizzleClient(pool);

  try {
    logger.log("Cleaning up shows seating chart benchmark data...");
    const targetShowIds = [fixture.standardShowId, fixture.imaxShowId].filter(
      Boolean,
    );

    if (targetShowIds.length > 0) {
      // Find associated halls and movies
      const targetShows = await db
        .select({
          id: shows.id,
          hallId: shows.hallId,
          movieId: shows.movieId,
        })
        .from(shows)
        .where(inArray(shows.id, targetShowIds));

      const hallIds = targetShows.map((s) => s.hallId);
      const movieIds = targetShows.map((s) => s.movieId);

      // Cascading manual cleanup in dependency order
      await db
        .delete(showSeats)
        .where(inArray(showSeats.showId, targetShowIds));
      await db.delete(shows).where(inArray(shows.id, targetShowIds));

      if (hallIds.length > 0) {
        await db.delete(seats).where(inArray(seats.hallId, hallIds));

        const targetHalls = await db
          .select({ id: halls.id, cinemaId: halls.cinemaId })
          .from(halls)
          .where(inArray(halls.id, hallIds));
        const cinemaIds = targetHalls.map((h) => h.cinemaId);

        await db.delete(halls).where(inArray(halls.id, hallIds));
        if (cinemaIds.length > 0) {
          await db.delete(cinemas).where(inArray(cinemas.id, cinemaIds));
        }
      }

      if (movieIds.length > 0) {
        await db
          .delete(movieTranslations)
          .where(inArray(movieTranslations.movieId, movieIds));
        await db.delete(movies).where(inArray(movies.id, movieIds));
      }

      // Cleanup seat types created with STD/VIP benchmark tags
      await db.delete(seatTypes).where(
        inArray(
          seatTypes.name,
          // All seatTypes linked to our halls are already disconnected
          [],
        ),
      );
    }

    // Remove fixture file
    await unlink(fixtureFilePath).catch(() => undefined);
    logger.log("Teardown completed successfully.");
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  teardownShowsSeatsData()
    .then(() => {
      process.exit(0);
    })
    .catch((err: unknown) => {
      logger.error("Teardown failed", err);
      process.exit(1);
    });
}
