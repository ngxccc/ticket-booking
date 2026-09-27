import { z } from "zod";
import { createZodDto } from "@/common/dto";
import { zEmail } from "@/common/schemas/zod-primitives";
import { i18nZodMsg } from "@/common/utils/i18n-message.util";

/**
 * Zod validation schema for user login authentication requests.
 */
export const loginSchema = z
  .object({
    email: zEmail().meta({
      description: "Registered user email address",
      example: "user@example.com",
    }),
    password: z
      .string(i18nZodMsg("validation.isString"))
      .min(8, { message: i18nZodMsg("validation.minLength", { "0": 8 }) })
      .meta({
        description: "Account password",
        example: "Password123!",
      }),
  })
  .strict();
export type LoginDtoType = z.infer<typeof loginSchema>;

/**
 * Data Transfer Object for user login request.
 */
export class LoginDto extends createZodDto(loginSchema) {
  public static readonly zodSchema = loginSchema;
}
export const userInfoSchema = z.object({
  id: z.string().meta({
    description: "User UUIDv7 identifier",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
  }),
  email: zEmail().meta({
    description: "User email address",
    example: "user@example.com",
  }),
  fullName: z.string().meta({
    description: "User full name",
    example: "John Doe",
  }),
  role: z.string().meta({
    description: "User role in system",
    example: "USER",
  }),
});

export const loginResponseSchema = z.object({
  accessToken: z.string().meta({
    description: "Short-lived JWT access token (15 mins)",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  }),
  refreshToken: z.string().meta({
    description: "Long-lived refresh token (7 days)",
    example: "d9b2e8a1-3c5f-4a7b-8e9d-1f2a3b4c5d6e",
  }),
  user: userInfoSchema,
});

export type UserInfoDtoType = z.infer<typeof userInfoSchema>;
export type LoginResponseDtoType = z.infer<typeof loginResponseSchema>;

export class UserInfoDto extends createZodDto(userInfoSchema) {}
export class LoginResponseDto extends createZodDto(loginResponseSchema) {}
