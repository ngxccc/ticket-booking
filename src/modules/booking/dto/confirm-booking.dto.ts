import { IsOptional, IsString, IsUUID } from "class-validator";

export class ConfirmBookingDto {
  @IsUUID("7")
  bookingId!: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
