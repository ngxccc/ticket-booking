import { z } from "zod";
import { createZodDto } from "@/common/dto";

export const batchShowResponseSchema = z.object({
  createdCount: z.number().meta({
    description: "Total number of showtimes successfully created",
    example: 12,
  }),
  showIds: z.array(z.string()).meta({
    description: "Array of UUIDv7 identifiers for all created showtimes",
    example: [
      "019fa8bc-8f4d-7000-b366-e691f45cfb91",
      "019fa8bc-8f4d-7000-b366-e691f45cfb92",
    ],
  }),
});

export type BatchShowResponseDtoType = z.infer<typeof batchShowResponseSchema>;

export class BatchShowResponseDto extends createZodDto(
  batchShowResponseSchema,
) {}
