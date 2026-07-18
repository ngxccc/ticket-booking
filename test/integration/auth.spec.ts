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
import { type Server } from "node:http";
import { eq } from "drizzle-orm";
import { createTestApp } from "../helpers/app.helper";
import { runMigrations, truncateAllTables } from "../helpers/database.helper";
import type { DrizzleDB } from "@/database/database.module";
import { users } from "@/database/schemas";

interface SuccessResponse {
  success: boolean;
}
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  success: boolean;
  data: AuthTokens;
}

interface MessageResponse {
  message: string;
}

interface ValidationErrorItem {
  property: string;
  constraints: Record<string, string>;
}

interface ValidationResponse {
  message: ValidationErrorItem[];
}
describe("Auth Module Integration (Supertest)", () => {
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

  describe("Happy Path Flow", () => {
    it("should complete the full registration, login, refresh, and logout cycle", async () => {
      const email = "john.doe@example.com";
      const password = "Password123";

      const registerRes = await request(getHttpServer())
        .post("/auth/register")
        .send({
          email,
          fullName: "John Doe",
          phoneNumber: "0912345678",
          password,
          confirmPassword: password,
          agreeTerms: true,
        });
      expect(registerRes.status).toBe(201);
      const registerBody = registerRes.body as unknown as SuccessResponse;
      expect(registerBody.success).toBe(true);
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      expect(dbUser).toBeDefined();
      if (!dbUser) throw new Error("dbUser is undefined");
      expect(dbUser.status).toBe("active");

      const loginRes = await request(getHttpServer()).post("/auth/login").send({
        email,
        password,
      });
      expect(loginRes.status).toBe(200);
      const loginBody = loginRes.body as unknown as AuthResponse;
      expect(loginBody.success).toBe(true);
      expect(loginBody.data.accessToken).toBeTypeOf("string");
      expect(loginBody.data.refreshToken).toBeTypeOf("string");

      const { refreshToken } = loginBody.data;
      const refreshRes = await request(getHttpServer())
        .post("/auth/refresh")
        .send({
          refreshToken,
        });
      expect(refreshRes.status).toBe(200);
      const refreshBody = refreshRes.body as unknown as AuthResponse;
      expect(refreshBody.success).toBe(true);
      expect(refreshBody.data.accessToken).toBeTypeOf("string");
      expect(refreshBody.data.refreshToken).toBeTypeOf("string");

      const newRefreshToken = refreshBody.data.refreshToken;

      const logoutRes = await request(getHttpServer())
        .post("/auth/logout")
        .send({
          refreshToken: newRefreshToken,
        });
      expect(logoutRes.status).toBe(200);
      const logoutBody = logoutRes.body as unknown as SuccessResponse;
      expect(logoutBody.success).toBe(true);
    });
  });

  describe("Negative and Validation Flow", () => {
    it("should block duplicate email registration", async () => {
      const email = "duplicate@example.com";
      const payload = {
        email,
        fullName: "User A",
        phoneNumber: "0912345678",
        password: "Password123",
        confirmPassword: "Password123",
        agreeTerms: true,
      };

      const firstReg = await request(getHttpServer())
        .post("/auth/register")
        .send(payload);
      expect(firstReg.status).toBe(201);

      const secondReg = await request(getHttpServer())
        .post("/auth/register")
        .send(payload);
      expect(secondReg.status).toBe(409);
      const secondRegBody = secondReg.body as unknown as MessageResponse;
      expect(["auth.EMAIL_ALREADY_EXISTS", "Email đã tồn tại"]).toContain(
        secondRegBody.message,
      );
    });

    it("should fail validation with invalid email format", async () => {
      const payload = {
        email: "invalid-email",
        fullName: "User B",
        phoneNumber: "0912345678",
        password: "Password123",
        confirmPassword: "Password123",
        agreeTerms: true,
      };

      const res = await request(getHttpServer())
        .post("/auth/register")
        .send(payload);
      expect(res.status).toBe(400);
      const resBody = res.body as unknown as ValidationResponse;
      const firstError = resBody.message[0];
      expect(firstError?.property).toBe("email");
      expect(firstError?.constraints["isEmail"]).toBeDefined();
    });

    it("should sanitize and strip HTML tags from fullName", async () => {
      const email = "xss@example.com";
      const payload = {
        email,
        fullName: "<b>Test</b> User",
        phoneNumber: "0912345678",
        password: "Password123",
        confirmPassword: "Password123",
        agreeTerms: true,
      };

      const res = await request(getHttpServer())
        .post("/auth/register")
        .send(payload);
      expect(res.status).toBe(201);

      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      expect(dbUser).toBeDefined();
      if (!dbUser) throw new Error("dbUser is undefined");
      expect(dbUser.fullName).toBe("Test User");
    });

    it("should reject registration if fullName consists entirely of stripped script tags", async () => {
      const payload = {
        email: "xss-script@example.com",
        fullName: "<script>alert('XSS')</script>",
        phoneNumber: "0912345678",
        password: "Password123",
        confirmPassword: "Password123",
        agreeTerms: true,
      };

      const res = await request(getHttpServer())
        .post("/auth/register")
        .send(payload);
      expect(res.status).toBe(400);
      const resBody = res.body as unknown as ValidationResponse;
      const firstError = resBody.message[0];
      expect(firstError?.property).toBe("fullName");
      expect(firstError?.constraints["isNotEmpty"]).toBeDefined();
    });

    it("should safely register and parameterize names containing SQL injection syntax", async () => {
      const email = "sqli@example.com";
      const sqlInjectionName = "Admin' OR '1'='1 --";
      const payload = {
        email,
        fullName: sqlInjectionName,
        phoneNumber: "0912345678",
        password: "Password123",
        confirmPassword: "Password123",
        agreeTerms: true,
      };

      const res = await request(getHttpServer())
        .post("/auth/register")
        .send(payload);
      expect(res.status).toBe(201);

      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      expect(dbUser).toBeDefined();
      if (!dbUser) throw new Error("dbUser is undefined");
      expect(dbUser.fullName).toBe(sqlInjectionName);
    });

    it("should require email verification if status is pending_verification and succeed after verification", async () => {
      const email = "verify@example.com";
      const password = "Password123";
      const payload = {
        email,
        fullName: "Verify User",
        phoneNumber: "0912345678",
        password,
        confirmPassword: password,
        agreeTerms: true,
      };

      const regRes = await request(getHttpServer())
        .post("/auth/register")
        .send(payload);
      expect(regRes.status).toBe(201);

      const [userBefore] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      expect(userBefore).toBeDefined();
      if (!userBefore) throw new Error("userBefore is undefined");

      await db
        .update(users)
        .set({ status: "pending_verification" })
        .where(eq(users.id, userBefore.id));

      const loginFailRes = await request(getHttpServer())
        .post("/auth/login")
        .send({ email, password });
      expect(loginFailRes.status).toBe(400);
      const loginFailBody = loginFailRes.body as unknown as MessageResponse;
      const hasEmailNotVerified = loginFailBody.message.includes(
        "auth.EMAIL_NOT_VERIFIED",
      );
      const hasNotVerifiedVietnamese =
        loginFailBody.message.includes("chưa được xác thực");
      expect(hasEmailNotVerified || hasNotVerifiedVietnamese).toBe(true);

      const [userWithToken] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      expect(userWithToken).toBeDefined();
      if (!userWithToken?.verificationToken) {
        throw new Error("Verification token was not generated");
      }

      const verifyRes = await request(getHttpServer())
        .post("/auth/verify-email")
        .send({ token: userWithToken.verificationToken });
      expect(verifyRes.status).toBe(200);

      const loginSuccessRes = await request(getHttpServer())
        .post("/auth/login")
        .send({ email, password });
      expect(loginSuccessRes.status).toBe(200);
      const loginSuccessBody =
        loginSuccessRes.body as unknown as SuccessResponse;
      expect(loginSuccessBody.success).toBe(true);
    });
  });
});
