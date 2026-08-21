import { ApiProperty } from "@nestjs/swagger";
import { IsEmailField } from "@/common/decorators";

export class ForgotPasswordDto {
  @ApiProperty({
    example: "user@example.com",
    description: "Email address associated with account",
  })
  @IsEmailField()
  email!: string;
}
