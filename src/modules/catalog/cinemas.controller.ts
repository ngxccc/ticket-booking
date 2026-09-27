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
  ApiOkResponsePaginated,
  ApiTooManyRequestsResponseRfc9457,
} from "@/common/decorators";
import { apiSuccess, type ApiResponse } from "@/common/utils/api-response.util";
import { CATALOG_ROUTES } from "./catalog.routes";
import { CinemasService } from "./cinemas.service";
import type { CinemaListQueryDto, PaginationMetaDto } from "./dto";
import { CinemaResponseDto } from "./dto";

@ApiTags(CATALOG_ROUTES.CINEMAS)
@Controller({ path: CATALOG_ROUTES.CINEMAS, version: "1" })
@UseGuards(CustomThrottlerGuard)
export class CinemasController {
  constructor(private readonly cinemasService: CinemasService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Discover cinema venues with city and name search filters",
  })
  @ApiOkResponsePaginated(CinemaResponseDto)
  @ApiBadRequestResponseRfc9457()
  @ApiTooManyRequestsResponseRfc9457()
  async getCinemas(
    @Query() query: CinemaListQueryDto,
  ): Promise<ApiResponse<CinemaResponseDto[], PaginationMetaDto>> {
    const { data, meta } = await this.cinemasService.findCinemas(query);
    return apiSuccess(data, meta);
  }
}
