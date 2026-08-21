import type { DrizzleDB } from "@/database/database.module";
import { createMovie } from "../factories/movie.factory";
import type { TMovie } from "@/database/schemas";

export const MovieMother = {
  /** Phim chuẩn chiếu rạp thông thường (120 phút, PG) */
  standard(db: DrizzleDB): Promise<TMovie> {
    return createMovie(db, {
      durationMinutes: 120,
      rating: "PG",
      posterUrl: "https://example.com/standard-poster.jpg",
    });
  },

  /** Phim thời lượng dài / bom tấn đặc biệt (300 phút, PG) */
  blockbusterLong(db: DrizzleDB): Promise<TMovie> {
    return createMovie(db, {
      durationMinutes: 300,
      rating: "PG",
      posterUrl: "https://example.com/long-poster.jpg",
    });
  },

  /** Phim hoạt hình ngắn (30 phút, G) */
  animationShort(db: DrizzleDB): Promise<TMovie> {
    return createMovie(db, {
      durationMinutes: 30,
      rating: "G",
      posterUrl: "https://example.com/short-poster.jpg",
    });
  },
} as const;
