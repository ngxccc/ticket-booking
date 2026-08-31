import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import {
  createWorkerTestDatabase,
  teardownWorkerTestDatabase,
  type TestDatabaseContext,
} from "../helpers/database.helper";
import { truncateAllTables } from "@/database/database.connection";
import { genres, seatTypes, users } from "@/database/schemas";
import { seedDatabase } from "@/database/seeds/seed.orchestrator";
import { MASTER_GENRES } from "@/database/seeds/data/genres.data";
import { SEAT_TYPES_DATA } from "@/database/seeds/data/seat-types.data";
import { SEED_USERS_DATA } from "@/database/seeds/data/users.data";
import { comparePassword } from "@/common/utils/crypto.util";
import { DEFAULT_SEED_PASSWORD } from "@/database/seeds/constants/seed.constant";

describe("Database Seeding Engine Integration", () => {
  let context: TestDatabaseContext;

  beforeAll(async () => {
    context = await createWorkerTestDatabase();
  });

  afterAll(async () => {
    await teardownWorkerTestDatabase(context);
  });

  beforeEach(async () => {
    await truncateAllTables(context.db, context.schemaName);
  });

  describe("Tier 1: Master Reference Data Seeding", () => {
    it("should successfully seed genres, seat types, and verified system users", async () => {
      const summary = await seedDatabase({
        db: context.db,
        scope: "reference",
      });

      expect(summary.genres).toBe(MASTER_GENRES.length);
      expect(summary.seatTypes).toBe(SEAT_TYPES_DATA.length);
      expect(summary.users).toBe(SEED_USERS_DATA.length);

      // Verify genres in database
      const dbGenres = await context.db.select().from(genres);
      expect(dbGenres.length).toBe(MASTER_GENRES.length);
      const genreNames = dbGenres.map((g) => g.name);
      for (const expectedGenre of MASTER_GENRES) {
        expect(genreNames).toContain(expectedGenre.name);
      }

      // Verify seat types in database
      const dbSeatTypes = await context.db.select().from(seatTypes);
      expect(dbSeatTypes.length).toBe(SEAT_TYPES_DATA.length);
      const standardType = dbSeatTypes.find((st) => st.name === "Standard");
      expect(standardType).toBeDefined();
      expect(standardType?.priceMultiplier).toBe("1.00");

      const vipType = dbSeatTypes.find((st) => st.name === "VIP");
      expect(vipType).toBeDefined();
      expect(vipType?.priceMultiplier).toBe("1.20");

      const coupleType = dbSeatTypes.find((st) => st.name === "Couple");
      expect(coupleType).toBeDefined();
      expect(coupleType?.priceMultiplier).toBe("2.00");

      // Verify system users in database
      const dbUsers = await context.db.select().from(users);
      expect(dbUsers.length).toBe(SEED_USERS_DATA.length);

      const adminUser = dbUsers.find(
        (u) => u.email === "admin@ticketbooking.com",
      );
      expect(adminUser).toBeDefined();
      expect(adminUser?.role).toBe("admin");
      expect(adminUser?.status).toBe("active");

      // Verify pre-computed password hash works with comparePassword utility
      if (adminUser?.passwordHash) {
        const isPasswordValid = await comparePassword(
          DEFAULT_SEED_PASSWORD,
          adminUser.passwordHash,
        );
        expect(isPasswordValid).toBe(true);
      }
    });

    it("should be idempotent and produce zero duplicate rows when run consecutively", async () => {
      // First run
      await seedDatabase({
        db: context.db,
        scope: "reference",
      });

      const firstGenreCount = (await context.db.select().from(genres)).length;
      const firstSeatTypeCount = (await context.db.select().from(seatTypes))
        .length;
      const firstUserCount = (await context.db.select().from(users)).length;

      // Second consecutive run
      const summarySecondRun = await seedDatabase({
        db: context.db,
        scope: "reference",
      });

      const secondGenreCount = (await context.db.select().from(genres)).length;
      const secondSeatTypeCount = (await context.db.select().from(seatTypes))
        .length;
      const secondUserCount = (await context.db.select().from(users)).length;

      expect(secondGenreCount).toBe(firstGenreCount);
      expect(secondSeatTypeCount).toBe(firstSeatTypeCount);
      expect(secondUserCount).toBe(firstUserCount);
      expect(summarySecondRun.errors).toHaveLength(0);
    });

    it("should support selective granular scoping for genres, seat-types, and users", async () => {
      // Seed only genres
      await seedDatabase({
        db: context.db,
        scope: "genres",
      });

      const dbGenres = await context.db.select().from(genres);
      const dbSeatTypes = await context.db.select().from(seatTypes);
      const dbUsers = await context.db.select().from(users);

      expect(dbGenres.length).toBe(MASTER_GENRES.length);
      expect(dbSeatTypes.length).toBe(0);
      expect(dbUsers.length).toBe(0);
    });

    it("should support comma-separated multi-scopes and array scopes", async () => {
      // Seed genres and users together via comma-separated string
      await seedDatabase({
        db: context.db,
        scope: "genres,users",
      });

      const dbGenres = await context.db.select().from(genres);
      const dbSeatTypes = await context.db.select().from(seatTypes);
      const dbUsers = await context.db.select().from(users);

      expect(dbGenres.length).toBe(MASTER_GENRES.length);
      expect(dbSeatTypes.length).toBe(0);
      expect(dbUsers.length).toBe(SEED_USERS_DATA.length);
    });

    it("should seed all supported entities when no scope option is provided", async () => {
      const summary = await seedDatabase({
        db: context.db,
      });

      expect(summary.genres).toBe(MASTER_GENRES.length);
      expect(summary.seatTypes).toBe(SEAT_TYPES_DATA.length);
      expect(summary.users).toBe(SEED_USERS_DATA.length);
    });

    it("should reject execution when an invalid scope is provided", async () => {
      let thrownError: Error | null = null;
      try {
        await seedDatabase({
          db: context.db,
          scope: "invalid-scope",
        });
      } catch (error) {
        thrownError = error as Error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError?.message).toMatch(/invalid seeding scope/i);
    });
  });

  describe("Production Safety Guard", () => {
    it("should throw error and abort if reset is requested in production environment", async () => {
      const originalEnv = process.env.NODE_ENV;
      let thrownError: Error | null = null;
      try {
        process.env.NODE_ENV = "production";
        await seedDatabase({
          db: context.db,
          scope: "reference",
          reset: true,
        });
      } catch (error) {
        thrownError = error as Error;
      } finally {
        process.env.NODE_ENV = originalEnv;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError?.message).toMatch(/production/i);
    });
  });
});
