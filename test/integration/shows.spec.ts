import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import { JwtService } from "@nestjs/jwt";
import { eq, inArray } from "drizzle-orm";
import { isPostgresErrorCode } from "@/common/utils/error.util";
import { PG_ERROR_CODE } from "@/common/constants/error.constant";
import { createTestApp } from "../helpers/app.helper";
import { runMigrations, truncateAllTables } from "../helpers/database.helper";
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
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await runMigrations(db);
    jwtService = app.get(JwtService);

    await truncateAllTables(db);

    const adminSession = await createAuthenticatedAdmin(db, jwtService);
    adminToken = adminSession.token;

    const userSession = await createAuthenticatedUser(db, jwtService);
    userToken = userSession.token;

    // Seed Movie (120 mins duration) via MovieMother
    const movie = await MovieMother.standard(db);
    const cinema = await createCinema(db, {
      name: "CGV Landmark",
      address: "720A Dien Bien Phu",
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

    // Seed Seat Type
    const seatType = await createSeatType(db, {
      name: `standard-${Date.now().toString()}-${Math.random().toString().slice(2, 6)}`,
      priceMultiplier: "1.00",
    });

    seededMovieId = movie.id;
    seededCinemaId = cinema.id;
    seededHallId = hall1.id;
    seededHall2Id = hall2.id;

    // Seed Physical Seats in Hall 1 & Hall 2
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

      // TEST CASE 1: Insert Show 1 into Hall 1 (Valid)
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

      // TEST CASE 2: Attempt to Insert Show 2 (Overlapping in Hall 1: 11:00 to 13:00) -> MUST FAIL
      await expectConflict(() =>
        db.insert(shows).values({
          movieId: seededMovieId,
          hallId: seededHallId,
          startTime: T.s11_00,
          endTime: T.s13_00,
          basePrice: 100000,
        }),
      );

      // TEST CASE 3: Attempt to Insert Show 3 (Violating 15m cleaning buffer: 12:10 to 14:10) -> MUST FAIL
      await expectConflict(() =>
        db.insert(shows).values({
          movieId: seededMovieId,
          hallId: seededHallId,
          startTime: T.s12_10,
          endTime: T.s14_10,
          basePrice: 100000,
        }),
      );

      // TEST CASE 4: Insert Show 4 in Hall 1 AFTER 15m Buffer (12:15 to 14:15) -> MUST SUCCEED
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

      // 5. Insert Show 5 in Hall 2 (Same time as Show 1, but DIFFERENT hall) -> MUST SUCCEED
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

      // Verify derived endTime = startTime (10:00) + 120 mins duration = 12:00
      expect(body.data.startTime).toBe("2026-09-02T10:00:00.000Z");
      expect(body.data.endTime).toBe("2026-09-02T12:00:00.000Z");

      // Verify show in database (YAGNI selective querying)
      const dbShows = await db
        .select({ id: shows.id })
        .from(shows)
        .where(eq(shows.id, createdShowId));
      expect(dbShows).toHaveLength(1);

      // Verify pre-allocated show_seats in database (YAGNI selective querying)
      const dbShowSeats = await db
        .select({ id: showSeats.id, status: showSeats.status })
        .from(showSeats)
        .where(eq(showSeats.showId, createdShowId));
      expect(dbShowSeats).toHaveLength(SEAT_COUNT);
      expect(dbShowSeats.every((s) => s.status === "available")).toBe(true);
    });

    it("should reject schedule collision (409 Conflict) when showtime overlaps existing show with 15m cleaning buffer", async () => {
      // First Show: 10:00 -> 12:00 (+ 15m cleaning buffer = occupied until 12:15)
      await request(getHttpServer())
        .post("/shows")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          movieId: seededMovieId,
          hallId: seededHallId,
          startTime: "2026-09-03T10:00:00.000Z",
          basePrice: 100000,
        });

      // Second Show overlapping: 11:00 -> 13:00 -> MUST BE REJECTED (409)
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

      // Third Show violating 15m cleaning buffer: 12:10 -> 14:10 -> MUST BE REJECTED (409)
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
      const pastStartTime = new Date(Date.now() - 60 * 1000).toISOString();
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
      // Show 1: 10:00 -> 12:00 (Buffer expires at exactly 12:15:00.000Z)
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

      // Show 2 starting at EXACTLY 12:15:00.000Z -> MUST SUCCEED (201 Created)
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

  describe("POST /shows/batch", () => {
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
          endDate: "2026-11-05", // 35 days
          timeSlots: ["10:00"],
          basePrice: 100000,
        });

      expect(res.status).toBe(400);
    });

    it("should reject with 400 Bad Request when total shows exceed 100 limit", async () => {
      // 25 days * 5 slots = 125 shows (> 100 limit)
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
      // Movie duration = 120m + 15m buffer = 135m -> 10:00 ends at 12:15. Slot 11:30 overlaps!
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

    it("should successfully create batch showtimes across date range with pre-allocated seats (201 Created)", async () => {
      // 2 days * 2 slots = 4 shows
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

      // Verify shows in DB
      const dbShows = await db
        .select({
          id: shows.id,
          hallId: shows.hallId,
          basePrice: shows.basePrice,
        })
        .from(shows)
        .where(inArray(shows.id, body.data.showIds));
      expect(dbShows).toHaveLength(4);

      // Verify show_seats pre-allocated (4 shows * 5 seats = 20 show_seats)
      const dbShowSeats = await db
        .select({ id: showSeats.id, status: showSeats.status })
        .from(showSeats)
        .where(inArray(showSeats.showId, body.data.showIds));
      expect(dbShowSeats).toHaveLength(4 * SEAT_COUNT);
      expect(dbShowSeats.every((s) => s.status === "available")).toBe(true);
    });

    it("should reject entire batch and rollback cleanly when one slot collides with existing DB schedule (409 Conflict)", async () => {
      // Seed an existing show in DB on 2026-10-03 at 10:00 -> 12:00
      await request(getHttpServer())
        .post("/shows")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          movieId: seededMovieId,
          hallId: seededHall2Id,
          startTime: "2026-10-03T10:00:00+07:00",
          basePrice: 100000,
        });

      // Attempt to batch create across 2026-10-02 to 2026-10-04 at 10:00 and 15:00
      // 2026-10-03 at 10:00 will collide with existing show!
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

      // Verify that ONLY the initial 1 seed show exists for Hall 2, zero batch shows were persisted
      const hall2Shows = await db
        .select({ id: shows.id })
        .from(shows)
        .where(eq(shows.hallId, seededHall2Id));
      expect(hall2Shows).toHaveLength(1);
    });
  });

  afterAll(async () => {
    await truncateAllTables(db);
    await app.close();
  });
});
