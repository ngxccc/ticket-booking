import type { DrizzleDB } from "@/database/database.module";
import { createShow } from "../factories/show.factory";
import type { TShow } from "@/database/schemas";

export const ShowMother = {
  /** Suất chiếu vào ngày mai (khởi chiếu sau 24h, kéo dài 2h) */
  tomorrow(db: DrizzleDB, hallId?: string, movieId?: string): Promise<TShow> {
    const start = new Date(Date.now() + 86400000);
    const end = new Date(start.getTime() + 7200000);

    return createShow(db, {
      hallId,
      movieId,
      startTime: start,
      endTime: end,
      basePrice: 100000,
    });
  },

  /** Suất chiếu với khung giờ cụ thể và giá vé tùy chỉnh */
  scheduled(
    db: DrizzleDB,
    hallId: string,
    movieId: string,
    startTime: Date,
    endTime: Date,
    basePrice = 100000,
  ): Promise<TShow> {
    return createShow(db, {
      hallId,
      movieId,
      startTime,
      endTime,
      basePrice,
    });
  },
} as const;
