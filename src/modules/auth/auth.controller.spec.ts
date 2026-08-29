import type { Request } from "express";
import { AuthController } from "./auth.controller";
import type { AuthService } from "./auth.service";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  VerifyEmailDto,
} from "./dto";

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
    logout: mock((_dto: RefreshTokenDto) =>
      Promise.resolve({
        success: true,
        data: null,
      }),
    ),
    forgotPassword: mock(() => Promise.resolve({ success: true, data: null })),
    resetPassword: mock(() => Promise.resolve({ success: true, data: null })),
    changePassword: mock(() => Promise.resolve({ success: true, data: null })),
    logoutAll: mock(() => Promise.resolve({ success: true, data: null })),
    resendVerificationEmail: mock(() =>
      Promise.resolve({ success: true, data: null }),
    ),
  };

  beforeEach(() => {
    mockAuthService.register.mockClear();
    mockAuthService.login.mockClear();
    mockAuthService.refreshToken.mockClear();
    mockAuthService.verifyEmail.mockClear();
    mockAuthService.logout.mockClear();
    mockAuthService.forgotPassword.mockClear();
    mockAuthService.resetPassword.mockClear();
    mockAuthService.resendVerificationEmail.mockClear();
    mockAuthService.changePassword.mockClear();
    mockAuthService.logoutAll.mockClear();

    controller = new AuthController(mockAuthService as unknown as AuthService);
    authService = mockAuthService as unknown as AuthService;
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
      const dto: VerifyEmailDto = { token: "some-token" };
      expect(controller.verifyEmail(dto)).resolves.toEqual({
        success: true,
        data: null,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.verifyEmail).toHaveBeenCalledWith(dto.token);
    });
  });

  describe("resendVerification", () => {
    it("should call authService.resendVerificationEmail and return success-data JSON", () => {
      const dto = { email: "test@example.com" };
      expect(controller.resendVerification(dto)).resolves.toEqual({
        success: true,
        data: null,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.resendVerificationEmail).toHaveBeenCalledWith(dto);
    });
  });

  describe("logout", () => {
    it("should call authService.logout and return success-data JSON", () => {
      const dto: RefreshTokenDto = {
        refreshToken: "valid_refresh_token",
      };

      expect(controller.logout(dto)).resolves.toEqual({
        success: true,
        data: null,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.logout).toHaveBeenCalledWith(dto);
    });
  });

  describe("forgotPassword", () => {
    it("should call authService.forgotPassword and return success-data JSON", () => {
      const dto = { email: "test@example.com" };
      expect(controller.forgotPassword(dto)).resolves.toEqual({
        success: true,
        data: null,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe("resetPassword", () => {
    it("should call authService.resetPassword and return success-data JSON", () => {
      const dto = {
        token: "token",
        password: "Password123",
        confirmPassword: "Password123",
      };
      expect(controller.resetPassword(dto)).resolves.toEqual({
        success: true,
        data: null,
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe("login", () => {
    it("should extract client metadata from req and call authService.login", async () => {
      const dto = { email: "test@example.com", password: "Password123!" };
      const req = {
        headers: {
          "user-agent": "TestBrowser/1.0",
          "x-forwarded-for": "1.2.3.4",
        },
        ip: "1.2.3.4",
      } as unknown as Request;

      await controller.login(dto, req);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.login).toHaveBeenCalledWith(dto, {
        deviceName: "TestBrowser/1.0",
        ipAddress: "1.2.3.4",
      });
    });
  });

  describe("refresh", () => {
    it("should extract client metadata from req and call authService.refreshToken", async () => {
      const dto = { refreshToken: "some_refresh_token" };
      const req = {
        headers: { "user-agent": "TestBrowser/1.0" },
        ip: "5.6.7.8",
      } as unknown as Request;

      await controller.refresh(dto, req);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.refreshToken).toHaveBeenCalledWith(dto, {
        deviceName: "TestBrowser/1.0",
        ipAddress: "5.6.7.8",
      });
    });
  });

  describe("changePassword", () => {
    it("should call authService.changePassword with userId and dto", async () => {
      const dto = {
        currentPassword: "OldPassword123!",
        newPassword: "NewPassword456!",
      };
      const result = await controller.changePassword("user-id", dto);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.changePassword).toHaveBeenCalledWith("user-id", dto);
      expect(result).toEqual({ success: true, data: null });
    });
  });

  describe("logoutAll", () => {
    it("should call authService.logoutAll with sub userId", async () => {
      const result = await controller.logoutAll("user-id");
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authService.logoutAll).toHaveBeenCalledWith("user-id");
      expect(result).toEqual({ success: true, data: null });
    });
  });
});
