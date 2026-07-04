import {
  date,
  index,
  integer,
  primaryKey,
  snakeCase,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { movieRatingEnum } from "./enums.schema";
import { baseEntity, primaryKeyUuid } from "./helpers.schema";

export const movies = snakeCase.table("movies", {
  ...baseEntity,
  tmdbId: varchar({ length: 50 }).unique(),
  imdbId: varchar({ length: 50 }).unique(),
  durationMinutes: integer().notNull(),
  releaseDate: date({ mode: "string" }),
  posterUrl: text(),
  trailerUrl: text(),
  rating: movieRatingEnum(),
});

export const genres = snakeCase.table("genres", {
  ...primaryKeyUuid,
  name: varchar({ length: 100 }).notNull().unique(),
});

export const movieGenres = snakeCase.table(
  "movie_genres",
  {
    movieId: uuid()
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    genreId: uuid()
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.movieId, table.genreId] }),
    index("movie_genres_genre_id_idx").on(table.genreId),
  ],
);

export const movieTranslations = snakeCase.table(
  "movie_translations",
  {
    movieId: uuid()
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    languageCode: varchar({ length: 10 }).notNull(),
    title: varchar({ length: 255 }).notNull(),
    description: text(),
  },
  (table) => [primaryKey({ columns: [table.movieId, table.languageCode] })],
);

export type TMovie = typeof movies.$inferSelect;
export type TNewMovie = typeof movies.$inferInsert;
export type TGenre = typeof genres.$inferSelect;
export type TNewGenre = typeof genres.$inferInsert;
export type TMovieTranslation = typeof movieTranslations.$inferSelect;
export type TNewMovieTranslation = typeof movieTranslations.$inferInsert;
