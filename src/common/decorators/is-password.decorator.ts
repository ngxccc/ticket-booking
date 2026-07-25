import { applyDecorators } from "@nestjs/common";
import { IsString, MinLength, MaxLength, Matches } from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";

export function IsPassword() {
  return applyDecorators(
    IsString({ message: i18nMsg("validation.isString") }),
    MinLength(8, { message: i18nMsg("validation.minLength") }),
    MaxLength(128, { message: i18nMsg("validation.maxLength") }),
    Matches(/[A-Z]/, {
      message: i18nMsg("validation.passwordMustContainUppercase"),
    }),
    Matches(/[0-9]/, {
      message: i18nMsg("validation.passwordMustContainNumber"),
    }),
    Matches(/[^a-zA-Z0-9]/, {
      message: i18nMsg("validation.passwordMustContainSpecialChar"),
    }),
  );
}
