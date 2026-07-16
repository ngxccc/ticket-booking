import { ApiTags } from "@nestjs/swagger";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CustomThrottlerGuard } from "@/common/guards/throttler.guard";
import { AUTH_ROUTES } from "./auth.routes";
import { AuthService } from "./auth.service";
import { LoginDto, RefreshTokenDto, RegisterDto } from "./dto";

@UseGuards(CustomThrottlerGuard)
@Throttle({
  auth: { limit: 5, ttl: 60000 },
})
@Controller(AUTH_ROUTES.BASE)
@ApiTags("Auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post(AUTH_ROUTES.REGISTER)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get(AUTH_ROUTES.VERIFY_EMAIL)
  verifyEmail(@Query("token") token: string) {
    return this.authService.verifyEmail(token);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.LOGIN)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post(AUTH_ROUTES.REFRESH)
  @Throttle({
    auth: { limit: 10, ttl: 60000 },
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }
}
