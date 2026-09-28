import { z } from "zod";
import { createZodDto } from "@/common/dto/create-zod-dto.util";
import { zUuidV7 } from "@/common/schemas/zod-primitives";

export const showSeatsParamSchema = z
  .object({
    id: zUuidV7().meta({
      description: "Showtime unique identifier (UUIDv7)",
      example: "01923456-789a-7bc0-8123-456789abcdef",
    }),
  })
  .strict();

export class ShowSeatsParamDto extends createZodDto(showSeatsParamSchema) {}
