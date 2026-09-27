import { z } from "zod";
import { createZodDto } from "@/common/dto";

export const userResponseSchema = z.object({
  id: z.string().meta({
    description: "UUIDv7 identifier of the user",
    example: "123e4567-e89b-12d3-a456-426614174000",
  }),
  email: z.string().meta({
    description: "User registered email address",
    example: "user@example.com",
  }),
  fullName: z.string().meta({
    description: "User full display name",
    example: "John Doe",
  }),
  role: z.string().meta({
    description: "System RBAC role assignment",
    example: "user",
  }),
  isVerified: z.boolean().meta({
    description:
      "True if user email is verified (status !== 'pending_verification')",
    example: true,
  }),
  status: z.string().meta({
    description: "Account lifecycle status",
    example: "active",
  }),
});

export type UserResponseDtoType = z.infer<typeof userResponseSchema>;

export class UserResponseDto extends createZodDto(userResponseSchema) {}
