import { ApiProperty } from "@nestjs/swagger";
import { IsEmailField } from "@/common/decorators";

export class ResendVerificationDto {
  @ApiProperty({
    example: "user@example.com",
    description: "Email address awaiting verification",
  })
  @IsEmailField()
  email!: string;
}
