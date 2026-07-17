import { IsNotEmpty, IsString } from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";

export class VerifyEmailDto {
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  token!: string;
}
