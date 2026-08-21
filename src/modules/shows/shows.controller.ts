import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CustomThrottlerGuard } from "@/common/guards/throttler.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { Roles } from "@/common/decorators/roles.decorator";
import {
  ApiCreatedResponseGeneric,
  ApiBadRequestResponseRfc9457,
  ApiUnauthorizedResponseRfc9457,
  ApiForbiddenResponseRfc9457,
  ApiConflictResponseRfc9457,
  ApiTooManyRequestsResponseRfc9457,
  ApiNotFoundResponseRfc9457,
} from "@/common/decorators";
import { apiSuccess, type ApiResponse } from "@/common/utils/api-response.util";
import { SHOWS_ROUTES } from "./shows.routes";
import { ShowsService } from "./shows.service";
import { CreateShowDto } from "./dto/create-show.dto";
import { ShowResponseDto } from "./dto/show-response.dto";

@ApiTags(SHOWS_ROUTES.BASE)
@Controller(SHOWS_ROUTES.BASE)
@UseGuards(CustomThrottlerGuard)
export class ShowsController {
  constructor(private readonly showsService: ShowsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Create showtime with pre-allocated seats",
    description:
      "Admin endpoint to schedule a showtime, calculate end time, check 15m schedule collision, and pre-allocate seats.",
  })
  @ApiCreatedResponseGeneric(ShowResponseDto)
  @ApiBadRequestResponseRfc9457()
  @ApiUnauthorizedResponseRfc9457()
  @ApiForbiddenResponseRfc9457()
  @ApiNotFoundResponseRfc9457()
  @ApiConflictResponseRfc9457()
  @ApiTooManyRequestsResponseRfc9457()
  async createShow(
    @Body() dto: CreateShowDto,
  ): Promise<ApiResponse<ShowResponseDto>> {
    const show = await this.showsService.createShow(dto);
    return apiSuccess(show);
  }
}
