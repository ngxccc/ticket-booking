import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import type { INestApplication } from "@nestjs/common";
import { createTestApp } from "../helpers/app.helper";
import { runMigrations, truncateAllTables } from "../helpers/database.helper";
import type { DrizzleDB } from "@/database/database.module";
import { cinemas, halls, movies, shows } from "@/database/schemas";

describe("Shows Module Integration", () => {
  let app: INestApplication;
  let db: DrizzleDB;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await truncateAllTables(db);
    await runMigrations(db);
  }, 30000);

  beforeEach(async () => {
    await truncateAllTables(db);
  }, 15000);

  afterAll(async () => {
    await app.close();
  });

  describe("PostgreSQL Exclusion Constraint", () => {
    it("should prevent overlapping showtimes and buffer violations in the same hall via DB exclusion constraint", async () => {
      // 1. Create seed data: Movie, Cinema & Halls
      const [[movie], [cinema]] = await Promise.all([
        db
          .insert(movies)
          .values({
            durationMinutes: 120,
            rating: "PG",
          })
          .returning({ id: movies.id }),
        db
          .insert(cinemas)
          .values({
            name: "Test Cinema",
            address: "123 Main St",
          })
          .returning({ id: cinemas.id }),
      ]);

      if (!movie || !cinema) {
        throw new Error("Failed to seed movie or cinema");
      }

      const [hall1, hall2] = await db
        .insert(halls)
        .values([
          {
            cinemaId: cinema.id,
            name: "Hall 1",
            totalSeats: 100,
          },
          {
            cinemaId: cinema.id,
            name: "Hall 2",
            totalSeats: 100,
          },
        ])
        .returning({ id: halls.id });

      if (!hall1 || !hall2) {
        throw new Error("Failed to seed halls");
      }

      const T = {
        s10_00: new Date("2026-09-01T10:00:00Z"),
        s11_00: new Date("2026-09-01T11:00:00Z"),
        s12_00: new Date("2026-09-01T12:00:00Z"),
        s12_10: new Date("2026-09-01T12:10:00Z"),
        s12_15: new Date("2026-09-01T12:15:00Z"),
        s13_00: new Date("2026-09-01T13:00:00Z"),
        s14_10: new Date("2026-09-01T14:10:00Z"),
        s14_15: new Date("2026-09-01T14:15:00Z"),
      };

      function getErrorMessage(err: unknown): string {
        if (err instanceof Error) {
          const causeMessage =
            err.cause instanceof Error ? err.cause.message : "";
          const causeDetails =
            typeof err.cause === "object" && err.cause !== null
              ? JSON.stringify(err.cause)
              : "";
          return `${err.message} ${causeMessage} ${causeDetails}`;
        }
        return "";
      }

      async function expectConflict(fn: () => Promise<unknown>) {
        let error: unknown = null;
        try {
          await fn();
        } catch (err) {
          error = err;
        }
        expect(getErrorMessage(error)).toMatch(
          /23P01|no_hall_schedule_overlap|exclusion/,
        );
      }

      // TEST CASE 1: Insert Show 1 into Hall 1 (Valid)
      const [show1] = await db
        .insert(shows)
        .values({
          movieId: movie.id,
          hallId: hall1.id,
          startTime: T.s10_00,
          endTime: T.s12_00,
          basePrice: 100000,
        })
        .returning({ id: shows.id });
      expect(show1).toBeDefined();

      // TEST CASE 2: Attempt to Insert Show 2 (Overlapping in Hall 1: 11:00 to 13:00) -> MUST FAIL
      await expectConflict(() =>
        db.insert(shows).values({
          movieId: movie.id,
          hallId: hall1.id,
          startTime: T.s11_00,
          endTime: T.s13_00,
          basePrice: 100000,
        }),
      );

      // TEST CASE 3: Attempt to Insert Show 3 (Buffer Violation in Hall 1: 12:10 to 14:10, under 15m buffer threshold) -> MUST FAIL
      await expectConflict(() =>
        db.insert(shows).values({
          movieId: movie.id,
          hallId: hall1.id,
          startTime: T.s12_10,
          endTime: T.s14_10,
          basePrice: 100000,
        }),
      );

      // TEST CASE 4: Insert Show 4 in Hall 1 AFTER 15m Buffer (12:15 to 14:15) -> MUST SUCCEED
      const [show4] = await db
        .insert(shows)
        .values({
          movieId: movie.id,
          hallId: hall1.id,
          startTime: T.s12_15,
          endTime: T.s14_15,
          basePrice: 100000,
        })
        .returning({ id: shows.id });
      expect(show4).toBeDefined();

      // 5. Insert Show 5 in Hall 2 (Same time as Show 1, but DIFFERENT hall) -> MUST SUCCEED
      const [show5] = await db
        .insert(shows)
        .values({
          movieId: movie.id,
          hallId: hall2.id,
          startTime: T.s10_00,
          endTime: T.s12_00,
          basePrice: 100000,
        })
        .returning({ id: shows.id });
      expect(show5).toBeDefined();
    });
  });
});
