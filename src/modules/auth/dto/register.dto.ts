import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";
import { Match } from "@/common/decorators/match.decorator";

export class RegisterDto {
  @IsEmail({}, { message: i18nMsg("validation.isEmail") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  email!: string;

  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  fullName!: string;

  @IsNumberString({}, { message: i18nMsg("validation.isNumberString") })
  @MinLength(10, { message: i18nMsg("validation.minLength") })
  @MaxLength(10, { message: i18nMsg("validation.maxLength") })
  @Matches(/^(0[35789])\d{8}$/, {
    message: i18nMsg("validation.phoneNumberInvalid"),
  })
  phoneNumber!: string;

  @IsString({ message: i18nMsg("validation.isString") })
  @MinLength(8, { message: i18nMsg("validation.minLength") })
  @Matches(/[A-Z]/, { message: i18nMsg("validation.matches") })
  @Matches(/[0-9]/, { message: i18nMsg("validation.matches") })
  password!: string;

  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  @Match("password", { message: i18nMsg("validation.passwordsMustMatch") })
  confirmPassword!: string;

  @IsBoolean({ message: i18nMsg("validation.isBoolean") })
  @Equals(true, { message: i18nMsg("validation.mustAcceptTerms") })
  agreeTerms!: boolean;
}
