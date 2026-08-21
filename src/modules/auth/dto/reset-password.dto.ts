import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";
import { Match } from "@/common/decorators/match.decorator";
import { IsPassword } from "@/common/decorators/is-password.decorator";

export class ResetPasswordDto {
  @ApiProperty({
    example: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    description: "64-character password reset token received via email",
  })
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  token!: string;

  @ApiProperty({
    example: "NewPassword123!",
    description: "New strong password",
  })
  @IsPassword()
  password!: string;

  @ApiProperty({
    example: "NewPassword123!",
    description: "Must match new password",
  })
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  @Match("password", { message: i18nMsg("validation.passwordsMustMatch") })
  confirmPassword!: string;
}
