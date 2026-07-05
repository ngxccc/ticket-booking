import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";

export class LoginDto {
  @IsEmail({}, { message: i18nMsg("validation.isEmail") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  email!: string;

  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  @MinLength(8, { message: i18nMsg("validation.minLength") })
  password!: string;
}
