import { ApiProperty } from "@nestjs/swagger";

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
