import { z } from "zod";
import { createZodDto } from "@/common/dto";
import { zUuidV7 } from "@/common/schemas/zod-primitives";
import { catalogLanguageEnum } from "./movie-list-query.dto";

/**
 * Validation schema for GET /movies/:id path parameters.
 */
export const movieDetailParamSchema = z
  .object({
    id: zUuidV7().meta({
      description: "UUIDv7 identifier of the movie",
      example: "019fa8bc-8f4d-7000-b366-e691f45cfb91",
    }),
  })
  .strict();

export type MovieDetailParamDtoType = z.infer<typeof movieDetailParamSchema>;

/**
 * Data Transfer Object for movie details path parameters.
 */
export class MovieDetailParamDto extends createZodDto(movieDetailParamSchema) {
  public static readonly zodSchema = movieDetailParamSchema;
}

/**
 * Validation schema for GET /movies/:id query parameters.
 */
export const movieDetailQuerySchema = z
  .object({
    lang: catalogLanguageEnum.default("vi").meta({
      description: "Localization language code",
      example: "vi",
    }),
  })
  .strict();

export type MovieDetailQueryDtoType = z.infer<typeof movieDetailQuerySchema>;

/**
 * Data Transfer Object for movie details query parameters.
 */
export class MovieDetailQueryDto extends createZodDto(movieDetailQuerySchema) {
  public static readonly zodSchema = movieDetailQuerySchema;
}
