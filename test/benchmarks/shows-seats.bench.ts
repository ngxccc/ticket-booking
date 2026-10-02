import { ShowsService } from "@/modules/shows/shows.service";
import {
  createMovie,
  createMovieTranslation,
} from "../factories/movie.factory";
import {
  createCinema,
  createHall,
  createSeatType,
} from "../factories/cinema.factory";
import { createShow } from "../factories/show.factory";
import { createTestApp, teardownTestApp } from "../helpers/app.helper";
import {
  showSeats,
  seats,
  type NewSeat,
  type NewShowSeat,
} from "@/database/schemas";
import { TIME_IN_MS } from "@/common/constants/time.constant";
import {
  computeBenchmarkMetrics,
  type BenchmarkMetric,
} from "./benchmark.util";
import type { DrizzleDB } from "@/database/database.module";

/**
 * Provisions a complete showtime layout with mixed seat statuses:
 * - 80% available
 * - 10% reserved (with active lockedUntil timestamp)
 * - 10% booked
 *
 * @param db Drizzle DB client
 * @param rowCount Number of seat rows (e.g. 10 for A-J)
 * @param colsPerRow Seats per row (e.g. 20)
 */
async function provisionSeatingChart(
  db: DrizzleDB,
  rowCount: number,
  colsPerRow: number,
): Promise<{ showId: string; totalSeats: number }> {
  const totalSeats = rowCount * colsPerRow;
  const movie = await createMovie(db, {
    durationMinutes: 120,
  });
  await createMovieTranslation(
    db,
    movie.id,
    "vi",
    "Benchmark Test Movie",
    "Mô tả phim benchmark",
  );
  const cinema = await createCinema(db, {
    name: `Bench Cinema ${Date.now().toString()}`,
  });
  const hall = await createHall(db, {
    cinemaId: cinema.id,
    name: `Bench Hall ${totalSeats.toString()} Seats`,
    totalSeats,
  });
  const standardType = await createSeatType(db, {
    name: `STD-${Date.now().toString()}`,
    priceMultiplier: "1.00",
  });
  const vipType = await createSeatType(db, {
    name: `VIP-${Date.now().toString()}`,
    priceMultiplier: "1.50",
  });

  const seatValues: NewSeat[] = [];
  for (let r = 0; r < rowCount; r++) {
    const rowChar = String.fromCharCode(65 + r); // A, B, C...
    const isVipRow = r >= rowCount - 2; // Last 2 rows are VIP
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
    movieId: movie.id,
    hallId: hall.id,
    startTime: new Date(Date.now() + TIME_IN_MS.DAY),
    endTime: new Date(Date.now() + TIME_IN_MS.DAY + 2 * TIME_IN_MS.HOUR),
    basePrice: 120000,
  });

  const showSeatValues: NewShowSeat[] = insertedSeats.map((seat, index) => {
    // 80% available, 10% reserved with active lock, 10% booked
    const mod = index % 10;
    if (mod === 8) {
      return {
        showId: show.id,
        seatId: seat.id,
        status: "reserved",
        lockedUntil: new Date(Date.now() + 10 * TIME_IN_MS.MINUTE), // locked for next 10m
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

export async function runBenchmark(): Promise<BenchmarkMetric[]> {
  const metrics: BenchmarkMetric[] = [];
  const setup = await createTestApp();
  const db = setup.db;
  const service = setup.app.get(ShowsService);

  const WARMUP_RUNS = 5;
  const MEASURE_RUNS = 50;

  try {
    // --- Suite 1: Standard Hall (200 seats: 10 rows x 20 cols) ---
    const standard = await provisionSeatingChart(db, 10, 20);

    // Warmup
    for (let i = 0; i < WARMUP_RUNS; i++) {
      const res = await service.getShowSeats(standard.showId, "vi");
      if (!res.showId) throw new Error("Benchmark warmup assertion failed");
    }

    // Measurement
    const standardTimes: number[] = [];
    for (let i = 0; i < MEASURE_RUNS; i++) {
      const start = performance.now();
      const res = await service.getShowSeats(standard.showId, "vi");
      const end = performance.now();
      if (!res.showId) throw new Error("Benchmark execution assertion failed");
      standardTimes.push(end - start);
    }

    metrics.push(
      computeBenchmarkMetrics(
        `ShowsSeats: 200 Seats (PostgreSQL Single-JOIN + Dynamic Virtual Status)`,
        MEASURE_RUNS,
        standardTimes,
      ),
    );

    // --- Suite 2: IMAX / Mega Hall (500 seats: 20 rows x 25 cols) ---
    const imax = await provisionSeatingChart(db, 20, 25);

    // Warmup
    for (let i = 0; i < WARMUP_RUNS; i++) {
      const res = await service.getShowSeats(imax.showId, "vi");
      if (!res.showId) throw new Error("Benchmark warmup assertion failed");
    }

    // Measurement
    const imaxTimes: number[] = [];
    for (let i = 0; i < MEASURE_RUNS; i++) {
      const start = performance.now();
      const res = await service.getShowSeats(imax.showId, "vi");
      const end = performance.now();
      if (!res.showId) throw new Error("Benchmark execution assertion failed");
      imaxTimes.push(end - start);
    }

    metrics.push(
      computeBenchmarkMetrics(
        `ShowsSeats: 500 Seats (PostgreSQL Single-JOIN + Dynamic Virtual Status)`,
        MEASURE_RUNS,
        imaxTimes,
      ),
    );
  } finally {
    await teardownTestApp(setup);
  }

  return metrics;
}

export default runBenchmark;
