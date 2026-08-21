import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUUID,
} from "class-validator";
import {
  paymentMethodEnum,
  type PaymentMethod,
} from "@/database/schemas/enums.schema";
import { i18nMsg } from "@/common/utils/i18n-message.util";
import { TransformEnum } from "@/common/decorators";

export class ConfirmBookingDto {
  @ApiProperty({
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
    description: "UUIDv7 of the pending reservation to confirm",
  })
  @IsUUID("7", { message: i18nMsg("validation.isUuid") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  bookingId!: string;

  @ApiProperty({
    example: 123456,
    description: "PayOS unique numerical order code",
  })
  @Type(() => Number)
  @IsInt({ message: i18nMsg("validation.isInt") })
  @IsPositive({ message: i18nMsg("validation.isPositive") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  orderCode!: number;

  @ApiProperty({
    example: "PAYOS",
    enum: ["PAYOS", "CASH", "VNPAY", "MOMO", "ZALOPAY"],
    description: "Payment method used for the transaction",
  })
  @TransformEnum(paymentMethodEnum.enumValues)
  paymentMethod!: PaymentMethod;

  @ApiProperty({
    example: "TXN-123456789",
    description: "External payment gateway transaction ID",
  })
  @IsString({ message: i18nMsg("validation.isString") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  transactionId!: string;

  @ApiProperty({
    example: 200000,
    description: "Actual paid amount in VND",
  })
  @Type(() => Number)
  @IsInt({ message: i18nMsg("validation.isInt") })
  @IsPositive({ message: i18nMsg("validation.isPositive") })
  @IsNotEmpty({ message: i18nMsg("validation.isNotEmpty") })
  amount!: number;
}

export class ConfirmedTicketDto {
  @ApiProperty({ example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f" })
  ticketId!: string;

  @ApiProperty({ example: "TKT-A1B2C3D4" })
  ticketCode!: string;

  @ApiProperty({ example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f" })
  showSeatId!: string;

  @ApiProperty({ example: 100000 })
  finalPrice!: number;
}

export class ConfirmBookingResponseDto {
  @ApiProperty({ example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f" })
  bookingId!: string;

  @ApiProperty({ example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f" })
  paymentId!: string;

  @ApiProperty({ example: "PAYOS-TX-12345" })
  transactionId!: string;

  @ApiProperty({ example: "confirmed" })
  status!: "confirmed";

  @ApiProperty({ example: "2026-07-28T12:45:00.000Z" })
  confirmedAt!: string; // ISO 8601 Timestamp

  @ApiProperty({ example: 100000 })
  totalPrice!: number;

  @ApiProperty({ type: [ConfirmedTicketDto] })
  tickets!: ConfirmedTicketDto[];
}
