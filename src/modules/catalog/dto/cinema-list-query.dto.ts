import { z } from "zod";
import { createZodDto } from "@/common/dto";
import {
  zNumericString,
  zSanitizedString,
} from "@/common/schemas/zod-primitives";

/**
 * Validation schema for GET /cinemas query parameters.
 */
export const cinemaListQuerySchema = z
  .object({
    city: zSanitizedString({ min: 1, max: 100 }).optional().meta({
      description: "Filter by city or province name",
      example: "Thành phố Hồ Chí Minh",
    }),
    ward: zSanitizedString({ min: 1, max: 100 }).optional().meta({
      description: "Filter by ward or commune name",
      example: "Phường Bến Nghé",
    }),
    search: zSanitizedString({ min: 1, max: 100 }).optional().meta({
      description:
        "Search keyword matching cinema venue name or street address",
      example: "Vincom",
    }),
    page: zNumericString({ min: 1, integer: true }).default(1).meta({
      description: "Page index (1-based)",
      example: 1,
    }),
    limit: zNumericString({ min: 1, max: 100, integer: true })
      .default(20)
      .meta({
        description: "Number of records per page (1..100)",
        example: 20,
      }),
  })
  .strict();

export type CinemaListQueryDtoType = z.infer<typeof cinemaListQuerySchema>;

/**
 * Data Transfer Object for public cinema venue discovery query parameters.
 */
export class CinemaListQueryDto extends createZodDto(cinemaListQuerySchema) {
  public static readonly zodSchema = cinemaListQuerySchema;
}
