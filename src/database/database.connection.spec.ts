import { describe, expect, it } from "bun:test";
import {
  normalizeDatabaseUrl,
  createDatabasePool,
  createDrizzleClient,
} from "./database.connection";

describe("Database Connection Factory Unit Tests", () => {
  describe("normalizeDatabaseUrl", () => {
    it("should return undefined if no URL is provided", () => {
      expect(normalizeDatabaseUrl(undefined)).toBeUndefined();
      expect(normalizeDatabaseUrl("")).toBeUndefined();
    });

    it("should unpool cloud connection URLs and map legacy sslmode", () => {
      const input =
        "postgresql://user:pass@ep-cool-123-pooler.us-east-2.aws.neon.tech/db?sslmode=require";
      const normalized = normalizeDatabaseUrl(input);

      expect(normalized).toBe(
        "postgresql://user:pass@ep-cool-123.us-east-2.aws.neon.tech/db?sslmode=verify-full",
      );
    });

    it("should map prefer and verify-ca sslmodes to verify-full", () => {
      expect(
        normalizeDatabaseUrl("postgresql://localhost/db?sslmode=prefer"),
      ).toBe("postgresql://localhost/db?sslmode=verify-full");

      expect(
        normalizeDatabaseUrl("postgresql://localhost/db?sslmode=verify-ca"),
      ).toBe("postgresql://localhost/db?sslmode=verify-full");
    });
  });

  describe("createDatabasePool & createDrizzleClient", () => {
    it("should instantiate a Pool with custom URL and overrides", async () => {
      const pool = createDatabasePool(
        { max: 5 },
        "postgresql://localhost:5432/test_db",
      );
      expect(pool).toBeDefined();

      const db = createDrizzleClient(pool);
      expect(db).toBeDefined();

      await pool.end();
    });
  });
});
