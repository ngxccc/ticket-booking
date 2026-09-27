import { z } from "zod";
import { createZodDto } from "./create-zod-dto.util";

export const paginationMetaSchema = z.object({
  page: z.number().int().positive().meta({
    description: "Current page index (1-based)",
    example: 1,
  }),
  limit: z.number().int().positive().meta({
    description: "Number of records per page",
    example: 20,
  }),
  total: z.number().int().nonnegative().meta({
    description: "Total number of matching records",
    example: 100,
  }),
  totalPages: z.number().int().nonnegative().meta({
    description: "Total number of calculated pages",
    example: 5,
  }),
});

export type PaginationMetaDtoType = z.infer<typeof paginationMetaSchema>;

/**
 * Standard pagination metadata DTO at the root envelope level.
 */
export class PaginationMetaDto extends createZodDto(paginationMetaSchema) {}
