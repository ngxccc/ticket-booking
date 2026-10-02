import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import request from "supertest";
import { eq } from "drizzle-orm";
import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import { users } from "@/database/schemas";
import {
  createTestApp,
  teardownTestApp,
  type TestAppSetup,
} from "../helpers/app.helper";

describe("Security Penetration - Stored XSS Defense", () => {
  let setup: TestAppSetup;
  let app: INestApplication;

  const getHttpServer = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
  }, 30000);

  afterAll(async () => {
    await teardownTestApp(setup);
  });

  describe("POST /auth/register", () => {
    describe("when user submits HTML and script execution payloads", () => {
      it("should neutralize script execution tags in database when fullName contains script tags", async () => {
        const password = "ValidPassword123!";
        const email = `xss-${crypto.randomUUID().slice(0, 8)}@example.com`;
        const xssPayload = {
          email,
          fullName: "<script>alert('XSS')</script>John Doe",
          phoneNumber: "0912345678",
          password,
          confirmPassword: password,
          agreeTerms: true,
        };

        const res = await request(getHttpServer())
          .post("/api/v1/auth/register")
          .send(xssPayload);

        expect(res.status).toBe(201);

        // Database record inspection confirms Stored XSS payloads cannot persist to disk.
        const [savedUser] = await setup.db
          .select()
          .from(users)
          .where(eq(users.email, email));

        expect(savedUser).toBeDefined();
        expect(savedUser?.fullName).not.toContain("<script>");
        expect(savedUser?.fullName).not.toContain("</script>");
        expect(savedUser?.fullName).toBe("John Doe");
      });

      it("should strip malicious img onerror event handlers in database when fullName contains event handlers", async () => {
        const password = "ValidPassword123!";
        const email = `xss-img-${crypto.randomUUID().slice(0, 8)}@example.com`;
        const xssPayload = {
          email,
          fullName: "Jane <img src=x onerror=alert('PWNED')> Doe",
          phoneNumber: "0912345678",
          password,
          confirmPassword: password,
          agreeTerms: true,
        };

        const res = await request(getHttpServer())
          .post("/api/v1/auth/register")
          .send(xssPayload);

        expect(res.status).toBe(201);

        // Sanitizer strips dangerous HTML tags and inline attributes while preserving clean text.
        const [savedUser] = await setup.db
          .select()
          .from(users)
          .where(eq(users.email, email));

        expect(savedUser).toBeDefined();
        expect(savedUser?.fullName).not.toContain("onerror");
        expect(savedUser?.fullName).not.toContain("<img");
        expect(savedUser?.fullName).toBe("Jane Doe");
      });
    });
  });
});
