import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class ReserveSeatsDto {
  @ApiProperty({
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
    description: "UUIDv7 of the scheduled movie show",
  })
  @IsUUID("7")
  showId!: string;

  @ApiProperty({
    example: [
      "019fa8bc-8f4d-7000-b366-e691f45cfb01",
      "019fa8bc-8f4d-7000-b366-e691f45cfb02",
    ],
    description: "Array of 1 to 6 seat UUIDv7s to reserve and lock",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsUUID("7", { each: true })
  seatIds!: string[];

  @ApiProperty({
    example: "DISCOUNT50",
    description: "Optional promotion or voucher code",
    required: false,
  })
  @IsOptional()
  @IsString()
  voucherCode?: string;
}

export class ReserveSeatsResponseDto {
  @ApiProperty({ example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f" })
  bookingId!: string;

  @ApiProperty({ example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f" })
  showId!: string;

  @ApiProperty({ example: 100000 })
  totalPrice!: number;

  @ApiProperty({ example: "pending_payment" })
  status!: string;

  @ApiProperty({ example: "2026-07-28T12:45:00.000Z" })
  expiresAt!: string;

  @ApiProperty({ example: ["019fa8bc-8f4d-7000-b366-e691f45cfb8f"] })
  seats!: string[];
}
