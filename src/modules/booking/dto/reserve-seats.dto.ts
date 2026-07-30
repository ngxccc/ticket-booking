import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class ReserveSeatsDto {
  @IsUUID("7")
  showId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsUUID("7", { each: true })
  seatIds!: string[];

  @IsOptional()
  @IsString()
  voucherCode?: string;
}
