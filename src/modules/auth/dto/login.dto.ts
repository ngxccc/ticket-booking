import { IsNotEmpty, IsString, MinLength } from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";
import { IsEmailField } from "@/common/decorators";

export class LoginDto {
  @IsEmailField()
  email!: string;

  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  @MinLength(8, { message: i18nMsg("validation.minLength") })
  password!: string;
}
