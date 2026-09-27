import { z } from "zod";
import { createZodDto } from "@/common/dto";

export const healthResponseSchema = z.object({
  status: z.string().meta({
    description: "System operational health status indicator",
    example: "ok",
  }),
});

export type HealthResponseDtoType = z.infer<typeof healthResponseSchema>;

export class HealthResponseDto extends createZodDto(healthResponseSchema) {}
