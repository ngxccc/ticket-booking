import { applyDecorators } from "@nestjs/common";
import { IsNumberString, Matches, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";
import { i18nMsg } from "@/common/utils/i18n-message.util";
import { sanitizeString } from "@/common/utils/sanitize.util";

export function IsPhoneNumberField() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) => sanitizeString(value)),
    IsNumberString({}, { message: i18nMsg("validation.isNumberString") }),
    MinLength(10, { message: i18nMsg("validation.minLength") }),
    MaxLength(10, { message: i18nMsg("validation.maxLength") }),
    Matches(/^(0[35789])\d{8}$/, {
      message: i18nMsg("validation.phoneNumberInvalid"),
    }),
  );
}
