import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsInt,
  IsUUID,
  Matches,
  Min,
} from "class-validator";
import { SHOWS_CONSTANTS } from "../shows.constants";

export class CreateShowBatchDto {
  @ApiProperty({
    description: "UUIDv7 of the movie to be scheduled",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
  })
  @IsUUID("7")
  movieId!: string;

  @ApiProperty({
    description: "UUIDv7 of the cinema hall where shows take place",
    example: "019fa8bc-8f4d-7000-b366-e691f45cfb90",
  })
  @IsUUID("7")
  hallId!: string;

  @ApiProperty({
    description: "Start date of the batch schedule (YYYY-MM-DD)",
    example: "2026-09-01",
  })
  @IsDateString()
  startDate!: string;

  @ApiProperty({
    description: "End date of the batch schedule (inclusive, YYYY-MM-DD)",
    example: "2026-09-03",
  })
  @IsDateString()
  endDate!: string;

  @ApiProperty({
    description: "Array of recurring daily time slots in 24-hour HH:mm format",
    example: ["10:00", "14:30", "19:00"],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(SHOWS_CONSTANTS.MAX_SLOTS_PER_DAY)
  @Matches(SHOWS_CONSTANTS.TIME_SLOT_REGEX, {
    each: true,
    message: "Each time slot must be in 24-hour HH:mm format (00:00 - 23:59)",
  })
  timeSlots!: string[];

  @ApiProperty({
    description: "Base ticket price in VND",
    example: 100000,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  basePrice!: number;
}
