import { Logger } from "@nestjs/common";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { and, eq, inArray, like } from "drizzle-orm";
import type { Redis } from "ioredis";
import * as schema from "@/database/schemas";
import { createRedisClient } from "@/config/redis.config";
import {
  createTestPool,
  createDrizzleClient,
  type DrizzleDB,
} from "../helpers/database.helper";
import type { BookingLoadFixture } from "./fixtures/types";
import { REDIS_KEYS } from "@/modules/booking/booking.constants";

const logger = new Logger("Verify");

/**
 * Asserts all post-load-test database and Redis state invariants.
 *
 * @param db - Drizzle DB instance connected to target test database
 * @param redis - Redis client instance
 * @param fixture - Test fixture metadata containing show and seat identifiers
 */
export async function verifyDatabaseInvariants(
  db: DrizzleDB,
  redis: Redis,
  fixture: BookingLoadFixture,
): Promise<{ winnerBookingId: string; winnerUserId: string }> {
  logger.log("Asserting post-test database & cache invariants...");

  // Invariant 1: Hot seat status transitioned to reserved in PostgreSQL
  const showSeatList = await db
    .select()
    .from(schema.showSeats)
    .where(
      and(
        eq(schema.showSeats.showId, fixture.showId),
        eq(schema.showSeats.seatId, fixture.targetSeatId),
      ),
    );

  const hotSeat = showSeatList[0];
  if (hotSeat?.status !== "reserved") {
    throw new Error(
      `Invariant violation: Hot seat ${fixture.targetSeatId} status must be 'reserved', received '${String(hotSeat?.status)}'`,
    );
  }

  // Invariant 2: Exactly 1 ticket issued for the contested hot seat
  const issuedTickets = await db
    .select()
    .from(schema.tickets)
    .where(eq(schema.tickets.showSeatId, hotSeat.id));

  if (issuedTickets.length !== 1) {
    throw new Error(
      `Invariant violation: Expected exactly 1 ticket for hot seat ${fixture.targetSeatId}, found ${String(issuedTickets.length)}`,
    );
  }

  const winningTicket = issuedTickets[0];
  if (!winningTicket) {
    throw new Error("Invariant violation: Missing winning ticket record");
  }

  // Invariant 3: Single winner booking created in pending_payment status
  const [winner] = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, winningTicket.bookingId));

  if (winner?.status !== "pending_payment") {
    throw new Error(
      `Invariant violation: Winner booking status must be 'pending_payment', received '${String(winner?.status)}'`,
    );
  }

  // Invariant 4: Redlock mutex released without leaking in Redis
  const lockKey = REDIS_KEYS.showSeatLock(fixture.targetSeatId);
  const activeLock = await redis.get(lockKey);
  if (activeLock !== null) {
    throw new Error(
      `Invariant violation: Redlock key '${lockKey}' leaked in Redis. Lock must be released post-request.`,
    );
  }

  logger.log(
    `All invariants passed! Winner Booking: ${winner.id}, Winner User: ${winner.userId}`,
  );

  return {
    winnerBookingId: winner.id,
    winnerUserId: winner.userId,
  };
}

/**
 * Performs complete teardown of load test entities across PostgreSQL and Redis.
 *
 * @param db - Drizzle DB instance connected to target test database
 * @param redis - Redis client instance
 * @param fixture - Test fixture metadata
 */
export async function teardownTestData(
  db: DrizzleDB,
  redis: Redis,
  fixture: BookingLoadFixture,
): Promise<void> {
  logger.log("Cleaning up load test artifacts and database records...");

  // 1. Delete tickets and bookings
  const showBookings = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(eq(schema.bookings.showId, fixture.showId));

  const bookingIds = showBookings.map((b: { id: string }) => b.id);
  if (bookingIds.length > 0) {
    await db
      .delete(schema.tickets)
      .where(inArray(schema.tickets.bookingId, bookingIds));
    await db
      .delete(schema.bookings)
      .where(inArray(schema.bookings.id, bookingIds));
  }

  // 2. Delete show seats and show
  await db
    .delete(schema.showSeats)
    .where(eq(schema.showSeats.showId, fixture.showId));

  const showList = await db
    .select({
      id: schema.shows.id,
      hallId: schema.shows.hallId,
      movieId: schema.shows.movieId,
    })
    .from(schema.shows)
    .where(eq(schema.shows.id, fixture.showId));

  await db.delete(schema.shows).where(eq(schema.shows.id, fixture.showId));

  // 3. Delete seats, hall, cinema, movie
  if (showList.length > 0 && showList[0]) {
    const { hallId, movieId } = showList[0];

    const hallList = await db
      .select({ id: schema.halls.id, cinemaId: schema.halls.cinemaId })
      .from(schema.halls)
      .where(eq(schema.halls.id, hallId));

    await db.delete(schema.seats).where(eq(schema.seats.hallId, hallId));
    await db.delete(schema.halls).where(eq(schema.halls.id, hallId));

    if (hallList.length > 0 && hallList[0]) {
      await db
        .delete(schema.cinemas)
        .where(eq(schema.cinemas.id, hallList[0].cinemaId));
    }

    await db.delete(schema.movies).where(eq(schema.movies.id, movieId));
  }

  // 4. Delete load test users
  const userIds = fixture.users.map((u) => u.id);
  if (userIds.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      await db.delete(schema.users).where(inArray(schema.users.id, chunk));
    }
  }

  // Fallback cleanup of any orphaned load test users
  await db.delete(schema.users).where(like(schema.users.email, "loadtest-%"));

  // 5. Clean up Redis keys
  const lockKey = REDIS_KEYS.showSeatLock(fixture.targetSeatId);
  await redis.del(lockKey);

  logger.log("Database and cache cleanup completed successfully.");
}

/**
 * Main verification and teardown runner.
 */
export async function runVerifyAndTeardown(): Promise<void> {
  const fixturePath = path.resolve(process.cwd(), "dist/booking-fixtures.json");

  let rawFixture: string;
  try {
    rawFixture = await fs.readFile(fixturePath, "utf-8");
  } catch {
    logger.warn(
      `No fixtures file found at ${fixturePath}. Skipping verification.`,
    );
    return;
  }

  const fixture = JSON.parse(rawFixture) as BookingLoadFixture;
  const pool = createTestPool();
  const db = createDrizzleClient(pool);
  const redis = createRedisClient();

  try {
    await verifyDatabaseInvariants(db, redis, fixture);
    logger.log("Verification and state teardown finished.");
  } finally {
    await teardownTestData(db, redis, fixture);
    await fs.rm(fixturePath, { force: true });
    await redis.quit();
    await pool.end();
  }
}

if (import.meta.main) {
  runVerifyAndTeardown()
    .then(() => {
      process.exit(0);
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      logger.error(`Verification or teardown failed: ${message}`, stack);
      process.exit(1);
    });
}
