import { z } from "zod";
import { createZodDto, paginationMetaSchema } from "@/common/dto";

export const cinemaResponseSchema = z.object({
  id: z.string().meta({
    description: "UUIDv7 identifier of the cinema venue",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfc01",
  }),
  name: z.string().meta({
    description: "Name of the cinema venue",
    example: "CGV Vincom Đồng Khởi",
  }),
  city: z.string().meta({
    description: "City or province name",
    example: "Thành phố Hồ Chí Minh",
  }),
  ward: z.string().meta({
    description: "Ward or commune name",
    example: "Phường Bến Nghé",
  }),
  streetAddress: z.string().meta({
    description: "Detailed street and building address",
    example: "Tầng 5, TTTM Vincom Center, 72 Lê Thánh Tôn",
  }),
  postalCode: z.string().nullable().meta({
    description: "5-digit postal code",
    example: "70000",
  }),
  latitude: z.string().nullable().meta({
    description: "GPS Latitude",
    example: "10.77810000",
  }),
  longitude: z.string().nullable().meta({
    description: "GPS Longitude",
    example: "106.70250000",
  }),
  totalHalls: z.number().meta({
    description: "Total number of active screening halls",
    example: 7,
  }),
});
export const cinemaListResponseSchema = z.object({
  data: z.array(cinemaResponseSchema),
  meta: paginationMetaSchema,
});

export type CinemaResponseDtoType = z.infer<typeof cinemaResponseSchema>;
export type CinemaListResponseDtoType = z.infer<
  typeof cinemaListResponseSchema
>;

export class CinemaResponseDto extends createZodDto(cinemaResponseSchema) {}
export class CinemaListResponseDto extends createZodDto(
  cinemaListResponseSchema,
) {}
