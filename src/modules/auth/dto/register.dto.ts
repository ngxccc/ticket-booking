import { ApiProperty } from "@nestjs/swagger";
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
  @ApiProperty({
    example: "user@example.com",
    description: "User email address",
  })
  @IsEmailField()
  email!: string;

  @ApiProperty({ example: "John Doe", description: "User full name" })
  @Transform(({ value }) => sanitizeString(value))
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  fullName!: string;

  @ApiProperty({
    example: "0912345678",
    description: "Valid 10-digit Vietnamese phone number",
  })
  @IsPhoneNumberField()
  phoneNumber!: string;

  @ApiProperty({
    example: "Password123!",
    description: "Strong password with letters, numbers, and symbols",
  })
  @IsPassword()
  password!: string;

  @ApiProperty({
    example: "Password123!",
    description: "Must match password exactly",
  })
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  @Match("password", { message: i18nMsg("validation.passwordsMustMatch") })
  confirmPassword!: string;

  @ApiProperty({ example: true, description: "Must accept terms of service" })
  @IsBoolean({ message: i18nMsg("validation.isBoolean") })
  @Equals(true, { message: i18nMsg("validation.mustAcceptTerms") })
  agreeTerms!: boolean;
}
