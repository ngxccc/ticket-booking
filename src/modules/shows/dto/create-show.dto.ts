import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsInt, IsUUID, Min } from "class-validator";

export class CreateShowDto {
  @ApiProperty({
    description: "UUIDv7 of the movie to be scheduled",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
  })
  @IsUUID("7")
  movieId!: string;

  @ApiProperty({
    description: "UUIDv7 of the cinema hall where the show takes place",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb90",
  })
  @IsUUID("7")
  hallId!: string;

  @ApiProperty({
    description: "ISO 8601 start timestamp with timezone",
    example: "2026-09-01T10:00:00.000Z",
  })
  @IsDateString()
  startTime!: string;

  @ApiProperty({
    description: "Base ticket price in VND",
    example: 100000,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  basePrice!: number;
}
