import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";

export class VerifyEmailDto {
  @ApiProperty({
    example: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    description: "64-character hexadecimal email verification token",
  })
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  token!: string;
}
