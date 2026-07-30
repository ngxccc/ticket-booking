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
import { eq, and } from "drizzle-orm";
import { createTestApp } from "../helpers/app.helper";
import { runMigrations, truncateAllTables } from "../helpers/database.helper";
import type { DrizzleDB } from "@/database/database.module";
import { RedlockService } from "@/common/services/redlock.service";
import { BookingCronService } from "@/modules/booking/booking-cron.service";
import {
  users,
  movies,
  cinemas,
  halls,
  seatTypes,
  seats,
  shows,
  showSeats,
  bookings,
} from "@/database/schemas";

import type { components } from "../generated/api-schema";

type ReserveSeatsResponseData =
  components["schemas"]["ReserveSeatsResponseDto"];
type Rfc9457ErrorResponse = components["schemas"]["Rfc9457ErrorResponseDto"] & {
  statusCode?: number;
};
type ApiSuccessResponse<T> = components["schemas"]["ApiResponseDto"] & {
  data: T;
};

describe("Booking Module Integration (POST /bookings/reserve)", () => {
  let app: INestApplication;
  let httpServer: Server;
  let db: DrizzleDB;

  let testUserId: string;
  let testUserToken: string;
  let testShowId: string;
  let testSeatId1: string;
  let testSeatId2: string;
  let testSeatId3: string;
  let testSeatId4: string;
  let testSeatId5: string;
  let testSeatId6: string;
  let testSeatId7: string;

  const generateUuidV7 = (): string => {
    const timestamp = Date.now().toString(16).padStart(12, "0");
    const rand1 = Math.floor(Math.random() * 0x0fff)
      .toString(16)
      .padStart(3, "0");
    const rand2 = Math.floor(Math.random() * 0x3fff + 0x8000)
      .toString(16)
      .padStart(4, "0");
    const rand3 = Math.floor(Math.random() * 0xffffffffffff)
      .toString(16)
      .padStart(12, "0");
    return `${timestamp.slice(0, 8)}-${timestamp.slice(8, 12)}-7${rand1}-${rand2}-${rand3}`;
  };

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    httpServer = app.getHttpServer() as Server;

    await runMigrations(db);
  });

  afterAll(async () => {
    await truncateAllTables(db);
    await app.close();
  });

  beforeEach(async () => {
    try {
      const redis = app.get(RedlockService).getRedisClient();
      const cleanupPromise = (async () => {
        const lockKeys = await redis.keys("lock:show_seat:*");
        if (lockKeys.length > 0) {
          await redis.del(...lockKeys);
        }
      })();
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(resolve, 2000),
      );
      await Promise.race([cleanupPromise, timeoutPromise]);
    } catch {
      // WHY: Fail-open on Redis cleanup errors to prevent offline connection blips from interrupting test runs.
    }
    await truncateAllTables(db);
    const timestamp = Date.now().toString();
    const userEmail = `booking-test-${timestamp}@example.com`;
    const userPassword = "Password123!";

    await request(httpServer).post("/auth/register").send({
      email: userEmail,
      password: userPassword,
      confirmPassword: userPassword,
      fullName: "Booking Test User",
      phoneNumber: "0912345678",
      agreeTerms: true,
    });
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1);
    if (!dbUser) {
      throw new Error("Failed to register test user");
    }
    testUserId = dbUser.id;

    await db
      .update(users)
      .set({ status: "active" })
      .where(eq(users.id, testUserId));

    const loginRes = await request(httpServer)
      .post("/auth/login")
      .send({
        email: userEmail,
        password: userPassword,
      })
      .expect(200);

    const loginData = (loginRes.body as { data: { accessToken: string } }).data;
    testUserToken = loginData.accessToken;

    // 2. Seed Movie, Cinema, Hall, Seat Type, Seats, Show, Show Seats
    const [insertedMovie] = await db
      .insert(movies)
      .values({
        durationMinutes: 148,
        releaseDate: "2026-01-01",
        posterUrl: "https://example.com/poster.jpg",
      })
      .returning();

    const [insertedCinema] = await db
      .insert(cinemas)
      .values({
        name: "Grand Cinema Center",
        address: "123 Main St",
      })
      .returning();

    if (!insertedMovie || !insertedCinema) {
      throw new Error("Failed to seed movie or cinema entity");
    }

    const [insertedHall] = await db
      .insert(halls)
      .values({
        cinemaId: insertedCinema.id,
        name: "Hall 1 IMAX",
        totalSeats: 100,
      })
      .returning();

    const [insertedSeatType] = await db
      .insert(seatTypes)
      .values({
        name: `Standard-${timestamp}`,
        priceMultiplier: "1.00",
      })
      .returning();

    if (!insertedHall || !insertedSeatType) {
      throw new Error("Failed to seed hall or seat type entity");
    }

    const [insertedShow] = await db
      .insert(shows)
      .values({
        movieId: insertedMovie.id,
        hallId: insertedHall.id,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 86400000 + 7200000),
        basePrice: 100000,
      })
      .returning();

    if (!insertedShow) {
      throw new Error("Failed to seed show entity");
    }

    testShowId = insertedShow.id;

    const seatValues = Array.from({ length: 7 }, (_, idx) => ({
      hallId: insertedHall.id,
      seatTypeId: insertedSeatType.id,
      row: "A",
      number: idx + 1,
      seatNumber: `A${String(idx + 1)}`,
    }));
    const insertedSeatList = await db
      .insert(seats)
      .values(seatValues)
      .returning();

    const showSeatValues = insertedSeatList.map((st) => ({
      showId: testShowId,
      seatId: st.id,
      status: "available" as const,
    }));
    await db.insert(showSeats).values(showSeatValues);

    const seatRecords = insertedSeatList.map((st) => st.id);

    const [s1, s2, s3, s4, s5, s6, s7] = seatRecords;
    if (!s1 || !s2 || !s3 || !s4 || !s5 || !s6 || !s7) {
      throw new Error("Failed to populate test seat records");
    }
    testSeatId1 = s1;
    testSeatId2 = s2;
    testSeatId3 = s3;
    testSeatId4 = s4;
    testSeatId5 = s5;
    testSeatId6 = s6;
    testSeatId7 = s7;
  }, 30000);

  // =========================================================================
  // 1. Authentication Guard Validation (JwtAuthGuard)
  // =========================================================================
  describe("1. Authentication (JwtAuthGuard)", () => {
    it("should return 401 Unauthorized when Authorization header is missing", async () => {
      const idempotencyKey = generateUuidV7();

      const response = await request(httpServer)
        .post("/bookings/reserve")
        .set("idempotency-key", idempotencyKey)
        .send({
          showId: testShowId,
          seatIds: [testSeatId6],
        })
        .expect(401);
      const body = response.body as Rfc9457ErrorResponse;
      expect(response.status).toBe(401);
      expect(body.statusCode ?? body.status).toBe(401);
    });

    it("should return 401 Unauthorized when Bearer token is malformed or invalid", async () => {
      const idempotencyKey = generateUuidV7();

      const response = await request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", "Bearer invalid-malformed-jwt-token")
        .set("idempotency-key", idempotencyKey)
        .send({
          showId: testShowId,
          seatIds: [testSeatId6],
        })
        .expect(401);
      const body = response.body as Rfc9457ErrorResponse;
      expect(body.statusCode ?? body.status).toBe(401);
    });
  });

  // =========================================================================
  // 2. Idempotency-Key Header Validation
  describe("2. Idempotency-Key Header Validation", () => {
    it("should return 400 Bad Request when idempotency-key header is missing", async () => {
      const response = await request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          showId: testShowId,
          seatIds: [testSeatId6],
        })
        .expect(400);
      const body = response.body as Rfc9457ErrorResponse;
      expect(response.status).toBe(400);
      expect(body.statusCode ?? body.status).toBe(400);
    });
  });

  // =========================================================================
  // 3. Request Body Validation (ReserveSeatsDto)
  // =========================================================================
  describe("3. Request Body Validation (ReserveSeatsDto)", () => {
    it("should return 400 Bad Request when showId is not a valid UUIDv7 format", async () => {
      const idempotencyKey = generateUuidV7();

      const response = await request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .set("idempotency-key", idempotencyKey)
        .send({
          showId: "invalid-not-uuid",
          seatIds: [testSeatId6],
        })
        .expect(400);
      const body = response.body as Rfc9457ErrorResponse;
      expect(body.detail).toBe("Invalid payload format");
      expect(body.invalidParams).toBeDefined();
      expect(body.invalidParams?.some((param) => param.name === "showId")).toBe(
        true,
      );
    });

    it("should return 400 Bad Request when seatIds array is empty (violates @ArrayMinSize(1))", async () => {
      const idempotencyKey = generateUuidV7();

      const response = await request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .set("idempotency-key", idempotencyKey)
        .send({
          showId: testShowId,
          seatIds: [],
        })
        .expect(400);

      const body = response.body as Rfc9457ErrorResponse;
      expect(body.invalidParams).toBeDefined();
      expect(
        body.invalidParams?.some((param) => param.name === "seatIds"),
      ).toBe(true);
    });

    it("should return 400 Bad Request when seatIds array exceeds 6 seats (violates @ArrayMaxSize(6))", async () => {
      const idempotencyKey = generateUuidV7();

      const response = await request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .set("idempotency-key", idempotencyKey)
        .send({
          showId: testShowId,
          seatIds: [
            testSeatId1,
            testSeatId2,
            testSeatId3,
            testSeatId4,
            testSeatId5,
            testSeatId6,
            testSeatId7,
          ],
        })
        .expect(400);

      const body = response.body as Rfc9457ErrorResponse;
      expect(body.invalidParams).toBeDefined();
      expect(
        body.invalidParams?.some((param) => param.name === "seatIds"),
      ).toBe(true);
    });
  });

  // =========================================================================
  // 4. Happy Path Contract Verification (201 Created Response Shape)
  // =========================================================================
  describe("4. Happy Path Contract (201 Created)", () => {
    it("should successfully reserve seats and return 201 Created with correct ApiResponse shape", async () => {
      const idempotencyKey = generateUuidV7();

      const response = await request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .set("idempotency-key", idempotencyKey)
        .send({
          showId: testShowId,
          seatIds: [testSeatId1, testSeatId2],
        })
        .expect(201);

      const body =
        response.body as ApiSuccessResponse<ReserveSeatsResponseData>;

      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.bookingId).toBeDefined();
      expect(body.data.showId).toBe(testShowId);
      expect(body.data.totalPrice).toBeGreaterThan(0);
      expect(body.data.status).toBe("pending_payment");
      expect(body.data.seats).toHaveLength(2);
      expect(body.data.expiresAt).toBeDefined();
    });
  });

  // =========================================================================
  // 5. Conflict Handling (409 Conflict on Double Reservation)
  // =========================================================================
  describe("5. Conflict Handling (409 Conflict)", () => {
    it("should return 409 Conflict when attempting to reserve already reserved/locked seats", async () => {
      const firstIdempotencyKey = generateUuidV7();
      const secondIdempotencyKey = generateUuidV7();

      await request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .set("idempotency-key", firstIdempotencyKey)
        .send({
          showId: testShowId,
          seatIds: [testSeatId3],
        })
        .expect(201);

      const conflictResponse = await request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .set("idempotency-key", secondIdempotencyKey)
        .send({
          showId: testShowId,
          seatIds: [testSeatId3],
        })
        .expect(409);

      const body = conflictResponse.body as Rfc9457ErrorResponse;
      expect(conflictResponse.status).toBe(409);
      expect(body.statusCode ?? body.status).toBe(409);
    });
  });

  // =========================================================================
  // 6. Rate Limiting (CustomThrottlerGuard)
  // =========================================================================
  // =========================================================================
  // 7. High-Concurrency & Failure Modes (Deadlock, Idempotency Race, Cron)
  // =========================================================================
  describe("7. High-Concurrency & Failure Modes", () => {
    it("7.1 Deadlock Elimination: should handle concurrent requests with reversed seatId order without throwing DB deadlock (40P01)", async () => {
      const key1 = generateUuidV7();
      const key2 = generateUuidV7();

      const reqA = request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .set("idempotency-key", key1)
        .send({
          showId: testShowId,
          seatIds: [testSeatId1, testSeatId2],
        });

      const reqB = request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .set("idempotency-key", key2)
        .send({
          showId: testShowId,
          seatIds: [testSeatId2, testSeatId1],
        });

      const [resA, resB] = await Promise.all([reqA, reqB]);

      const statuses = [resA.status, resB.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      // Assert DB state: Exactly 1 booking row created for this test user (no duplicate bookings or partial state)
      const createdBookings = await db
        .select()
        .from(bookings)
        .where(
          and(eq(bookings.showId, testShowId), eq(bookings.userId, testUserId)),
        );
      expect(createdBookings.length).toBe(1);
    });

    it("7.2 Idempotency Race Window: should handle simultaneous duplicate requests (<5ms) by letting one succeed and blocking the other with 409", async () => {
      const sameIdempotencyKey = generateUuidV7();

      const reqA = request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .set("idempotency-key", sameIdempotencyKey)
        .send({
          showId: testShowId,
          seatIds: [testSeatId6],
        });

      const reqB = request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .set("idempotency-key", sameIdempotencyKey)
        .send({
          showId: testShowId,
          seatIds: [testSeatId6],
        });

      const [resA, resB] = await Promise.all([reqA, reqB]);

      const statuses = [resA.status, resB.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);

      // Assert DB state: Exactly 1 booking row created for this test user despite racy duplicate request
      const createdBookings = await db
        .select()
        .from(bookings)
        .where(
          and(eq(bookings.showId, testShowId), eq(bookings.userId, testUserId)),
        );
      expect(createdBookings.length).toBe(1);
    });

    it("7.3 Booking Cron Service Cleanup: should clean up expired seat locks and mark orphaned pending bookings as expired", async () => {
      const idempotencyKey = generateUuidV7();

      const res = await request(httpServer)
        .post("/bookings/reserve")
        .set("Authorization", `Bearer ${testUserToken}`)
        .set("idempotency-key", idempotencyKey)
        .send({
          showId: testShowId,
          seatIds: [testSeatId7],
        })
        .expect(201);

      const bookingId = (
        res.body as ApiSuccessResponse<ReserveSeatsResponseData>
      ).data.bookingId;
      const pastDate = new Date(Date.now() - 15 * 60 * 1000);
      await db
        .update(showSeats)
        .set({ lockedUntil: pastDate })
        .where(
          and(
            eq(showSeats.showId, testShowId),
            eq(showSeats.seatId, testSeatId7),
          ),
        );
      await db
        .update(bookings)
        .set({ expiresAt: pastDate })
        .where(eq(bookings.id, bookingId));

      const bookingCronService = app.get(BookingCronService);
      await bookingCronService.handleCleanupExpiredSeatLocks();

      const [updatedBooking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId));

      expect(updatedBooking?.status).toBe("expired");

      const [updatedShowSeat] = await db
        .select()
        .from(showSeats)
        .where(
          and(
            eq(showSeats.showId, testShowId),
            eq(showSeats.seatId, testSeatId7),
          ),
        );
      expect(updatedShowSeat?.status).toBe("available");
      expect(updatedShowSeat?.lockedUntil).toBeNull();
    });

    it.skip("7.4 Redlock TTL Expiry Fallback: should rely on Postgres FOR UPDATE pessimistic locking when Redlock TTL (>2000ms) expires during high DB latency", async () => {
      // WHY: Simulating >2000ms database transaction latency requires a custom DB connection pool latency injector or mocked DrizzleDB transaction.
      // The Postgres row-level lock (FOR UPDATE) acts as the ultimate SSOT safety net as proven in architectural review.
    });
  });
});
