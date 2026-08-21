import {
  describe,
  expect,
  it,
  beforeAll,
  beforeEach,
  afterAll,
} from "bun:test";
import request from "supertest";
import { type INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import { eq } from "drizzle-orm";
import { createTestApp } from "../helpers/app.helper";
import { runMigrations, truncateAllTables } from "../helpers/database.helper";
import type { DrizzleDB } from "@/database/database.module";
import { users } from "@/database/schemas";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  success: boolean;
  data: AuthTokens;
}

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isVerified: boolean;
  status: string;
}

interface GetProfileResponse {
  success: boolean;
  data: UserProfile;
}

interface Rfc9457ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
}

describe("Users Module Integration", () => {
  let app: INestApplication;
  let db: DrizzleDB;

  const getHttpServer = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await runMigrations(db);
  });

  beforeEach(async () => {
    await truncateAllTables(db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /users/me", () => {
    it("should return 200 OK with user profile payload when authenticated", async () => {
      const email = "test.user@example.com";
      const password = "Password123!";
      const fullName = "Test User";

      await request(getHttpServer()).post("/auth/register").send({
        email,
        fullName,
        phoneNumber: "0912345678",
        password,
        confirmPassword: password,
        agreeTerms: true,
      });

      await db
        .update(users)
        .set({ status: "active" })
        .where(eq(users.email, email));

      const loginRes = await request(getHttpServer()).post("/auth/login").send({
        email,
        password,
      });

      expect(loginRes.status).toBe(200);
      const loginBody = loginRes.body as unknown as AuthResponse;
      const { accessToken } = loginBody.data;

      const profileRes = await request(getHttpServer())
        .get("/users/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(profileRes.status).toBe(200);
      const profileBody = profileRes.body as unknown as GetProfileResponse;
      expect(profileBody.success).toBe(true);
      expect(profileBody.data.email).toBe(email);
      expect(profileBody.data.fullName).toBe(fullName);
      expect(profileBody.data.role).toBe("user");
      expect(profileBody.data.isVerified).toBe(true);
      expect(profileBody.data.status).toBe("active");
    });

    it("should return 401 Unauthorized in RFC 9457 format when Bearer token is missing", async () => {
      const res = await request(getHttpServer()).get("/users/me");

      expect(res.status).toBe(401);
      const body = res.body as unknown as Rfc9457ErrorResponse;
      expect(body.status).toBe(401);
      expect(body.title).toBe("Unauthorized");
      expect(body.instance).toBe("/users/me");
    });

    it("should return 403 Forbidden in RFC 9457 format when account status is suspended", async () => {
      const email = "suspended.user@example.com";
      const password = "Password123!";

      await request(getHttpServer()).post("/auth/register").send({
        email,
        fullName: "Suspended User",
        phoneNumber: "0987654321",
        password,
        confirmPassword: password,
        agreeTerms: true,
      });

      await db
        .update(users)
        .set({ status: "active" })
        .where(eq(users.email, email));

      const loginRes = await request(getHttpServer()).post("/auth/login").send({
        email,
        password,
      });

      const loginBody = loginRes.body as unknown as AuthResponse;
      const { accessToken } = loginBody.data;

      await db
        .update(users)
        .set({ status: "suspended" })
        .where(eq(users.email, email));

      const profileRes = await request(getHttpServer())
        .get("/users/me")
        .set("Authorization", `Bearer ${accessToken}`);

      expect(profileRes.status).toBe(403);
      const body = profileRes.body as unknown as Rfc9457ErrorResponse;
      expect(body.status).toBe(403);
      expect(body.title).toBe("Forbidden");
      expect(body.instance).toBe("/users/me");
    });
  });
});
