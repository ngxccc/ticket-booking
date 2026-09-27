import { z } from "zod";
import { createZodDto } from "@/common/dto";

export const showResponseSchema = z.object({
  id: z.string().meta({
    description: "UUIDv7 of the newly created show",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb91",
  }),
  movieId: z.string().meta({
    description: "UUIDv7 of the scheduled movie",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
  }),
  hallId: z.string().meta({
    description: "UUIDv7 of the cinema hall",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb90",
  }),
  startTime: z.string().meta({
    description: "ISO 8601 start timestamp",
    example: "2026-09-01T10:00:00.000Z",
  }),
  endTime: z.string().meta({
    description: "ISO 8601 end timestamp (automatically computed)",
    example: "2026-09-01T12:00:00.000Z",
  }),
  basePrice: z.number().meta({
    description: "Base ticket price in VND",
    example: 100000,
  }),
  totalSeats: z.number().meta({
    description: "Total number of physical seats pre-allocated as available",
    example: 100,
  }),
});

export type ShowResponseDtoType = z.infer<typeof showResponseSchema>;

export class ShowResponseDto extends createZodDto(showResponseSchema) {}
