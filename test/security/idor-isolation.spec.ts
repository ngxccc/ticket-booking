import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import { JwtService } from "@nestjs/jwt";
import {
  createTestApp,
  teardownTestApp,
  type TestAppSetup,
} from "../helpers/app.helper";
import type { components } from "../generated/api-schema";
import { createAuthenticatedUser } from "../helpers/auth.helper";
import { TIME_IN_MS } from "@/common/constants/time.constant";

type UserProfileData = components["schemas"]["UserResponseDto"];
type GetProfileResponse = components["schemas"]["ApiResponseDto"] & {
  data: UserProfileData;
};

describe("Security Penetration - IDOR & Authorization Defense", () => {
  let setup: TestAppSetup;
  let app: INestApplication;
  let jwtService: JwtService;

  const getHttpServer = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    jwtService = app.get(JwtService);
  }, 30000);

  afterAll(async () => {
    await teardownTestApp(setup);
  });

  describe("GET /users/me", () => {
    describe("when client attempts identity spoofing", () => {
      it("should return caller profile and ignore spoofed headers when authenticated", async () => {
        const userA = await createAuthenticatedUser(setup.db, jwtService, {
          role: "user",
          email: "user-a@example.com",
          fullName: "User A",
        });
        const userB = await createAuthenticatedUser(setup.db, jwtService, {
          role: "user",
          email: "user-b@example.com",
          fullName: "User B",
        });

        // Identity must be strictly resolved from verified JWT claims, ignoring spoofed client headers.
        const res = await request(getHttpServer())
          .get("/api/v1/users/me")
          .set(userA.authHeader)
          .set("X-User-Id", userB.user.id)
          .set("X-Forwarded-User", userB.user.id);

        expect(res.status).toBe(200);
        const resBody = res.body as GetProfileResponse;
        expect(resBody.data.id).toBe(userA.user.id);
        expect(resBody.data.id).not.toBe(userB.user.id);
        expect(resBody.data.email).toBe("user-a@example.com");
      });
    });

    describe("when request lacks valid authentication", () => {
      it("should return 401 Unauthorized when token is missing or forged", async () => {
        const noAuthRes =
          await request(getHttpServer()).get("/api/v1/users/me");
        expect(noAuthRes.status).toBe(401);

        const forgedRes = await request(getHttpServer())
          .get("/api/v1/users/me")
          .set("Authorization", "Bearer forged.invalid.token");
        expect(forgedRes.status).toBe(401);
      });
    });
  });

  describe("POST /shows", () => {
    describe("when regular customer attempts administrative operations", () => {
      it("should return 403 Forbidden when caller lacks admin role", async () => {
        const regularUser = await createAuthenticatedUser(
          setup.db,
          jwtService,
          {
            role: "user",
            email: "regular-customer@example.com",
          },
        );

        // Broken Function Level Authorization (BFLA) guard ensures non-admin cannot provision catalog entities.
        const res = await request(getHttpServer())
          .post("/api/v1/shows")
          .set(regularUser.authHeader)
          .send({
            movieId: "019fa8bc-8f4d-7000-b366-e691f45cfb01",
            hallId: "019fa8bc-8f4d-7000-b366-e691f45cfb02",
            startTime: new Date(Date.now() + TIME_IN_MS.DAY).toISOString(),
            basePrice: 100000,
          });

        expect(res.status).toBe(403);
      });
    });
  });
});
