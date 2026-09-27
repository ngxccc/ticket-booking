import { z } from "zod";
import { createZodDto } from "@/common/dto";
import { i18nZodMsg } from "@/common/utils/i18n-message.util";

/**
 * Zod validation schema for token refresh requests.
 */
export const refreshTokenSchema = z
  .object({
    refreshToken: z
      .string(i18nZodMsg("validation.isString"))
      .min(1, { message: i18nZodMsg("validation.isNotEmpty") })
      .meta({
        description: "Active refresh token string",
        example: "d9b2e8a1-3c5f-4a7b-8e9d-1f2a3b4c5d6e",
      }),
  })
  .strict();
export type RefreshTokenDtoType = z.infer<typeof refreshTokenSchema>;

/**
 * Data Transfer Object for refreshing JWT authentication tokens.
 */
export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {
  public static readonly zodSchema = refreshTokenSchema;
}

export const refreshResponseSchema = z.object({
  accessToken: z.string().meta({
    description: "New short-lived JWT access token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  }),
  refreshToken: z.string().meta({
    description: "New rotated refresh token",
    example: "d9b2e8a1-3c5f-4a7b-8e9d-1f2a3b4c5d6e",
  }),
});
export type RefreshResponseDtoType = z.infer<typeof refreshResponseSchema>;

export class RefreshResponseDto extends createZodDto(refreshResponseSchema) {}
