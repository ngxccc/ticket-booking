import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { extractClientMetadata } from "@/common/utils/client-info.util";
import { Throttle } from "@nestjs/throttler";
import { CustomThrottlerGuard } from "@/common/guards/throttler.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import {
  ApiCreatedResponseGeneric,
  ApiOkResponseGeneric,
  ApiBadRequestResponseRfc9457,
  ApiUnauthorizedResponseRfc9457,
  ApiConflictResponseRfc9457,
  ApiInternalServerErrorResponseRfc9457,
} from "@/common/decorators";
import type { ApiResponse } from "@/common/utils/api-response.util";
import { AUTH_ROUTES } from "./auth.routes";
import { AuthService } from "./auth.service";
import {
  LoginDto,
  LoginResponseDto,
  RefreshResponseDto,
  RefreshTokenDto,
  RegisterDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendVerificationDto,
  ChangePasswordDto,
} from "./dto";

@UseGuards(CustomThrottlerGuard)
@Controller(AUTH_ROUTES.BASE)
@ApiTags(AUTH_ROUTES.BASE)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(AUTH_ROUTES.REGISTER)
  @ApiCreatedResponseGeneric()
  @ApiBadRequestResponseRfc9457()
  @ApiConflictResponseRfc9457()
  @ApiInternalServerErrorResponseRfc9457()
  register(@Body() dto: RegisterDto): Promise<ApiResponse<null>> {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.VERIFY_EMAIL)
  @ApiOkResponseGeneric()
  @ApiBadRequestResponseRfc9457()
  @ApiInternalServerErrorResponseRfc9457()
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<ApiResponse<null>> {
    return this.authService.verifyEmail(dto.token);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.RESEND_VERIFICATION)
  @Throttle({
    auth: { limit: 3, ttl: 60000 },
  })
  @ApiOkResponseGeneric()
  @ApiBadRequestResponseRfc9457()
  @ApiInternalServerErrorResponseRfc9457()
  resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<ApiResponse<null>> {
    return this.authService.resendVerificationEmail(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.LOGIN)
  @ApiOkResponseGeneric(LoginResponseDto)
  @ApiBadRequestResponseRfc9457()
  @ApiInternalServerErrorResponseRfc9457()
  login(
    @Body() dto: LoginDto,
    @Req() req: Request,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const metadata = extractClientMetadata(req);
    return this.authService.login(dto, metadata);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.REFRESH)
  @Throttle({
    auth: { limit: 10, ttl: 60000 },
  })
  @ApiOkResponseGeneric(RefreshResponseDto)
  @ApiBadRequestResponseRfc9457()
  @ApiUnauthorizedResponseRfc9457()
  @ApiInternalServerErrorResponseRfc9457()
  refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<ApiResponse<RefreshResponseDto>> {
    const metadata = extractClientMetadata(req);
    return this.authService.refreshToken(dto, metadata);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.LOGOUT)
  @ApiOkResponseGeneric()
  @ApiBadRequestResponseRfc9457()
  @ApiInternalServerErrorResponseRfc9457()
  logout(@Body() dto: RefreshTokenDto): Promise<ApiResponse<null>> {
    return this.authService.logout(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.LOGOUT_ALL)
  @UseGuards(JwtAuthGuard)
  @Throttle({
    auth: { limit: 2, ttl: 60000 },
  })
  @ApiBearerAuth()
  @ApiOkResponseGeneric()
  @ApiUnauthorizedResponseRfc9457()
  @ApiInternalServerErrorResponseRfc9457()
  logoutAll(@CurrentUser("sub") userId: string): Promise<ApiResponse<null>> {
    return this.authService.logoutAll(userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.FORGOT_PASSWORD)
  @Throttle({
    auth: { limit: 3, ttl: 60000 },
  })
  @ApiOkResponseGeneric()
  @ApiBadRequestResponseRfc9457()
  @ApiInternalServerErrorResponseRfc9457()
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ApiResponse<null>> {
    return this.authService.forgotPassword(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.RESET_PASSWORD)
  @Throttle({
    auth: { limit: 5, ttl: 60000 },
  })
  @ApiOkResponseGeneric()
  @ApiBadRequestResponseRfc9457()
  @ApiInternalServerErrorResponseRfc9457()
  resetPassword(@Body() dto: ResetPasswordDto): Promise<ApiResponse<null>> {
    return this.authService.resetPassword(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.CHANGE_PASSWORD)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({
    auth: { limit: 5, ttl: 60000 },
  })
  @ApiOkResponseGeneric()
  @ApiBadRequestResponseRfc9457()
  @ApiUnauthorizedResponseRfc9457()
  @ApiInternalServerErrorResponseRfc9457()
  changePassword(
    @CurrentUser("sub") userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiResponse<null>> {
    return this.authService.changePassword(userId, dto);
  }
}
