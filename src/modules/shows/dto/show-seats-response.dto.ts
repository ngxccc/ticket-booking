import { z } from "zod";
import { createZodDto } from "@/common/dto/create-zod-dto.util";
import { zDate, zUuidV7 } from "@/common/schemas/zod-primitives";
export const seatTypeInfoSchema = z
  .object({
    id: zUuidV7().meta({
      description: "Seat type unique identifier (UUIDv7)",
      example: "01923456-789a-7bc0-8123-456789abcdef",
    }),
    name: z.string().meta({
      description: "Seat tier name",
      example: "Standard",
    }),
    priceMultiplier: z.string().meta({
      description: "Price multiplier factor formatted as decimal string",
      example: "1.00",
    }),
    finalPrice: z.number().int().min(0).meta({
      description: "Itemized final seat price for this category in VND",
      example: 90000,
    }),
  })
  .strict();

export const showSeatItemSchema = z
  .object({
    id: zUuidV7().meta({
      description: "Seat unique identifier (UUIDv7)",
      example: "01923456-789a-7bc0-8123-456789abcdef",
    }),
    seatNumber: z.string().meta({
      description: "Human-readable seat code",
      example: "A01",
    }),
    row: z.string().meta({
      description: "Row identifier letter",
      example: "A",
    }),
    number: z.number().int().meta({
      description: "Column seat sequence number within row",
      example: 1,
    }),
    seatTypeId: zUuidV7().meta({
      description: "Referenced seat category type identifier (UUIDv7)",
      example: "01923456-789a-7bc0-8123-456789abcdef",
    }),
    finalPrice: z.number().int().min(0).meta({
      description:
        "Calculated final seat price in VND (basePrice * multiplier)",
      example: 90000,
    }),
    status: z.enum(["available", "reserved", "booked"]).meta({
      description:
        "Real-time seat reservation status (virtual expired fallback applied)",
      example: "available",
    }),
    lockedUntil: zDate().nullable().meta({
      description:
        "ISO-8601 UTC expiration timestamp if currently held in reservation",
      example: "2026-09-30T19:15:00.000Z",
    }),
  })
  .strict();

export const showSeatsDimensionsSchema = z
  .object({
    totalRows: z.number().int().min(0).meta({
      description: "Total number of physical seating rows",
      example: 10,
    }),
    totalCols: z.number().int().min(0).meta({
      description: "Maximum column count across all rows",
      example: 12,
    }),
  })
  .strict();

export const showSeatsSummarySchema = z
  .object({
    total: z.number().int().min(0).meta({
      description: "Total physical seats in hall",
      example: 120,
    }),
    available: z.number().int().min(0).meta({
      description: "Count of available seats (including lapsed holds)",
      example: 102,
    }),
    reserved: z.number().int().min(0).meta({
      description: "Count of actively held seats pending payment",
      example: 10,
    }),
    booked: z.number().int().min(0).meta({
      description: "Count of confirmed booked seats",
      example: 8,
    }),
  })
  .strict();

export const showSeatsResponseSchema = z
  .object({
    showId: zUuidV7().meta({
      description: "Showtime unique identifier (UUIDv7)",
      example: "01923456-789a-7bc0-8123-456789abcdef",
    }),
    movieId: zUuidV7().meta({
      description: "Associated movie identifier (UUIDv7)",
      example: "01923456-1111-7bc0-8123-456789abcdef",
    }),
    movieTitle: z.string().meta({
      description: "Movie title",
      example: "Lật Mặt 7: Một Điều Ước",
    }),
    cinemaId: zUuidV7().meta({
      description: "Cinema facility identifier (UUIDv7)",
      example: "01923456-2222-7bc0-8123-456789abcdef",
    }),
    cinemaName: z.string().meta({
      description: "Cinema branch name",
      example: "CGV Landmark 81",
    }),
    hallId: zUuidV7().meta({
      description: "Cinema hall identifier (UUIDv7)",
      example: "01923456-3333-7bc0-8123-456789abcdef",
    }),
    hallName: z.string().meta({
      description: "Hall name or screen number",
      example: "Cinema 01 (IMAX)",
    }),
    startTime: zDate().meta({
      description: "Show start time in ISO-8601 UTC",
      example: "2026-09-30T19:30:00.000Z",
    }),
    endTime: zDate().meta({
      description: "Show end time in ISO-8601 UTC",
      example: "2026-09-30T21:45:00.000Z",
    }),
    basePrice: z.number().int().min(0).meta({
      description: "Standard base ticket price in VND",
      example: 90000,
    }),
    dimensions: showSeatsDimensionsSchema.meta({
      description: "Physical hall dimensions for grid layout calculation",
    }),
    summary: showSeatsSummarySchema.meta({
      description: "Aggregate summary of seat counts by availability state",
    }),
    seatTypes: z.array(seatTypeInfoSchema).meta({
      description:
        "Itemized catalog of distinct physical seat categories in the hall",
    }),
    seats: z.array(showSeatItemSchema).meta({
      description: "Itemized list of physical seats with live status",
    }),
  })
  .strict();

export type ShowSeatsResponseDtoType = z.infer<typeof showSeatsResponseSchema>;
export type ShowSeatItemDtoType = z.infer<typeof showSeatItemSchema>;
export type SeatTypeInfoDtoType = z.infer<typeof seatTypeInfoSchema>;

export class ShowSeatsResponseDto extends createZodDto(
  showSeatsResponseSchema,
) {
  public static readonly zodSchema = showSeatsResponseSchema;
}
