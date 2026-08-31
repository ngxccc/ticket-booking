import type { DrizzleDB } from "@/database/database.module";
import type { SeedScope } from "../constants/seed.constant";

/**
 * Configuration options passed to the database seeding engine.
 */
export interface SeedOptions {
  /** Drizzle database client instance */
  db: DrizzleDB;
  /** Active scope filter or array of scopes to execute */
  scope?: SeedScope | SeedScope[] | (string & {});
  /** Whether to truncate existing table rows before seeding */
  reset?: boolean;
  /** Whether to enable verbose execution logging */
  verbose?: boolean;
}

/**
 * Execution metrics and record counts produced by the seeding engine.
 */
export interface SeedSummary {
  genres: number;
  seatTypes: number;
  users: number;
  cinemas: number;
  halls: number;
  seats: number;
  movies: number;
  movieTranslations: number;
  shows: number;
  showSeats: number;
  durationMs: number;
  errors: string[];
}

export interface SeededGenreRef {
  id: string;
  name: string;
}

export interface SeededSeatTypeRef {
  id: string;
  name: string;
  priceMultiplier: string;
}

export interface SeededUserRef {
  id: string;
  email: string;
  role: string;
  fullName: string;
}

/**
 * Result payload produced by Tier 1 Master Reference seeder.
 */
export interface Tier1SeedResult {
  genres: SeededGenreRef[];
  seatTypes: SeededSeatTypeRef[];
  users: SeededUserRef[];
}
