import { z } from "zod";
import { createZodDto } from "./create-zod-dto.util";

export const invalidParamSchema = z.object({
  name: z.string().meta({
    description: "Invalid field name",
    example: "email",
  }),
  reason: z.string().meta({
    description: "Detailed reason for the validation error",
    example: "Invalid email address format",
  }),
});

export const rfc9457ErrorResponseSchema = z.object({
  type: z.string().meta({
    description: "Standard HTTP error type URI",
    example: "http://localhost:3000/errors/bad-request",
  }),
  title: z.string().meta({
    description: "Standard HTTP error title",
    example: "Bad Request",
  }),
  status: z.number().meta({
    description: "HTTP status code",
    example: 400,
  }),
  detail: z.string().meta({
    description: "Detailed error message",
    example: "Submitted data format is invalid",
  }),
  instance: z.string().meta({
    description: "API request path that triggered the error",
    example: "/auth/register",
  }),
  code: z.string().optional().meta({
    description: "Machine-readable error code",
    example: "CART_OUT_OF_STOCK",
  }),
  invalidParams: z.array(invalidParamSchema).optional().meta({
    description: "List of invalid parameters that failed validation",
  }),
  timestamp: z.string().meta({
    description: "Timestamp when error occurred in ISO 8601 format",
    example: "2026-07-25T02:45:00.000Z",
  }),
});

export type InvalidParamDtoType = z.infer<typeof invalidParamSchema>;
export type Rfc9457ErrorResponseDtoType = z.infer<
  typeof rfc9457ErrorResponseSchema
>;

export class InvalidParamDto extends createZodDto(invalidParamSchema) {}
export class Rfc9457ErrorResponseDto extends createZodDto(
  rfc9457ErrorResponseSchema,
) {}
