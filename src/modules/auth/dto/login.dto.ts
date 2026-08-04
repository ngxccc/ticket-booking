import { ApiProperty } from "@nestjs/swagger";
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

export class UserInfoDto {
  @ApiProperty({ example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f" })
  id!: string;

  @ApiProperty({ example: "user@example.com" })
  email!: string;

  @ApiProperty({ example: "John Doe" })
  fullName!: string;

  @ApiProperty({ example: "USER" })
  role!: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  accessToken!: string;

  @ApiProperty({ example: "d9b2e8a1-3c5f-4a7b-8e9d-1f2a3b4c5d6e" })
  refreshToken!: string;

  @ApiProperty({ type: UserInfoDto })
  user!: UserInfoDto;
}
