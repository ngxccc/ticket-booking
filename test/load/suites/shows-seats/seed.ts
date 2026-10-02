import { Logger } from "@nestjs/common";
import { resolve } from "node:path";
import { env } from "@/env";
import { TIME_IN_MS } from "@/common/constants/time.constant";
import { createTestPool } from "../../../helpers/database.helper";
import { createDrizzleClient } from "@/database/database.connection";
import type { ShowsSeatsLoadFixture } from "../../shared/types";
import {
  createMovie,
  createMovieTranslation,
} from "../../../factories/movie.factory";
import {
  createCinema,
  createHall,
  createSeatType,
} from "../../../factories/cinema.factory";
import { createShow } from "../../../factories/show.factory";
import {
  seats,
  showSeats,
  type NewSeat,
  type NewShowSeat,
} from "@/database/schemas";
import type { DrizzleDB } from "@/database/database.module";

const logger = new Logger("SeedShowsSeats");

/**
 * Provisions a complete showtime layout with mixed seat statuses:
 * - 80% available
 * - 10% reserved (with active lockedUntil timestamp)
 * - 10% booked
 */
async function provisionSeatingChart(
  db: DrizzleDB,
  movieId: string,
  cinemaId: string,
  rowCount: number,
  colsPerRow: number,
  label: string,
): Promise<{ showId: string; totalSeats: number }> {
  const totalSeats = rowCount * colsPerRow;
  const timestamp = Date.now().toString();

  const hall = await createHall(db, {
    cinemaId,
    name: `${label} Hall ${totalSeats.toString()} Seats`,
    totalSeats,
  });

  const standardType = await createSeatType(db, {
    name: `STD-${label}-${timestamp}`,
    priceMultiplier: "1.00",
  });
  const vipType = await createSeatType(db, {
    name: `VIP-${label}-${timestamp}`,
    priceMultiplier: "1.50",
  });

  const seatValues: NewSeat[] = [];
  for (let r = 0; r < rowCount; r++) {
    const rowChar = String.fromCharCode(65 + r);
    const isVipRow = r >= rowCount - 2;
    const typeId = isVipRow ? vipType.id : standardType.id;

    for (let c = 1; c <= colsPerRow; c++) {
      seatValues.push({
        hallId: hall.id,
        seatTypeId: typeId,
        row: rowChar,
        number: c,
        seatNumber: `${rowChar}${c.toString()}`,
      });
    }
  }

  const insertedSeats = await db.insert(seats).values(seatValues).returning();

  const show = await createShow(db, {
    movieId,
    hallId: hall.id,
    startTime: new Date(Date.now() + TIME_IN_MS.DAY),
    endTime: new Date(Date.now() + TIME_IN_MS.DAY + 2 * TIME_IN_MS.HOUR),
    basePrice: 120000,
  });

  const showSeatValues: NewShowSeat[] = insertedSeats.map((seat, index) => {
    const mod = index % 10;
    if (mod === 8) {
      return {
        showId: show.id,
        seatId: seat.id,
        status: "reserved",
        lockedUntil: new Date(Date.now() + 10 * TIME_IN_MS.MINUTE), // 10 minutes lock
      };
    }
    if (mod === 9) {
      return {
        showId: show.id,
        seatId: seat.id,
        status: "booked",
      };
    }
    return {
      showId: show.id,
      seatId: seat.id,
      status: "available",
    };
  });

  await db.insert(showSeats).values(showSeatValues);

  return { showId: show.id, totalSeats };
}

export async function seedShowsSeatsData(): Promise<ShowsSeatsLoadFixture> {
  const pool = createTestPool();
  const db = createDrizzleClient(pool);

  try {
    logger.log("Seeding shows seating chart benchmark fixtures...");

    const movie = await createMovie(db, {
      durationMinutes: 120,
    });
    await createMovieTranslation(
      db,
      movie.id,
      "vi",
      "Benchmark Seating Chart Movie",
      "Mô tả phim load test",
    );

    const cinema = await createCinema(db, {
      name: `Benchmark Cinema ${Date.now().toString()}`,
    });

    // 1. Standard Hall: 200 seats (10 rows x 20 cols)
    const standard = await provisionSeatingChart(
      db,
      movie.id,
      cinema.id,
      10,
      20,
      "Standard",
    );

    // 2. IMAX Hall: 500 seats (20 rows x 25 cols)
    const imax = await provisionSeatingChart(
      db,
      movie.id,
      cinema.id,
      20,
      25,
      "IMAX",
    );

    const fixturePayload: ShowsSeatsLoadFixture = {
      targetUrl: env.TARGET_URL,
      standardShowId: standard.showId,
      imaxShowId: imax.showId,
      standardTotalSeats: standard.totalSeats,
      imaxTotalSeats: imax.totalSeats,
    };

    const fixtureFilePath = resolve(
      process.cwd(),
      "test/load/.dist/shows-seats-fixtures.json",
    );
    await Bun.write(fixtureFilePath, JSON.stringify(fixturePayload, null, 2));

    logger.log(
      `Seeded Standard Show (${String(standard.totalSeats)} seats): ${standard.showId}`,
    );
    logger.log(
      `Seeded IMAX Show (${String(imax.totalSeats)} seats): ${imax.showId}`,
    );
    logger.log(`Fixtures written to ${fixtureFilePath}`);

    return fixturePayload;
  } finally {
    await pool.end();
  }
}

if (import.meta.main) {
  seedShowsSeatsData()
    .then(() => {
      logger.log("Shows seating chart seed completed successfully.");
      process.exit(0);
    })
    .catch((err: unknown) => {
      logger.error("Failed to seed shows seating chart load test data", err);
      process.exit(1);
    });
}
