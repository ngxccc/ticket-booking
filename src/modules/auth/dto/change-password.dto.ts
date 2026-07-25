import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";
import { IsPassword } from "@/common/decorators/is-password.decorator";

export class ChangePasswordDto {
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  @MaxLength(256, { message: i18nMsg("validation.maxLength") })
  currentPassword!: string;

  @IsPassword()
  newPassword!: string;
}
