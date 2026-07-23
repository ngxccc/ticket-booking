import { ApiTags } from "@nestjs/swagger";
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CustomThrottlerGuard } from "@/common/guards/throttler.guard";
import {
  ApiCreatedResponseGeneric,
  ApiOkResponseGeneric,
} from "@/common/decorators/api-response.decorator";
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
} from "./dto";

@UseGuards(CustomThrottlerGuard)
@Throttle({
  auth: { limit: 5, ttl: 60000 },
})
@Controller(AUTH_ROUTES.BASE)
@ApiTags("Auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(AUTH_ROUTES.REGISTER)
  @ApiCreatedResponseGeneric()
  register(@Body() dto: RegisterDto): Promise<ApiResponse<null>> {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.VERIFY_EMAIL)
  @ApiOkResponseGeneric()
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<ApiResponse<null>> {
    return this.authService.verifyEmail(dto.token);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.RESEND_VERIFICATION)
  @Throttle({
    auth: { limit: 3, ttl: 60000 },
  })
  @ApiOkResponseGeneric()
  resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<ApiResponse<null>> {
    return this.authService.resendVerificationEmail(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.LOGIN)
  @ApiOkResponseGeneric(LoginResponseDto)
  login(@Body() dto: LoginDto): Promise<ApiResponse<LoginResponseDto>> {
    return this.authService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.REFRESH)
  @Throttle({
    auth: { limit: 10, ttl: 60000 },
  })
  @ApiOkResponseGeneric(RefreshResponseDto)
  refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<ApiResponse<RefreshResponseDto>> {
    return this.authService.refreshToken(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.LOGOUT)
  @ApiOkResponseGeneric()
  logout(@Body() dto: RefreshTokenDto): Promise<ApiResponse<null>> {
    return this.authService.logout(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.FORGOT_PASSWORD)
  @Throttle({
    auth: { limit: 3, ttl: 60000 },
  })
  @ApiOkResponseGeneric()
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ApiResponse<null>> {
    return this.authService.forgotPassword(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.RESET_PASSWORD)
  @Throttle({
    auth: { limit: 5, ttl: 60000 },
  })
  @ApiOkResponseGeneric()
  resetPassword(@Body() dto: ResetPasswordDto): Promise<ApiResponse<null>> {
    return this.authService.resetPassword(dto);
  }
}
