import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { i18nMsg } from "@/common/utils/i18n-message.util";

export class RefreshTokenDto {
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  refreshToken!: string;
}

export class RefreshResponseDto {
  @ApiProperty({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." })
  accessToken!: string;

  @ApiProperty({ example: "d9b2e8a1-3c5f-4a7b-8e9d-1f2a3b4c5d6e" })
  refreshToken!: string;
}
