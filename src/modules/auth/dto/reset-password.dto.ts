import { z } from "zod";
import { createZodDto } from "@/common/dto";
import { zPassword } from "@/common/schemas/zod-primitives";
import { i18nZodMsg } from "@/common/utils/i18n-message.util";

/**
 * Validation schema for password reset verification requests.
 */
export const resetPasswordSchema = z
  .object({
    token: z
      .string(i18nZodMsg("validation.isString"))
      .min(1, { message: i18nZodMsg("validation.isNotEmpty") })
      .meta({
        description: "64-character password reset token received via email",
        example:
          "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      }),
    password: zPassword().meta({
      description: "New strong password",
      example: "NewPassword123!",
    }),
    confirmPassword: z
      .string(i18nZodMsg("validation.isString"))
      .min(1, { message: i18nZodMsg("validation.isNotEmpty") })
      .meta({
        description: "Must match new password",
        example: "NewPassword123!",
      }),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: i18nZodMsg("validation.passwordsMustMatch"),
    path: ["confirmPassword"],
  });

export type ResetPasswordDtoType = z.infer<typeof resetPasswordSchema>;

/**
 * Data Transfer Object for resetting forgotten account password.
 */
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {
  public static readonly zodSchema = resetPasswordSchema;
}
