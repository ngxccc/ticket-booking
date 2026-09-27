import { z } from "zod";
import { createZodDto } from "@/common/dto";

export const showMovieMetadataSchema = z.object({
  id: z.string().meta({
    description: "UUIDv7 identifier of the movie",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
  }),
  title: z.string().meta({
    description: "Localized title of the movie",
    example: "Deadpool & Wolverine",
  }),
  posterUrl: z.string().nullable().meta({
    description: "Public poster image URL",
    example: "https://cdn.ticketbooking.com/posters/deadpool.jpg",
  }),
  durationMinutes: z.number().meta({
    description: "Movie running duration in minutes",
    example: 120,
  }),
  rating: z.string().nullable().meta({
    description: "Age advisory rating code",
    example: "T18",
  }),
});

export const showCinemaMetadataSchema = z.object({
  id: z.string().meta({
    description: "UUIDv7 identifier of the cinema complex",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb70",
  }),
  name: z.string().meta({
    description: "Commercial display name of the cinema complex",
    example: "CGV Landmark 81",
  }),
  city: z.string().meta({
    description: "City or province where the cinema complex is located",
    example: "Ho Chi Minh City",
  }),
  streetAddress: z.string().meta({
    description: "Detailed street address location of the cinema complex",
    example: "720A Dien Bien Phu, Ward 22, Binh Thanh",
  }),
});

export const showHallMetadataSchema = z.object({
  id: z.string().meta({
    description: "UUIDv7 identifier of the cinema hall",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb80",
  }),
  name: z.string().meta({
    description: "Display name and format of the cinema hall",
    example: "Hall 01 (IMAX Laser)",
  }),
});

export const showScheduleItemSchema = z.object({
  id: z.string().meta({
    description: "UUIDv7 identifier of the scheduled showtime slot",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb91",
  }),
  startTime: z.string().meta({
    description: "ISO 8601 start timestamp in UTC",
    example: "2026-09-02T03:00:00.000Z",
  }),
  endTime: z.string().meta({
    description:
      "ISO 8601 end timestamp in UTC (computed automatically via startTime + movie.durationMinutes)",
    example: "2026-09-02T05:00:00.000Z",
  }),
  basePrice: z.number().meta({
    description: "Base ticket price for standard seats in VND",
    example: 100000,
  }),
  availableSeats: z.number().meta({
    description:
      "Real-time non-locking count of available physical seats for purchase",
    example: 95,
  }),
  totalSeats: z.number().meta({
    description:
      "Total physical seats pre-allocated for this cinema hall and showtime",
    example: 100,
  }),
  movie: showMovieMetadataSchema,
  cinema: showCinemaMetadataSchema,
  hall: showHallMetadataSchema,
});

export type ShowMovieMetadataDtoType = z.infer<typeof showMovieMetadataSchema>;
export type ShowCinemaMetadataDtoType = z.infer<
  typeof showCinemaMetadataSchema
>;
export type ShowHallMetadataDtoType = z.infer<typeof showHallMetadataSchema>;
export type ShowScheduleItemDtoType = z.infer<typeof showScheduleItemSchema>;

export class ShowMovieMetadataDto extends createZodDto(
  showMovieMetadataSchema,
) {}
export class ShowCinemaMetadataDto extends createZodDto(
  showCinemaMetadataSchema,
) {}
export class ShowHallMetadataDto extends createZodDto(showHallMetadataSchema) {}
export class ShowScheduleItemDto extends createZodDto(showScheduleItemSchema) {}
