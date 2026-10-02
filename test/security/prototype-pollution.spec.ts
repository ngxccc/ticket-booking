import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import {
  createTestApp,
  teardownTestApp,
  type TestAppSetup,
} from "../helpers/app.helper";

describe("Security Penetration - Prototype Pollution Defense", () => {
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
    describe("when payload attempts prototype modification", () => {
      it("should preserve Object.prototype integrity when __proto__ is injected via JSON body", async () => {
        const rawJsonPayload =
          '{"email":"pollution@example.com","fullName":"Polluter","phoneNumber":"0912345678","password":"Password123!","confirmPassword":"Password123!","agreeTerms":true,"__proto__":{"isAdmin":true,"polluted":true}}';

        const res = await request(getHttpServer())
          .post("/api/v1/auth/register")
          .set("Content-Type", "application/json")
          .send(rawJsonPayload);

        // Global prototype must remain completely untainted across the runtime process.
        const testObj: Record<string, unknown> = {};
        expect(testObj["polluted"]).toBeUndefined();
        expect(testObj["isAdmin"]).toBeUndefined();
        expect(
          (Object.prototype as Record<string, unknown>)["polluted"],
        ).toBeUndefined();

        // Express body-parser and strict DTO validation must reject prototype injection.
        expect(res.status).toBe(400);
      });

      it("should preserve Object.prototype integrity when constructor.prototype is injected via JSON body", async () => {
        const pollutionPayload = {
          email: "pollution-constructor@example.com",
          fullName: "Constructor Polluter",
          phoneNumber: "0912345678",
          password: "Password123!",
          confirmPassword: "Password123!",
          agreeTerms: true,
          constructor: {
            prototype: {
              pollutedConstructor: true,
            },
          },
        };

        const res = await request(getHttpServer())
          .post("/api/v1/auth/register")
          .send(pollutionPayload);

        // Constructor prototype pollution vector must not alter plain object inheritance.
        const testObj: Record<string, unknown> = {};
        expect(testObj["pollutedConstructor"]).toBeUndefined();
        expect(
          (Object.prototype as Record<string, unknown>)["pollutedConstructor"],
        ).toBeUndefined();

        expect(res.status).toBe(400);
      });
    });
  });
});
