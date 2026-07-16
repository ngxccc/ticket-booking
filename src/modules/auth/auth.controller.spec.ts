import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CustomThrottlerGuard } from "@/common/guards/throttler.guard";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { RegisterDto, LoginDto, RefreshTokenDto } from "./dto";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: mock(() => Promise.resolve({ success: true, data: null })),
    login: mock((dto: LoginDto) =>
      Promise.resolve({
        success: true,
        data: { email: dto.email },
      }),
    ),
    refreshToken: mock((dto: RefreshTokenDto) =>
      Promise.resolve({
        success: true,
        data: { token: dto.refreshToken },
      }),
    ),
    verifyEmail: mock((_token: string) =>
      Promise.resolve({
        success: true,
        data: null,
      }),
    ),
  };

  beforeEach(async () => {
    mockAuthService.register.mockClear();
    mockAuthService.login.mockClear();
    mockAuthService.refreshToken.mockClear();
    mockAuthService.verifyEmail.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("register", () => {
    it("should call authService.register and return success-data JSON", () => {
      const dto: RegisterDto = {
        email: "test@example.com",
        fullName: "Test User",
        phoneNumber: "0912345678",
        password: "Password123",
        confirmPassword: "Password123",
        agreeTerms: true,
      };

      expect(controller.register(dto)).resolves.toEqual({
        success: true,
        data: null,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe("verifyEmail", () => {
    it("should call authService.verifyEmail and return success-data JSON", () => {
      const token = "some-token";
      expect(controller.verifyEmail(token)).resolves.toEqual({
        success: true,
        data: null,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.verifyEmail).toHaveBeenCalledWith(token);
    });
  });
});
