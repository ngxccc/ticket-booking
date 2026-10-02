import { z } from "zod";
import { createZodDto } from "@/common/dto";

export const healthResponseSchema = z.object({
  status: z.string().meta({
    description: "System operational health status indicator",
    example: "ok",
  }),
  environment: z.string().optional().meta({
    description: "Current application runtime environment",
    example: "test",
  }),
});

export type HealthResponseDtoType = z.infer<typeof healthResponseSchema>;

export class HealthResponseDto extends createZodDto(healthResponseSchema) {}
