import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CustomThrottlerGuard } from "@/common/guards/throttler.guard";
import {
  ApiBadRequestResponseRfc9457,
  ApiOkResponseGeneric,
  ApiTooManyRequestsResponseRfc9457,
} from "@/common/decorators";
import { apiSuccess, type ApiResponse } from "@/common/utils/api-response.util";
import { CATALOG_ROUTES } from "./catalog.routes";
import { CinemasService } from "./cinemas.service";
import { CinemaListQueryDto, CinemaListResponseDto } from "./dto";

@ApiTags(CATALOG_ROUTES.CINEMAS)
@Controller(CATALOG_ROUTES.CINEMAS)
@UseGuards(CustomThrottlerGuard)
export class CinemasController {
  constructor(private readonly cinemasService: CinemasService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Discover cinema venues with city and name search filters",
  })
  @ApiOkResponseGeneric(CinemaListResponseDto)
  @ApiBadRequestResponseRfc9457()
  @ApiTooManyRequestsResponseRfc9457()
  async getCinemas(
    @Query() query: CinemaListQueryDto,
  ): Promise<ApiResponse<CinemaListResponseDto>> {
    const result = await this.cinemasService.findCinemas(query);
    return apiSuccess(result);
  }
}
