import { z } from "zod";
import { createZodDto } from "@/common/dto";
import {
  zNumericString,
  zSanitizedString,
  zUuidV7,
} from "@/common/schemas/zod-primitives";
import { i18nZodMsg } from "@/common/utils/i18n-message.util";
import { movieRatingEnum } from "@/database/schemas/enums.schema";

/**
 * Movie status filter enum conforming to strict RESTful kebab-case URL standards.
 */
export const movieStatusEnum = z.enum(["now-showing", "coming-soon"]);
export type MovieStatus = z.infer<typeof movieStatusEnum>;

/**
 * Supported catalog localization languages.
 */
export const catalogLanguageEnum = z.enum(["vi", "en"]);
export type CatalogLanguage = z.infer<typeof catalogLanguageEnum>;

/**
 * Validation schema for GET /movies query parameters.
 */
export const movieListQuerySchema = z
  .object({
    status: movieStatusEnum.optional().meta({
      description: "Filter by schedule status (kebab-case)",
      example: "now-showing",
    }),
    genreId: zUuidV7().optional().meta({
      description: "Filter by genre UUIDv7",
      example: "019fa8bc-8f4d-7000-b366-e691f45cfb01",
    }),
    rating: z
      .enum(
        movieRatingEnum.enumValues,
        i18nZodMsg("validation.isIn", {
          "0": movieRatingEnum.enumValues.join(", "),
        }),
      )
      .optional()
      .meta({
        description: "Filter by movie age rating",
        example: "PG_13",
      }),
    search: zSanitizedString({ min: 1, max: 100 }).optional().meta({
      description:
        "Search keyword matching Vietnamese and English movie titles",
      example: "Deadpool",
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
    lang: catalogLanguageEnum.default("vi").meta({
      description: "Localization language code",
      example: "vi",
    }),
  })
  .strict();

export type MovieListQueryDtoType = z.infer<typeof movieListQuerySchema>;

/**
 * Data Transfer Object for public movie catalog discovery query parameters.
 */
export class MovieListQueryDto extends createZodDto(movieListQuerySchema) {
  public static readonly zodSchema = movieListQuerySchema;
}
