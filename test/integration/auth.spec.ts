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
import { JwtService } from "@nestjs/jwt";
import { eq } from "drizzle-orm";
import { createTestApp } from "../helpers/app.helper";
import { runMigrations, truncateAllTables } from "../helpers/database.helper";
import type { DrizzleDB } from "@/database/database.module";
import { users, refreshTokens, outboxEvents } from "@/database/schemas";

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
  message?: string;
  detail?: string;
}

interface ValidationErrorItem {
  property: string;
  constraints: Record<string, string>;
}

interface InvalidParam {
  name: string;
  reason: string;
}

interface ValidationResponse {
  invalidParams?: InvalidParam[];
  message?: ValidationErrorItem[];
}
describe("Auth Module Integration", () => {
  let app: INestApplication;
  let db: DrizzleDB;

  const getHttpServer = (): Server => app.getHttpServer() as Server;
  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await runMigrations(db);
  }, 30000);

  beforeEach(async () => {
    await truncateAllTables(db);
  }, 15000);

  afterAll(async () => {
    await app.close();
  });

  describe("POST /auth/register, POST /auth/login, POST /auth/refresh, POST /auth/logout", () => {
    it("should complete the full registration, login, refresh, and logout cycle", async () => {
      const email = "john.doe@example.com";
      const password = "Password123!";

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
        .select({ status: users.status })
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

  describe("Validation & Security Controls", () => {
    it("should block duplicate email registration", async () => {
      const email = "duplicate@example.com";
      const payload = {
        email,
        fullName: "User A",
        phoneNumber: "0912345678",
        password: "Password123!",
        confirmPassword: "Password123!",
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
      const actualMsg = secondRegBody.detail ?? secondRegBody.message ?? "";
      expect(["auth.EMAIL_ALREADY_EXISTS", "Email đã tồn tại"]).toContain(
        actualMsg,
      );
    });

    it("should fail validation with invalid email format", async () => {
      const payload = {
        email: "invalid-email",
        fullName: "User B",
        phoneNumber: "0912345678",
        password: "Password123!",
        confirmPassword: "Password123!",
        agreeTerms: true,
      };

      const res = await request(getHttpServer())
        .post("/auth/register")
        .send(payload);
      expect(res.status).toBe(400);
      const resBody = res.body as unknown as ValidationResponse;
      const invalidParam = resBody.invalidParams?.[0];
      const firstError = resBody.message?.[0];
      expect(invalidParam?.name ?? firstError?.property).toBe("email");
    });

    it("should sanitize and strip HTML tags from fullName", async () => {
      const email = "xss@example.com";
      const payload = {
        email,
        fullName: "<b>Test</b> User",
        phoneNumber: "0912345678",
        password: "Password123!",
        confirmPassword: "Password123!",
        agreeTerms: true,
      };

      const res = await request(getHttpServer())
        .post("/auth/register")
        .send(payload);
      expect(res.status).toBe(201);

      const [dbUser] = await db
        .select({ fullName: users.fullName })
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
        password: "Password123!",
        confirmPassword: "Password123!",
        agreeTerms: true,
      };

      const res = await request(getHttpServer())
        .post("/auth/register")
        .send(payload);
      expect(res.status).toBe(400);
      const resBody = res.body as unknown as ValidationResponse;
      const invalidParam = resBody.invalidParams?.[0];
      const firstError = resBody.message?.[0];
      expect(invalidParam?.name ?? firstError?.property).toBe("fullName");
    });

    it("should safely register and parameterize names containing SQL injection syntax", async () => {
      const email = "sqli@example.com";
      const sqlInjectionName = "Admin' OR '1'='1 --";
      const payload = {
        email,
        fullName: sqlInjectionName,
        phoneNumber: "0912345678",
        password: "Password123!",
        confirmPassword: "Password123!",
        agreeTerms: true,
      };

      const res = await request(getHttpServer())
        .post("/auth/register")
        .send(payload);
      expect(res.status).toBe(201);

      const [dbUser] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      expect(dbUser).toBeDefined();
      if (!dbUser) throw new Error("dbUser is undefined");
      expect(dbUser.fullName).toBe(sqlInjectionName);
    });

    it("should require email verification if status is pending_verification and succeed after verification", async () => {
      const email = "verify@example.com";
      const password = "Password123!";
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
        .select({ id: users.id })
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
      const errorMsg = loginFailBody.detail ?? loginFailBody.message ?? "";
      const hasEmailNotVerified = errorMsg.includes("auth.EMAIL_NOT_VERIFIED");
      const hasNotVerifiedVietnamese = errorMsg.includes("chưa được xác thực");
      expect(hasEmailNotVerified || hasNotVerifiedVietnamese).toBe(true);

      const [userWithToken] = await db
        .select({ verificationToken: users.verificationToken })
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
    }, 15000);
  });

  describe("POST /auth/forgot-password & POST /auth/reset-password", () => {
    const password = "Password123!";

    it("should handle forgot password and reset password happy path successfully, forcing logout of active sessions", async () => {
      const email = "forgot.happy@example.com";

      // Register a user
      const registerRes = await request(getHttpServer())
        .post("/auth/register")
        .send({
          email,
          fullName: "Happy User",
          phoneNumber: "0987654321",
          password,
          confirmPassword: password,
          agreeTerms: true,
        });
      expect(registerRes.status).toBe(201);

      // Call forgot-password
      const forgotRes = await request(getHttpServer())
        .post("/auth/forgot-password")
        .send({ email });
      expect(forgotRes.status).toBe(200);
      const forgotBody = forgotRes.body as unknown as SuccessResponse;
      expect(forgotBody.success).toBe(true);

      // Verify database columns resetPasswordToken & resetPasswordExpiresAt
      const [userInDb] = await db
        .select({
          id: users.id,
          resetPasswordToken: users.resetPasswordToken,
          resetPasswordExpiresAt: users.resetPasswordExpiresAt,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      expect(userInDb).toBeDefined();
      if (!userInDb) throw new Error("userInDb is undefined");
      expect(userInDb.resetPasswordToken).not.toBeNull();
      expect(userInDb.resetPasswordExpiresAt).not.toBeNull();

      const expiresAt = userInDb.resetPasswordExpiresAt;
      if (!expiresAt) throw new Error("expiresAt is null");
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

      const resetToken = userInDb.resetPasswordToken;
      if (!resetToken) throw new Error("resetToken is null");

      // Verify outbox event is created
      const outboxEvent = await db
        .select({ payload: outboxEvents.payload })
        .from(outboxEvents)
        .where(
          eq(outboxEvents.eventType, "auth.reset_password_email_requested"),
        )
        .limit(1);
      expect(outboxEvent.length).toBe(1);
      const firstEvent = outboxEvent[0];
      if (!firstEvent) throw new Error("outboxEvent[0] is undefined");
      const payload = firstEvent.payload as {
        email: string;
        token: string;
      };
      expect(payload.email).toBe(email);
      expect(payload.token).toBe(resetToken);

      // Login user to create an active refresh token session
      const loginRes = await request(getHttpServer())
        .post("/auth/login")
        .send({ email, password });
      expect(loginRes.status).toBe(200);
      const loginBody = loginRes.body as unknown as AuthResponse;
      expect(loginBody.success).toBe(true);

      // Verify refresh token exists in DB
      const tokensBefore = await db
        .select({ id: refreshTokens.id })
        .from(refreshTokens)
        .where(eq(refreshTokens.userId, userInDb.id));
      expect(tokensBefore.length).toBeGreaterThanOrEqual(1);

      // Call reset-password with new password
      const newPassword = "NewPassword123!";
      const resetRes = await request(getHttpServer())
        .post("/auth/reset-password")
        .send({
          token: resetToken,
          password: newPassword,
          confirmPassword: newPassword,
        });
      expect(resetRes.status).toBe(200);
      const resetBody = resetRes.body as unknown as SuccessResponse;
      expect(resetBody.success).toBe(true);

      // Verify database columns are cleared
      const [userAfterReset] = await db
        .select({
          resetPasswordToken: users.resetPasswordToken,
          resetPasswordExpiresAt: users.resetPasswordExpiresAt,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!userAfterReset) throw new Error("userAfterReset is undefined");
      expect(userAfterReset.resetPasswordToken).toBeNull();
      expect(userAfterReset.resetPasswordExpiresAt).toBeNull();

      // Verify all active refresh tokens of the user are physically deleted (force logout)
      const tokensAfter = await db
        .select({ id: refreshTokens.id })
        .from(refreshTokens)
        .where(eq(refreshTokens.userId, userInDb.id));
      expect(tokensAfter.length).toBe(0);

      // Verify old password no longer works
      const oldLoginRes = await request(getHttpServer())
        .post("/auth/login")
        .send({ email, password });
      expect(oldLoginRes.status).toBe(400);

      // Verify login succeeds with the new password
      const newLoginRes = await request(getHttpServer())
        .post("/auth/login")
        .send({ email, password: newPassword });
      expect(newLoginRes.status).toBe(200);
      const newLoginBody = newLoginRes.body as unknown as SuccessResponse;
      expect(newLoginBody.success).toBe(true);
    }, 15000);

    it("should prevent token reuse", async () => {
      const email = "forgot.reuse@example.com";

      // Register user
      await request(getHttpServer()).post("/auth/register").send({
        email,
        fullName: "Reuse User",
        phoneNumber: "0987654322",
        password,
        confirmPassword: password,
        agreeTerms: true,
      });

      // Trigger forgot password
      await request(getHttpServer())
        .post("/auth/forgot-password")
        .send({ email });

      const [user] = await db
        .select({ resetPasswordToken: users.resetPasswordToken })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!user) throw new Error("user is undefined");

      const token = user.resetPasswordToken;
      if (!token) throw new Error("token is null");

      // First reset succeeds
      const firstReset = await request(getHttpServer())
        .post("/auth/reset-password")
        .send({
          token,
          password: "NewPassword123!",
          confirmPassword: "NewPassword123!",
        });
      expect(firstReset.status).toBe(200);

      // Second reset with the same token fails
      const secondReset = await request(getHttpServer())
        .post("/auth/reset-password")
        .send({
          token,
          password: "AnotherNewPassword123!",
          confirmPassword: "AnotherNewPassword123!",
        });
      expect(secondReset.status).toBe(400);
    });

    it("should return generic success for non-existent emails (prevent user enumeration)", async () => {
      const nonExistentEmail = "doesnotexist@example.com";
      const res = await request(getHttpServer())
        .post("/auth/forgot-password")
        .send({ email: nonExistentEmail });
      expect(res.status).toBe(200);
      const body = res.body as unknown as SuccessResponse;
      expect(body.success).toBe(true);
    });

    it("should reject invalid email formats", async () => {
      const res = await request(getHttpServer())
        .post("/auth/forgot-password")
        .send({ email: "not-an-email" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/change-password", () => {
    it("should successfully change password, revoke all refresh tokens, and allow login with new password", async () => {
      // 1. Register user
      const registerRes = await request(getHttpServer())
        .post("/auth/register")
        .send({
          email: "change-pwd-user@example.com",
          fullName: "Change Password User",
          phoneNumber: "0912345678",
          password: "OldPassword123!",
          confirmPassword: "OldPassword123!",
          agreeTerms: true,
        });
      expect(registerRes.status).toBe(201);

      // 2. Activate user status in DB
      await db
        .update(users)
        .set({ status: "active" })
        .where(eq(users.email, "change-pwd-user@example.com"));

      // 3. Login to get Access & Refresh Tokens
      const loginRes = await request(getHttpServer()).post("/auth/login").send({
        email: "change-pwd-user@example.com",
        password: "OldPassword123!",
      });
      expect(loginRes.status).toBe(200);
      const loginBody = loginRes.body as unknown as AuthResponse;
      const { accessToken, refreshToken } = loginBody.data;
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();

      // Verify refresh token exists in DB before change password
      const activeTokensBefore = await db
        .select({ id: refreshTokens.id })
        .from(refreshTokens);
      expect(activeTokensBefore.length).toBeGreaterThan(0);

      // 4. Change Password
      const changePwdRes = await request(getHttpServer())
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: "OldPassword123!",
          newPassword: "NewSecurePassword456!",
        });
      expect(changePwdRes.status).toBe(200);
      const changePwdBody = changePwdRes.body as unknown as SuccessResponse;
      expect(changePwdBody.success).toBe(true);

      // 5. Assert refresh tokens were deleted from DB (Global Session Revocation)
      const activeTokensAfter = await db
        .select({ id: refreshTokens.id })
        .from(refreshTokens);
      expect(activeTokensAfter.length).toBe(0);

      // 6. Assert login with OLD password fails
      const failedLoginRes = await request(getHttpServer())
        .post("/auth/login")
        .send({
          email: "change-pwd-user@example.com",
          password: "OldPassword123!",
        });
      expect(failedLoginRes.status).toBeGreaterThanOrEqual(400);

      // 7. Assert login with NEW password succeeds
      const newLoginRes = await request(getHttpServer())
        .post("/auth/login")
        .send({
          email: "change-pwd-user@example.com",
          password: "NewSecurePassword456!",
        });
      expect(newLoginRes.status).toBe(200);
      const newLoginBody = newLoginRes.body as unknown as AuthResponse;
      expect(newLoginBody.data.accessToken).toBeDefined();
    });

    it("should reject change password request without Authorization token", async () => {
      const res = await request(getHttpServer())
        .post("/auth/change-password")
        .send({
          currentPassword: "OldPassword123!",
          newPassword: "NewSecurePassword456!",
        });
      expect(res.status).toBe(401);
    });

    it("should reject change password request with invalid Authorization token", async () => {
      const res = await request(getHttpServer())
        .post("/auth/change-password")
        .set("Authorization", "Bearer invalid-jwt-token")
        .send({
          currentPassword: "OldPassword123!",
          newPassword: "NewSecurePassword456!",
        });
      expect(res.status).toBe(401);
    });

    it("should reject when current password is wrong", async () => {
      const regRes = await request(getHttpServer())
        .post("/auth/register")
        .send({
          email: "wrong-pwd-user@example.com",
          fullName: "Wrong Password User",
          phoneNumber: "0912345679",
          password: "RealPassword123!",
          confirmPassword: "RealPassword123!",
          agreeTerms: true,
        });
      expect(regRes.status).toBe(201);

      await db
        .update(users)
        .set({ status: "active" })
        .where(eq(users.email, "wrong-pwd-user@example.com"));

      const loginRes = await request(getHttpServer()).post("/auth/login").send({
        email: "wrong-pwd-user@example.com",
        password: "RealPassword123!",
      });
      expect(loginRes.status).toBe(200);
      const accessToken = (loginRes.body as unknown as AuthResponse).data
        .accessToken;

      const changePwdRes = await request(getHttpServer())
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: "IncorrectOldPassword123!",
          newPassword: "NewSecurePassword456!",
        });
      expect(changePwdRes.status).toBe(401);
    }, 15000);

    it("should reject when new password is identical to current password", async () => {
      await request(getHttpServer()).post("/auth/register").send({
        email: "same-pwd-user@example.com",
        fullName: "Same Password User",
        phoneNumber: "0912345680",
        password: "SamePassword123!",
        confirmPassword: "SamePassword123!",
        agreeTerms: true,
      });

      await db
        .update(users)
        .set({ status: "active" })
        .where(eq(users.email, "same-pwd-user@example.com"));

      const loginRes = await request(getHttpServer()).post("/auth/login").send({
        email: "same-pwd-user@example.com",
        password: "SamePassword123!",
      });
      const accessToken = (loginRes.body as unknown as AuthResponse).data
        .accessToken;

      const changePwdRes = await request(getHttpServer())
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: "SamePassword123!",
          newPassword: "SamePassword123!",
        });
      expect(changePwdRes.status).toBe(400);
    }, 15000);

    it("should reject OAuth users without passwordHash from changing password", async () => {
      const [oauthUser] = await db
        .insert(users)
        .values({
          email: "oauth-only-user@example.com",
          fullName: "OAuth Only User",
          googleId: "google-oauth-12345",
          passwordHash: null,
          status: "active",
          role: "user",
        })
        .returning({
          id: users.id,
          email: users.email,
          role: users.role,
        });
      if (!oauthUser) throw new Error("OAuth user not created");
      // Sign JWT token directly for testing OAuth user session
      const jwtService = app.get(JwtService);
      const accessToken = await jwtService.signAsync({
        sub: oauthUser.id,
        email: oauthUser.email,
        role: oauthUser.role,
      });

      const changePwdRes = await request(getHttpServer())
        .post("/auth/change-password")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          currentPassword: "SomeDummyPassword123!",
          newPassword: "NewSecurePassword456!",
        });
      expect(changePwdRes.status).toBe(400);
    });
  });

  describe("POST /auth/logout-all", () => {
    it("should successfully revoke all refresh tokens for the user", async () => {
      await request(getHttpServer()).post("/auth/register").send({
        email: "logout-all-user@example.com",
        fullName: "Logout All User",
        phoneNumber: "0912345681",
        password: "LogoutPassword123!",
        confirmPassword: "LogoutPassword123!",
        agreeTerms: true,
      });

      await db
        .update(users)
        .set({ status: "active" })
        .where(eq(users.email, "logout-all-user@example.com"));

      const loginRes1 = await request(getHttpServer())
        .post("/auth/login")
        .send({
          email: "logout-all-user@example.com",
          password: "LogoutPassword123!",
        });
      const authData1 = (loginRes1.body as unknown as AuthResponse).data;

      const loginRes2 = await request(getHttpServer())
        .post("/auth/login")
        .send({
          email: "logout-all-user@example.com",
          password: "LogoutPassword123!",
        });
      const authData2 = (loginRes2.body as unknown as AuthResponse).data;

      const logoutAllRes = await request(getHttpServer())
        .post("/auth/logout-all")
        .set("Authorization", `Bearer ${authData1.accessToken}`);
      expect(logoutAllRes.status).toBe(200);

      const refreshRes1 = await request(getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: authData1.refreshToken });
      expect(refreshRes1.status).toBe(401);

      const refreshRes2 = await request(getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: authData2.refreshToken });
      expect(refreshRes2.status).toBe(401);
    }, 15000);

    it("should reject logout-all request without Authorization token", async () => {
      const res = await request(getHttpServer()).post("/auth/logout-all");
      expect(res.status).toBe(401);
    });
  });
});
