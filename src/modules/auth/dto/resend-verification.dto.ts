import { IsEmail, IsNotEmpty } from "class-validator";
import { Transform } from "class-transformer";
import { i18nMsg } from "@/common/utils/i18n-message.util";
import { sanitizeString } from "@/common/utils/sanitize.util";

export class ResendVerificationDto {
  @Transform(({ value }) => {
    const sanitized = sanitizeString(value);
    return typeof sanitized === "string" ? sanitized.toLowerCase() : sanitized;
  })
  @IsEmail({}, { message: i18nMsg("validation.isEmail") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  email!: string;
}
