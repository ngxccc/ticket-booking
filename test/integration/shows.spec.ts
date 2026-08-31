import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { v7 as uuidv7 } from "uuid";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import { JwtService } from "@nestjs/jwt";
import { eq, inArray } from "drizzle-orm";
import { isPostgresErrorCode } from "@/common/utils/error.util";
import { PG_ERROR_CODE } from "@/common/constants/error.constant";
import { TIME_IN_MS } from "@/common/constants/time.constant";
import {
  createTestApp,
  teardownTestApp,
  type TestAppSetup,
} from "../helpers/app.helper";
import { truncateAllTables } from "@/database/database.connection";
import {
  createAuthenticatedAdmin,
  createAuthenticatedUser,
} from "../helpers/auth.helper";
import type { DrizzleDB } from "@/database/database.module";
import { shows, showSeats } from "@/database/schemas";
import {
  createCinema,
  createHall,
  createSeatType,
  createBatchSeats,
} from "../factories";
import { MovieMother } from "../mothers";
import type { components } from "../generated/api-schema";
import type {
  ShowResponseDto,
  BatchShowResponseDto,
} from "@/modules/shows/dto";

type SingleShowApiResponse = components["schemas"]["ApiResponseDto"] & {
  data: ShowResponseDto;
};

type BatchShowApiResponse = components["schemas"]["ApiResponseDto"] & {
  data: BatchShowResponseDto;
};

