import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

export class PayOSWebhookDataDto {
  @ApiProperty({ example: 123456, description: "PayOS unique order code" })
  @IsNumber()
  @IsNotEmpty()
  orderCode!: number;

  @ApiProperty({ example: 200000, description: "Payment amount in VND" })
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @ApiProperty({
    example: "Movie ticket booking payment",
    description: "Payment transaction description",
  })
  @IsString()
  description!: string;

  @ApiProperty({
    example: "123456789",
    description: "Receiving account number",
  })
  @IsString()
  accountNumber!: string;

  @ApiProperty({
    example: "PAYOS123456",
    description: "Transaction reference code",
  })
  @IsString()
  reference!: string;

  @ApiProperty({
    example: "2026-07-29 10:15:00",
    description: "Transaction timestamp (YYYY-MM-DD HH:mm:ss)",
  })
  @IsString()
  transactionDateTime!: string;

  @ApiProperty({ example: "VND", description: "Currency unit" })
  @IsString()
  currency!: string;

  @ApiProperty({ example: "link123", description: "Payment link ID" })
  @IsString()
  paymentLinkId!: string;

  @ApiProperty({ example: "00", description: "PayOS payment status code" })
  @IsString()
  code!: string;

  @ApiProperty({ example: "success", description: "Status description" })
  @IsString()
  desc!: string;

  @ApiProperty({ example: null, required: false, nullable: true })
  @IsOptional()
  counterAccountBankId?: string | null;

  @ApiProperty({ example: null, required: false, nullable: true })
  @IsOptional()
  counterAccountBankName?: string | null;

  @ApiProperty({ example: null, required: false, nullable: true })
  @IsOptional()
  counterAccountName?: string | null;

  @ApiProperty({ example: null, required: false, nullable: true })
  @IsOptional()
  counterAccountNumber?: string | null;

  @ApiProperty({ example: null, required: false, nullable: true })
  @IsOptional()
  virtualAccountName?: string | null;

  @ApiProperty({ example: null, required: false, nullable: true })
  @IsOptional()
  virtualAccountNumber?: string | null;
}

export class PayOSWebhookDto {
  @ApiProperty({ example: "00", description: "Webhook result code" })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: "success", description: "Result description" })
  @IsString()
  desc!: string;

  @ApiProperty({
    type: PayOSWebhookDataDto,
    description: "PayOS transaction payload details",
  })
  @ValidateNested()
  @Type(() => PayOSWebhookDataDto)
  data!: PayOSWebhookDataDto;

  @ApiProperty({
    example: "a1b2c3d4e5f6...",
    description: "PayOS HMAC-SHA256 verification signature",
  })
  @IsString()
  @IsNotEmpty()
  signature!: string;
}

export class PayOSWebhookResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: "Webhook processed successfully" })
  message!: string;
}
