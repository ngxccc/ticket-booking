import { z } from "zod";
import { createZodDto } from "@/common/dto";
import { zUuidV7 } from "@/common/schemas/zod-primitives";
import { i18nZodMsg } from "@/common/utils/i18n-message.util";
import { paymentMethodEnum } from "@/database/schemas/enums.schema";

/**
 * Validation schema for booking confirmation requests.
 */
export const confirmBookingSchema = z
  .object({
    bookingId: zUuidV7().meta({
      description: "UUIDv7 of the pending reservation to confirm",
      example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
    }),
    orderCode: z
      .number(i18nZodMsg("validation.isInt"))
      .int(i18nZodMsg("validation.isInt"))
      .positive(i18nZodMsg("validation.isPositive"))
      .meta({
        description: "PayOS unique numerical order code",
        example: 123456,
      }),
    paymentMethod: z
      .enum(
        paymentMethodEnum.enumValues,
        i18nZodMsg("validation.isIn", {
          "0": paymentMethodEnum.enumValues.join(", "),
        }),
      )
      .meta({
        description: "Payment method used for the transaction",
        example: "PAYOS",
      }),
    transactionId: z
      .string(i18nZodMsg("validation.isString"))
      .min(1, i18nZodMsg("validation.isNotEmpty"))
      .meta({
        description: "External payment gateway transaction ID",
        example: "TXN-123456789",
      }),
    amount: z
      .number(i18nZodMsg("validation.isInt"))
      .int(i18nZodMsg("validation.isInt"))
      .positive(i18nZodMsg("validation.isPositive"))
      .meta({
        description: "Actual paid amount in VND",
        example: 200000,
      }),
  })
  .strict();

export type ConfirmBookingDtoType = z.infer<typeof confirmBookingSchema>;

/**
 * Data Transfer Object for confirming a reserved booking with payment.
 */
export class ConfirmBookingDto extends createZodDto(confirmBookingSchema) {
  public static readonly zodSchema = confirmBookingSchema;
}

export const confirmedTicketSchema = z.object({
  ticketId: z.string().meta({
    description: "UUIDv7 of the issued ticket",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
  }),
  ticketCode: z.string().meta({
    description: "Unique human-readable ticket verification code",
    example: "TKT-A1B2C3D4",
  }),
  showSeatId: z.string().meta({
    description: "UUIDv7 of the assigned show seat",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
  }),
  finalPrice: z.number().meta({
    description: "Ticket final price in VND",
    example: 100000,
  }),
});

export const confirmBookingResponseSchema = z.object({
  bookingId: z.string().meta({
    description: "UUIDv7 of the confirmed booking",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
  }),
  paymentId: z.string().meta({
    description: "Payment transaction identifier",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
  }),
  transactionId: z.string().meta({
    description: "Gateway transaction ID",
    example: "PAYOS-TX-12345",
  }),
  status: z.literal("confirmed").meta({
    description: "Confirmed booking status",
    example: "confirmed",
  }),
  confirmedAt: z.string().meta({
    description: "Confirmation timestamp in ISO 8601 UTC",
    example: "2026-07-28T12:45:00.000Z",
  }),
  totalPrice: z.number().meta({
    description: "Total paid amount in VND",
    example: 100000,
  }),
  tickets: z.array(confirmedTicketSchema).meta({
    description: "List of issued electronic tickets",
  }),
});

export type ConfirmedTicketDtoType = z.infer<typeof confirmedTicketSchema>;
export type ConfirmBookingResponseDtoType = z.infer<
  typeof confirmBookingResponseSchema
>;

export class ConfirmedTicketDto extends createZodDto(confirmedTicketSchema) {}
export class ConfirmBookingResponseDto extends createZodDto(
  confirmBookingResponseSchema,
) {}
