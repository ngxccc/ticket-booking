import { ShowsService } from "@/modules/shows/shows.service";
import { createMovie } from "../factories/movie.factory";
import {
  createCinema,
  createHall,
  createSeatType,
  createBatchSeats,
} from "../factories/cinema.factory";
import { createTestApp, teardownTestApp } from "../helpers/app.helper";
import { TIME_IN_MS } from "@/common/constants/time.constant";
import { shows, showSeats } from "@/database/schemas";
import {
  measureBenchmark,
  computeBenchmarkMetrics,
  type BenchmarkMetric,
} from "./benchmark.util";

export async function runBenchmark(): Promise<BenchmarkMetric[]> {
  const metrics: BenchmarkMetric[] = [];
  const setup = await createTestApp();
  const db = setup.db;
  const service = setup.app.get(ShowsService);

  // Suite 1: Pure In-Memory Timeline Expansion & Intra-batch Validation (Direct ShowsService Method)
  const tomorrow = new Date(Date.now() + TIME_IN_MS.DAY);
  const thirtyDaysLater = new Date(Date.now() + 30 * TIME_IN_MS.DAY);
  const startDate = tomorrow.toISOString().slice(0, 10);
  const endDate = thirtyDaysLater.toISOString().slice(0, 10);

  const dto = {
    movieId: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
    hallId: "019fa8bc-8f4d-7000-b366-e691f45cfb90",
    startDate,
    endDate,
    timeSlots: ["08:00", "11:00", "14:00"],
    basePrice: 100000,
  };
  const movieDuration = 120;

  metrics.push(
    measureBenchmark(
      "ShowsBatch: In-Memory 90 Slots Expansion & Sort (ShowsService)",
      () => {
        service.expandAndValidateTimeline(dto, movieDuration);
      },
      10000,
    ),
  );

  // Suite 2: Full Database Transaction (100 Shows x 200 Seats = 20,000 show_seats records)
  const movie = await createMovie(db, { durationMinutes: 120 });
  const cinema = await createCinema(db, { name: "Benchmark Cinema" });
  const hall = await createHall(db, {
    cinemaId: cinema.id,
    name: "Benchmark Hall 200 Seats",
    totalSeats: 200,
  });
  const seatType = await createSeatType(db, {
    name: `bench-${Date.now().toString()}`,
  });
  await createBatchSeats(db, hall.id, seatType.id, 200);

  const stressStart = new Date(Date.now() + 35 * TIME_IN_MS.DAY);
  const stressEnd = new Date(Date.now() + 55 * TIME_IN_MS.DAY);
  const stressDto = {
    movieId: movie.id,
    hallId: hall.id,
    startDate: stressStart.toISOString().slice(0, 10),
    endDate: stressEnd.toISOString().slice(0, 10),
    timeSlots: ["08:00", "11:00", "14:00", "17:00"],
    basePrice: 150000,
  };

  const dbStart = performance.now();
  await service.createShowBatch(stressDto);
  const dbEnd = performance.now();

  metrics.push(
    computeBenchmarkMetrics("ShowsBatch: DB Bulk 100 Shows + 20k Seats Tx", 1, [
      dbEnd - dbStart,
    ]),
  );

  try {
    await db.delete(showSeats);
    await db.delete(shows);
  } finally {
    await teardownTestApp(setup);
  }

  return metrics;
}

export default runBenchmark;
