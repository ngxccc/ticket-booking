import { IsEmailField } from "@/common/decorators";

export class ForgotPasswordDto {
  @IsEmailField()
  email!: string;
}
