import { IsNotEmpty, IsString, Matches, MinLength } from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";
import { Match } from "@/common/decorators/match.decorator";

export class ResetPasswordDto {
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  token!: string;

  @IsString({ message: i18nMsg("validation.isString") })
  @MinLength(8, { message: i18nMsg("validation.minLength") })
  @Matches(/[A-Z]/, {
    message: i18nMsg("validation.passwordMustContainUppercase"),
  })
  @Matches(/[0-9]/, {
    message: i18nMsg("validation.passwordMustContainNumber"),
  })
  password!: string;

  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  @Match("password", { message: i18nMsg("validation.passwordsMustMatch") })
  confirmPassword!: string;
}
