import { IsEmailField } from "@/common/decorators";

export class ResendVerificationDto {
  @IsEmailField()
  email!: string;
}
