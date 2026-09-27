import { z } from "zod";
import {
  createZodDto,
  paginationMetaSchema,
  PaginationMetaDto,
} from "@/common/dto";

export { PaginationMetaDto };
export const movieGenreItemSchema = z.object({
  id: z.string().meta({
    description: "UUIDv7 of the genre",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb01",
  }),
  name: z.string().meta({
    description: "Localized genre name",
    example: "Action",
  }),
});

export const movieResponseSchema = z.object({
  id: z.string().meta({
    description: "UUIDv7 identifier of the movie",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb91",
  }),
  title: z.string().meta({
    description: "Localized movie title",
    example: "Deadpool & Wolverine",
  }),
  description: z.string().nullable().meta({
    description: "Localized movie synopsis/description",
    example: "Wolverine joins Deadpool on a multiverse mission.",
  }),
  durationMinutes: z.number().meta({
    description: "Duration in minutes",
    example: 128,
  }),
  releaseDate: z.string().nullable().meta({
    description: "Release date in YYYY-MM-DD format",
    example: "2026-07-26",
  }),
  rating: z.string().nullable().meta({
    description: "Age rating code",
    example: "R",
  }),
  posterUrl: z.string().nullable().meta({
    description: "Poster image URL",
    example: "https://cdn.ticketbooking.com/posters/deadpool.jpg",
  }),
  trailerUrl: z.string().nullable().meta({
    description: "Trailer video URL",
    example: "https://youtube.com/watch?v=deadpool",
  }),
  genres: z.array(movieGenreItemSchema).meta({
    description: "List of associated genres",
  }),
});
export const movieListResponseSchema = z.object({
  data: z.array(movieResponseSchema),
  meta: paginationMetaSchema,
});

export type MovieGenreItemDtoType = z.infer<typeof movieGenreItemSchema>;
export type MovieResponseDtoType = z.infer<typeof movieResponseSchema>;
export type MovieListResponseDtoType = z.infer<typeof movieListResponseSchema>;

export class MovieGenreItemDto extends createZodDto(movieGenreItemSchema) {}
export class MovieResponseDto extends createZodDto(movieResponseSchema) {}
export class MovieListResponseDto extends createZodDto(
  movieListResponseSchema,
) {}
