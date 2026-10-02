import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import {
  createTestApp,
  teardownTestApp,
  type TestAppSetup,
} from "../helpers/app.helper";
import type { components } from "../generated/api-schema";

type Rfc9457ErrorResponse = components["schemas"]["Rfc9457ErrorResponseDto"];

describe("Security Penetration - Mass Assignment Defense", () => {
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
    describe("when validating request against unrecognized properties", () => {
      it("should return 400 Bad Request when attacker injects 'role: admin'", async () => {
        const maliciousPayload = {
          email: "hacker-priv-esc@example.com",
          fullName: "Hacker Admin",
          phoneNumber: "0912345678",
          password: "Password123!",
          confirmPassword: "Password123!",
          agreeTerms: true,
          // Strict DTO schema must reject unauthorized privilege escalation fields.
          role: "admin",
        };

        const res = await request(getHttpServer())
          .post("/api/v1/auth/register")
          .send(maliciousPayload);

        expect(res.status).toBe(400);
        const resBody = res.body as Rfc9457ErrorResponse;
        expect(resBody.invalidParams).toBeArray();
        expect(resBody.invalidParams?.some((p) => p.name === "role")).toBe(
          true,
        );
      });

      it("should return 400 Bad Request when attacker injects account status fields", async () => {
        const maliciousPayload = {
          email: "hacker-status-tamper@example.com",
          fullName: "Hacker User",
          phoneNumber: "0912345678",
          password: "Password123!",
          confirmPassword: "Password123!",
          agreeTerms: true,
          // Prohibits client-side state manipulation to prevent pre-activating unverified accounts.
          status: "active",
          isVerified: true,
        };

        const res = await request(getHttpServer())
          .post("/api/v1/auth/register")
          .send(maliciousPayload);

        expect(res.status).toBe(400);
        const resBody = res.body as Rfc9457ErrorResponse;
        expect(resBody.invalidParams).toBeArray();
        expect(
          resBody.invalidParams?.some(
            (p) => p.name === "status" || p.name === "isVerified",
          ),
        ).toBe(true);
      });
    });
  });

  describe("POST /auth/login", () => {
    describe("when validating credentials envelope against unrecognized properties", () => {
      it("should return 400 Bad Request when attacker injects unexpected payload fields", async () => {
        const maliciousPayload = {
          email: "test@example.com",
          password: "Password123!",
          // Rejects extra attributes injected into login credentials envelope.
          isAdmin: true,
        };

        const res = await request(getHttpServer())
          .post("/api/v1/auth/login")
          .send(maliciousPayload);

        expect(res.status).toBe(400);
        const resBody = res.body as Rfc9457ErrorResponse;
        expect(resBody.invalidParams).toBeArray();
        expect(resBody.invalidParams?.some((p) => p.name === "isAdmin")).toBe(
          true,
        );
      });
    });
  });
});