describe("Shows Module Integration", () => {
  let setup: TestAppSetup;
  let app: INestApplication;
  let db: DrizzleDB;
  const getHttpServer = (): Server => app.getHttpServer() as Server;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;

  let seededMovieId: string;
  let seededCinemaId: string;
  let seededHallId: string;
  let seededHall2Id: string;
  const SEAT_COUNT = 5;

  beforeAll(async () => {
    setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    jwtService = app.get(JwtService);

    await truncateAllTables(db, setup.workerSchema);
    const adminSession = await createAuthenticatedAdmin(db, jwtService);
    adminToken = adminSession.token;

    const userSession = await createAuthenticatedUser(db, jwtService);
    userToken = userSession.token;

    const movie = await MovieMother.standard(db);
    const cinema = await createCinema(db, {
      name: "CGV Landmark",
      streetAddress: "720A Dien Bien Phu",
    });

    const hall1 = await createHall(db, {
      cinemaId: cinema.id,
      name: "Hall Premium 1",
      totalSeats: SEAT_COUNT,
    });

    const hall2 = await createHall(db, {
      cinemaId: cinema.id,
      name: "Hall Premium 2",
      totalSeats: 100,
    });

    const seatType = await createSeatType(db, {
      name: `standard-${uuidv7()}`,
      priceMultiplier: "1.00",
    });

    seededMovieId = movie.id;
    seededCinemaId = cinema.id;
    seededHallId = hall1.id;
    seededHall2Id = hall2.id;

    await createBatchSeats(db, hall1.id, seatType.id, SEAT_COUNT);
    await createBatchSeats(db, hall2.id, seatType.id, SEAT_COUNT);
  }, 30000);

  beforeEach(async () => {
    await db.delete(showSeats);
    await db.delete(shows);
  });

  describe("Database Invariants: PostgreSQL Exclusion Constraint", () => {
    it("should prevent overlapping showtimes and buffer violations in the same hall via DB exclusion constraint", async () => {
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

      async function expectConflict(fn: () => Promise<unknown>) {
        let error: unknown = null;
        try {
          await fn();
        } catch (err) {
          error = err;
        }
        expect(
          isPostgresErrorCode(error, PG_ERROR_CODE.EXCLUSION_VIOLATION),
        ).toBe(true);
      }

      const [show1] = await db
        .insert(shows)
        .values({
          movieId: seededMovieId,
          hallId: seededHallId,
          startTime: T.s10_00,
          endTime: T.s12_00,
          basePrice: 100000,
        })
        .returning({ id: shows.id });
      expect(show1).toBeDefined();

      await expectConflict(() =>
        db.insert(shows).values({
          movieId: seededMovieId,
          hallId: seededHallId,
          startTime: T.s11_00,
          endTime: T.s13_00,
          basePrice: 100000,
        }),
      );

      await expectConflict(() =>
        db.insert(shows).values({
          movieId: seededMovieId,
          hallId: seededHallId,
          startTime: T.s12_10,
          endTime: T.s14_10,
          basePrice: 100000,
        }),
      );

      const [show4] = await db
        .insert(shows)
        .values({
          movieId: seededMovieId,
          hallId: seededHallId,
          startTime: T.s12_15,
          endTime: T.s14_15,
          basePrice: 100000,
        })
        .returning({ id: shows.id });
      expect(show4).toBeDefined();

      const [show5] = await db
        .insert(shows)
        .values({
          movieId: seededMovieId,
          hallId: seededHall2Id,
          startTime: T.s10_00,
          endTime: T.s12_00,
          basePrice: 100000,
        })
        .returning({ id: shows.id });
      expect(show5).toBeDefined();
    });
  });

  describe("POST /shows", () => {
    describe("when creating show with valid parameters", () => {
      it("should create a show and bulk pre-allocate available seats (201 Created) when input is valid", async () => {
        const startTime = "2026-09-02T10:00:00.000Z";
        const basePrice = 100000;

        const res = await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startTime,
            basePrice,
          });

        expect(res.status).toBe(201);
        const body = res.body as SingleShowApiResponse;
        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();

        const createdShowId = body.data.id;
        expect(body.data.movieId).toBe(seededMovieId);
        expect(body.data.hallId).toBe(seededHallId);
        expect(body.data.basePrice).toBe(basePrice);
        expect(body.data.totalSeats).toBe(SEAT_COUNT);

        expect(body.data.startTime).toBe("2026-09-02T10:00:00.000Z");
        expect(body.data.endTime).toBe("2026-09-02T12:00:00.000Z");

        const dbShows = await db
          .select({ id: shows.id })
          .from(shows)
          .where(eq(shows.id, createdShowId));
        expect(dbShows).toHaveLength(1);

        const dbShowSeats = await db
          .select({ id: showSeats.id, status: showSeats.status })
          .from(showSeats)
          .where(eq(showSeats.showId, createdShowId));
        expect(dbShowSeats).toHaveLength(SEAT_COUNT);
        expect(dbShowSeats.every((s) => s.status === "available")).toBe(true);
      });
    });

    describe("when validating schedule collisions", () => {
      it("should reject schedule collision (409 Conflict) when showtime overlaps existing show with 15m cleaning buffer", async () => {
        await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startTime: "2026-09-03T10:00:00.000Z",
            basePrice: 100000,
          });

        const resOverlap = await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startTime: "2026-09-03T11:00:00.000Z",
            basePrice: 100000,
          });
        expect(resOverlap.status).toBe(409);

        const resBuffer = await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startTime: "2026-09-03T12:10:00.000Z",
            basePrice: 100000,
          });
        expect(resBuffer.status).toBe(409);
      });
    });

    describe("when checking authorization", () => {
      it("should reject with 403 Forbidden when called by a non-admin user", async () => {
        const res = await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${userToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startTime: "2026-09-04T10:00:00.000Z",
            basePrice: 100000,
          });

        expect(res.status).toBe(403);
      });

      it("should reject with 401 Unauthorized when no auth token is provided", async () => {
        const res = await request(getHttpServer()).post("/shows").send({
          movieId: seededMovieId,
          hallId: seededHallId,
          startTime: "2026-09-05T10:00:00.000Z",
          basePrice: 100000,
        });

        expect(res.status).toBe(401);
      });
    });

    describe("when validating request payload and constraints", () => {
      it("should reject with 404 Not Found when movieId does not exist", async () => {
        const nonExistentMovieId = "019fa8bc-8f4d-7000-b366-e691f45cfb99";
        const res = await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: nonExistentMovieId,
            hallId: seededHallId,
            startTime: "2026-09-06T10:00:00.000Z",
            basePrice: 100000,
          });

        expect(res.status).toBe(404);
      });

      it("should reject with 400 Bad Request when request body is invalid", async () => {
        const res = await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: "invalid-uuid",
            hallId: seededHallId,
            startTime: "invalid-date",
            basePrice: -50000,
          });

        expect(res.status).toBe(400);
      });

      it("should reject with 400 Bad Request when startTime is in the past or < 10m from now (INV-2)", async () => {
        const pastStartTime = new Date(
          Date.now() - TIME_IN_MS.MINUTE,
        ).toISOString();
        const res = await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startTime: pastStartTime,
            basePrice: 100000,
          });

        expect(res.status).toBe(400);
      });

      it("should reject with 404 Not Found when hallId does not exist", async () => {
        const nonExistentHallId = "019fa8bc-8f4d-7000-b366-e691f45cfb88";
        const res = await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: nonExistentHallId,
            startTime: "2026-09-08T10:00:00.000Z",
            basePrice: 100000,
          });

        expect(res.status).toBe(404);
      });

      it("should reject with 400 Bad Request when target hall has zero physical seats configured (INV-3)", async () => {
        const emptyHall = await createHall(db, {
          cinemaId: seededCinemaId,
          name: "Empty Hall Zero Seats",
          totalSeats: 0,
        });

        const res = await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: emptyHall.id,
            startTime: "2026-09-09T15:00:00.000Z",
            basePrice: 100000,
          });

        expect(res.status).toBe(400);
      });

      it("should allow show creation at the exact 15-minute buffer boundary (ADV-1: 201 Created)", async () => {
        const res1 = await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startTime: "2026-09-10T10:00:00.000Z",
            basePrice: 100000,
          });
        expect(res1.status).toBe(201);

        const resExact = await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startTime: "2026-09-10T12:15:00.000Z",
            basePrice: 100000,
          });
        expect(resExact.status).toBe(201);
      });
    });
  });

  describe("POST /shows/batch", () => {
    describe("when checking authorization", () => {
      it("should reject with 401 Unauthorized when no token is provided", async () => {
        const res = await request(getHttpServer())
          .post("/shows/batch")
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startDate: "2026-10-01",
            endDate: "2026-10-02",
            timeSlots: ["10:00", "14:00"],
            basePrice: 100000,
          });

        expect(res.status).toBe(401);
      });

      it("should reject with 403 Forbidden when accessed by standard user", async () => {
        const res = await request(getHttpServer())
          .post("/shows/batch")
          .set("Authorization", `Bearer ${userToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startDate: "2026-10-01",
            endDate: "2026-10-02",
            timeSlots: ["10:00", "14:00"],
            basePrice: 100000,
          });

        expect(res.status).toBe(403);
      });
    });

    describe("when validating batch parameters and limits", () => {
      it("should reject with 400 Bad Request when startDate > endDate", async () => {
        const res = await request(getHttpServer())
          .post("/shows/batch")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startDate: "2026-10-05",
            endDate: "2026-10-01",
            timeSlots: ["10:00", "14:00"],
            basePrice: 100000,
          });

        expect(res.status).toBe(400);
      });

      it("should reject with 400 Bad Request when date range exceeds 30 days", async () => {
        const res = await request(getHttpServer())
          .post("/shows/batch")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startDate: "2026-10-01",
            endDate: "2026-11-05",
            timeSlots: ["10:00"],
            basePrice: 100000,
          });

        expect(res.status).toBe(400);
      });

      it("should reject with 400 Bad Request when total shows exceed 100 limit", async () => {
        const res = await request(getHttpServer())
          .post("/shows/batch")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startDate: "2026-10-01",
            endDate: "2026-10-25",
            timeSlots: ["08:00", "11:00", "14:00", "17:00", "20:00"],
            basePrice: 100000,
          });

        expect(res.status).toBe(400);
      });

      it("should reject with 400 Bad Request when time slots collide internally (intra-batch collision)", async () => {
        const res = await request(getHttpServer())
          .post("/shows/batch")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startDate: "2026-10-01",
            endDate: "2026-10-01",
            timeSlots: ["10:00", "11:30"],
            basePrice: 100000,
          });

        expect(res.status).toBe(400);
      });
    });

    describe("when executing batch creation transaction", () => {
      it("should successfully create batch showtimes across date range with pre-allocated seats (201 Created)", async () => {
        const res = await request(getHttpServer())
          .post("/shows/batch")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHallId,
            startDate: "2026-10-01",
            endDate: "2026-10-02",
            timeSlots: ["10:00", "15:00"],
            basePrice: 120000,
          });

        expect(res.status).toBe(201);
        const body = res.body as BatchShowApiResponse;
        expect(body.success).toBe(true);
        expect(body.data.createdCount).toBe(4);
        expect(body.data.showIds).toHaveLength(4);

        const dbShows = await db
          .select({
            id: shows.id,
            hallId: shows.hallId,
            basePrice: shows.basePrice,
          })
          .from(shows)
          .where(inArray(shows.id, body.data.showIds));
        expect(dbShows).toHaveLength(4);

        const dbShowSeats = await db
          .select({ id: showSeats.id, status: showSeats.status })
          .from(showSeats)
          .where(inArray(showSeats.showId, body.data.showIds));
        expect(dbShowSeats).toHaveLength(4 * SEAT_COUNT);
        expect(dbShowSeats.every((s) => s.status === "available")).toBe(true);
      });
      it("should reject entire batch and rollback cleanly when one slot collides with existing DB schedule (409 Conflict)", async () => {
        await request(getHttpServer())
          .post("/shows")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHall2Id,
            startTime: "2026-10-03T10:00:00+07:00",
            basePrice: 100000,
          });

        const res = await request(getHttpServer())
          .post("/shows/batch")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            movieId: seededMovieId,
            hallId: seededHall2Id,
            startDate: "2026-10-02",
            endDate: "2026-10-04",
            timeSlots: ["10:00", "15:00"],
            basePrice: 100000,
          });

        expect(res.status).toBe(409);

        const hall2Shows = await db
          .select({ id: shows.id })
          .from(shows)
          .where(eq(shows.hallId, seededHall2Id));
        expect(hall2Shows).toHaveLength(1);
      });
    });
  });

  afterAll(async () => {
    await teardownTestApp(setup);
  });
});
