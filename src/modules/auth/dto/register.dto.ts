import { Equals, IsBoolean, IsNotEmpty, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { i18nMsg } from "@/common/utils/i18n-message.util";
import {
  IsEmailField,
  IsPassword,
  IsPhoneNumberField,
  Match,
} from "@/common/decorators";
import { sanitizeString } from "@/common/utils/sanitize.util";

export class RegisterDto {
  @IsEmailField()
  email!: string;

  @Transform(({ value }) => sanitizeString(value))
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  fullName!: string;

  @IsPhoneNumberField()
  phoneNumber!: string;

  @IsPassword()
  password!: string;

  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  @Match("password", { message: i18nMsg("validation.passwordsMustMatch") })
  confirmPassword!: string;

  @IsBoolean({ message: i18nMsg("validation.isBoolean") })
  @Equals(true, { message: i18nMsg("validation.mustAcceptTerms") })
  agreeTerms!: boolean;
}
