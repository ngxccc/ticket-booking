import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";
import { IsPassword } from "@/common/decorators/is-password.decorator";

export class ChangePasswordDto {
  @ApiProperty({
    example: "CurrentPassword123!",
    description: "Current account password",
  })
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  @MaxLength(256, { message: i18nMsg("validation.maxLength") })
  currentPassword!: string;

  @ApiProperty({
    example: "NewSecurePassword456!",
    description: "New account password (must differ from current)",
  })
  @IsPassword()
  newPassword!: string;
}
