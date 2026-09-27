import { z } from "zod";
import { createZodDto } from "@/common/dto";
import { zUuidV7 } from "@/common/schemas/zod-primitives";
import { i18nZodMsg } from "@/common/utils/i18n-message.util";

/**
 * Validation schema for seat reservation requests.
 */
export const reserveSeatsSchema = z
  .object({
    showId: zUuidV7().meta({
      description: "UUIDv7 of the scheduled movie show",
      example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
    }),
    seatIds: z
      .array(zUuidV7())
      .min(1, i18nZodMsg("validation.isNotEmpty"))
      .max(6, i18nZodMsg("validation.maxLength", { "0": 6 }))
      .meta({
        description: "Array of 1 to 6 seat UUIDv7s to reserve and lock",
        example: [
          "019fa8bc-8f4d-7000-b366-e691f45cfb01",
          "019fa8bc-8f4d-7000-b366-e691f45cfb02",
        ],
      }),
    voucherCode: z.string(i18nZodMsg("validation.isString")).optional().meta({
      description: "Optional promotion or voucher code",
      example: "DISCOUNT50",
    }),
  })
  .strict();

export type ReserveSeatsDtoType = z.infer<typeof reserveSeatsSchema>;

/**
 * Data Transfer Object for reserving and locking cinema seats.
 */
export class ReserveSeatsDto extends createZodDto(reserveSeatsSchema) {
  public static readonly zodSchema = reserveSeatsSchema;
}

export const reserveSeatsResponseSchema = z.object({
  bookingId: z.string().meta({
    description: "UUIDv7 of the created booking reservation",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
  }),
  showId: z.string().meta({
    description: "UUIDv7 of the scheduled show",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
  }),
  totalPrice: z.number().meta({
    description: "Total price in VND",
    example: 100000,
  }),
  status: z.string().meta({
    description: "Booking reservation status",
    example: "pending_payment",
  }),
  expiresAt: z.string().meta({
    description: "Expiration timestamp for seat hold (10 mins)",
    example: "2026-07-28T12:45:00.000Z",
  }),
  seats: z.array(z.string()).meta({
    description: "List of reserved seat UUIDv7 identifiers",
    example: ["019fa8bc-8f4d-7000-b366-e691f45cfb8f"],
  }),
});

export type ReserveSeatsResponseDtoType = z.infer<
  typeof reserveSeatsResponseSchema
>;

export class ReserveSeatsResponseDto extends createZodDto(
  reserveSeatsResponseSchema,
) {}
