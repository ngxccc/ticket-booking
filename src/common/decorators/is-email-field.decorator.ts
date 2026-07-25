import { applyDecorators } from "@nestjs/common";
import { IsEmail, IsNotEmpty } from "class-validator";
import { Transform } from "class-transformer";
import { i18nMsg } from "@/common/utils/i18n-message.util";
import { sanitizeString } from "@/common/utils/sanitize.util";

export function IsEmailField() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => {
      const sanitized = sanitizeString(value);
      return typeof sanitized === "string"
        ? sanitized.trim().toLowerCase()
        : sanitized;
    }),
    IsEmail({}, { message: i18nMsg("validation.isEmail") }),
    IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") }),
  );
}
