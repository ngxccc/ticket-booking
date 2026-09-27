import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { I18nBadRequestException } from "@/common/exceptions";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CustomThrottlerGuard } from "../../common/guards/throttler.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import {
  ApiCreatedResponseGeneric,
  ApiBadRequestResponseRfc9457,
  ApiUnauthorizedResponseRfc9457,
  ApiConflictResponseRfc9457,
  ApiTooManyRequestsResponseRfc9457,
} from "../../common/decorators";
import {
  apiSuccess,
  type ApiResponse,
} from "../../common/utils/api-response.util";
import { BOOKING_ROUTES } from "./booking.routes";
import type { BookingService } from "./booking.service";
import type { ReserveSeatsDto } from "./dto/reserve-seats.dto";
import { ReserveSeatsResponseDto } from "./dto/reserve-seats.dto";
import type { ConfirmBookingDto } from "./dto/confirm-booking.dto";
import { ConfirmBookingResponseDto } from "./dto/confirm-booking.dto";

import { HTTP_HEADERS } from "@/common/constants/header.constants";

@ApiTags(BOOKING_ROUTES.BASE)
@Controller({ path: BOOKING_ROUTES.BASE, version: "1" })
@UseGuards(CustomThrottlerGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Post(BOOKING_ROUTES.RESERVE)
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: { limit: 10, ttl: 60000 },
  })
  @ApiOperation({
    summary: "Reserve show seats with temporary lock",
    description:
      "Acquires a 10-minute temporary lock on selected seats using Redlock and pessimistic database row locking.",
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: HTTP_HEADERS.IDEMPOTENCY_KEY,
    required: true,
    description:
      "Client-generated UUID idempotency key for preventing duplicate booking requests",
  })
  @ApiCreatedResponseGeneric(ReserveSeatsResponseDto)
  @ApiBadRequestResponseRfc9457()
  @ApiUnauthorizedResponseRfc9457()
  @ApiConflictResponseRfc9457()
  @ApiTooManyRequestsResponseRfc9457()
  async reserveSeats(
    @CurrentUser("sub") userId: string,
    @Body() dto: ReserveSeatsDto,
    @Headers(HTTP_HEADERS.IDEMPOTENCY_KEY) idempotencyKey?: string,
  ): Promise<ApiResponse<ReserveSeatsResponseDto>> {
    if (!idempotencyKey) {
      throw new I18nBadRequestException("booking.IDEMPOTENCY_KEY_REQUIRED");
    }

    const result = (await this.bookingService.reserveSeats(
      userId,
      dto,
      idempotencyKey,
    )) as ReserveSeatsResponseDto;

    return apiSuccess(result);
  }

  @Post(BOOKING_ROUTES.CONFIRM)
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: { limit: 10, ttl: 60000 },
  })
  @ApiOperation({
    summary: "Confirm booking and record payment",
    description:
      "Confirms a pending reservation, records payment history, and transitions seats to booked status.",
  })
  @ApiBearerAuth()
  @ApiHeader({
    name: HTTP_HEADERS.IDEMPOTENCY_KEY,
    required: true,
    description:
      "Client-generated UUID idempotency key for preventing duplicate payment confirmations",
  })
  @ApiCreatedResponseGeneric(ConfirmBookingResponseDto)
  @ApiBadRequestResponseRfc9457()
  @ApiUnauthorizedResponseRfc9457()
  @ApiConflictResponseRfc9457()
  @ApiTooManyRequestsResponseRfc9457()
  async confirmBooking(
    @CurrentUser("sub") userId: string,
    @Body() dto: ConfirmBookingDto,
    @Headers(HTTP_HEADERS.IDEMPOTENCY_KEY) idempotencyKey?: string,
  ): Promise<ApiResponse<ConfirmBookingResponseDto>> {
    if (!idempotencyKey) {
      throw new I18nBadRequestException("booking.IDEMPOTENCY_KEY_REQUIRED");
    }

    const result = await this.bookingService.confirmBooking(
      userId,
      dto,
      idempotencyKey,
    );

    return apiSuccess(result);
  }
}
