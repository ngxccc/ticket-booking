import { z } from "zod";
import { createZodDto } from "@/common/dto";
import { i18nZodMsg } from "@/common/utils/i18n-message.util";

/**
 * Validation schema for PayOS webhook inner transaction details.
 */
export const payOSWebhookDataSchema = z
  .object({
    orderCode: z.number(i18nZodMsg("validation.isInt")).meta({
      description: "PayOS unique numerical order code",
      example: 123456,
    }),
    amount: z.number(i18nZodMsg("validation.isInt")).meta({
      description: "Transaction amount in VND",
      example: 200000,
    }),
    description: z.string(i18nZodMsg("validation.isString")).meta({
      description: "Payment transfer description",
      example: "Thanh toan ve xem phim",
    }),
    accountNumber: z.string(i18nZodMsg("validation.isString")).meta({
      description: "PayOS receiving bank account number",
      example: "1234567890",
    }),
    reference: z.string(i18nZodMsg("validation.isString")).meta({
      description: "Banking system transaction reference",
      example: "FT2401019999",
    }),
    transactionDateTime: z.string(i18nZodMsg("validation.isString")).meta({
      description: "Transaction datetime formatted string",
      example: "2026-08-30 10:00:00",
    }),
    currency: z.string(i18nZodMsg("validation.isString")).meta({
      description: "Currency unit",
      example: "VND",
    }),
    paymentLinkId: z.string(i18nZodMsg("validation.isString")).meta({
      description: "Payment link unique ID",
      example: "link123",
    }),
    code: z.string(i18nZodMsg("validation.isString")).meta({
      description: "PayOS payment status code",
      example: "00",
    }),
    desc: z.string(i18nZodMsg("validation.isString")).meta({
      description: "Status description",
      example: "success",
    }),
    counterAccountBankId: z
      .string(i18nZodMsg("validation.isString"))
      .nullable()
      .optional(),
    counterAccountBankName: z
      .string(i18nZodMsg("validation.isString"))
      .nullable()
      .optional(),
    counterAccountName: z
      .string(i18nZodMsg("validation.isString"))
      .nullable()
      .optional(),
    counterAccountNumber: z
      .string(i18nZodMsg("validation.isString"))
      .nullable()
      .optional(),
    virtualAccountName: z
      .string(i18nZodMsg("validation.isString"))
      .nullable()
      .optional(),
    virtualAccountNumber: z
      .string(i18nZodMsg("validation.isString"))
      .nullable()
      .optional(),
  })
  .strict();

export type PayOSWebhookDataType = z.infer<typeof payOSWebhookDataSchema>;

/**
 * Data Transfer Object for PayOS transaction payload details.
 */
export class PayOSWebhookDataDto extends createZodDto(payOSWebhookDataSchema) {
  public static readonly zodSchema = payOSWebhookDataSchema;
}

/**
 * Validation schema for PayOS webhook notification payload.
 */
export const payOSWebhookSchema = z
  .object({
    code: z
      .string(i18nZodMsg("validation.isString"))
      .min(1, i18nZodMsg("validation.isNotEmpty"))
      .meta({
        description: "Webhook response code",
        example: "00",
      }),
    desc: z.string(i18nZodMsg("validation.isString")).meta({
      description: "Webhook response description",
      example: "success",
    }),
    data: payOSWebhookDataSchema,
    signature: z
      .string(i18nZodMsg("validation.isString"))
      .min(1, i18nZodMsg("validation.isNotEmpty"))
      .meta({
        description: "PayOS HMAC-SHA256 signature",
        example: "a1b2c3d4e5f6...",
      }),
  })
  .strict();

export type PayOSWebhookDtoType = z.infer<typeof payOSWebhookSchema>;

/**
 * Data Transfer Object for PayOS webhook notification payload.
 */
export class PayOSWebhookDto extends createZodDto(payOSWebhookSchema) {
  public static readonly zodSchema = payOSWebhookSchema;
}

export const payOSWebhookResponseSchema = z.object({
  success: z.boolean().meta({
    description: "Webhook processing status",
    example: true,
  }),
  message: z.string().meta({
    description: "Status message",
    example: "Webhook processed successfully",
  }),
});

export type PayOSWebhookResponseDtoType = z.infer<
  typeof payOSWebhookResponseSchema
>;

export class PayOSWebhookResponseDto extends createZodDto(
  payOSWebhookResponseSchema,
) {}
