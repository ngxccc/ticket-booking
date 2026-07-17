import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { DATABASE_CONNECTION } from "@/database/database.module";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { RegisterDto } from "./dto";
import { I18nService } from "nestjs-i18n";
import { createMockDb, createMockI18nService } from "../../../test/mocks";
import { hashPassword } from "@/common/utils/crypto.util";
import { OUTBOX_EVENT_TYPE } from "@/common/constants/event.constant";

describe("AuthService", () => {
  let service: AuthService;
  const mockDb = createMockDb();
  const mockI18nService = createMockI18nService();
  const mockJwtService = {
    signAsync: mock(() => Promise.resolve("mock_access_token")),
    verifyAsync: mock(() =>
      Promise.resolve({ sub: "user-id", email: "test@example.com" }),
    ),
    clearAll() {
      this.signAsync.mockClear();
      this.verifyAsync.mockClear();
    },
  };
  beforeEach(async () => {
    mockDb.clearAll();
    mockI18nService.clearAll();
    mockJwtService.clearAll();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("register", () => {
    const registerDto: RegisterDto = {
      email: "test@example.com",
      fullName: "Test User",
      phoneNumber: "0912345678",
      password: "Password123",
      confirmPassword: "Password123",
      agreeTerms: true,
    };

    it("should successfully register a new user and return success-data JSON", async () => {
      mockDb.setSelectResult([]);

      const result = await service.register(registerDto);
      expect(result).toEqual({
        success: true,
        data: null,
      });

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerDto.email,
          fullName: registerDto.fullName,
          phoneNumber: registerDto.phoneNumber,
        }),
      );
      expect(mockDb.mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: OUTBOX_EVENT_TYPE.AUTH_VERIFICATION_EMAIL_REQUESTED,
          payload: expect.objectContaining({
            email: registerDto.email,
            fullName: registerDto.fullName,
            token: expect.any(String) as unknown as string,
          }) as unknown,
        }),
      );
    });

    it("should throw ConflictException with localized message if email already exists", async () => {
      mockDb.setSelectResult([{ id: "some-uuid" }]);

      let thrown = false;
      try {
        await service.register(registerDto);
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(ConflictException);
        expect((err as ConflictException).message).toBe(
          "auth.EMAIL_ALREADY_EXISTS",
        );
      }
      expect(thrown).toBe(true);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe("verifyEmail", () => {
    const validToken = "valid-token-123";

    it("should successfully verify email and active the user", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      mockDb.setSelectResult([
        {
          id: "user-uuid",
          email: "test@example.com",
          verificationToken: validToken,
          verificationExpiresAt: futureDate,
        },
      ]);

      const result = await service.verifyEmail(validToken);
      expect(result).toEqual({
        success: true,
        data: null,
      });

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
          verificationToken: null,
          verificationExpiresAt: null,
        }),
      );
    });

    it("should throw BadRequestException if token is invalid (user not found)", async () => {
      mockDb.setSelectResult([]);

      let thrown = false;
      try {
        await service.verifyEmail("invalid-token");
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).message).toBe(
          "auth.VERIFICATION_TOKEN_INVALID",
        );
      }
      expect(thrown).toBe(true);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException if verification token has expired", async () => {
      const pastDate = new Date(Date.now() - 1000 * 60 * 60);
      mockDb.setSelectResult([
        {
          id: "user-uuid",
          email: "test@example.com",
          verificationToken: validToken,
          verificationExpiresAt: pastDate,
        },
      ]);

      let thrown = false;
      try {
        await service.verifyEmail(validToken);
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).message).toBe(
          "auth.VERIFICATION_TOKEN_EXPIRED",
        );
      }
      expect(thrown).toBe(true);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("should successfully log in and return tokens + user info when credentials are correct", async () => {
      const passwordHash = await hashPassword("Password123");
      mockDb.setSelectResult([
        {
          id: "user-uuid",
          email: "test@example.com",
          fullName: "Test User",
          role: "user",
          status: "active",
          passwordHash,
        },
      ]);

      const result = await service.login({
        email: "test@example.com",
        password: "Password123",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.accessToken).toBe("mock_access_token");
      expect(result.data.refreshToken).toBeDefined();
      expect(result.data.user).toEqual({
        id: "user-uuid",
        email: "test@example.com",
        fullName: "Test User",
        role: "user",
      });
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should throw BadRequestException if user is not found", async () => {
      mockDb.setSelectResult([]);

      let thrown = false;
      try {
        await service.login({
          email: "nonexistent@example.com",
          password: "Password123",
        });
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).message).toBe(
          "auth.INVALID_CREDENTIALS",
        );
      }
      expect(thrown).toBe(true);
    });

    it("should throw BadRequestException if password is incorrect", async () => {
      const passwordHash = await hashPassword("Password123");
      mockDb.setSelectResult([
        {
          id: "user-uuid",
          email: "test@example.com",
          status: "active",
          passwordHash,
        },
      ]);

      let thrown = false;
      try {
        await service.login({
          email: "test@example.com",
          password: "WrongPassword",
        });
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).message).toBe(
          "auth.INVALID_CREDENTIALS",
        );
      }
      expect(thrown).toBe(true);
    });

    it("should throw BadRequestException if user email is not verified", async () => {
      const passwordHash = await hashPassword("Password123");
      mockDb.setSelectResult([
        {
          id: "user-uuid",
          email: "test@example.com",
          status: "pending_verification",
          passwordHash,
        },
      ]);

      let thrown = false;
      try {
        await service.login({
          email: "test@example.com",
          password: "Password123",
        });
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).message).toBe(
          "auth.EMAIL_NOT_VERIFIED",
        );
      }
      expect(thrown).toBe(true);
    });
  });

  describe("refreshToken", () => {
    it("should successfully rotate and return new tokens if refresh token is valid", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      mockDb.setSelectResultsQueue([
        [
          {
            id: "token-record-id",
            userId: "user-uuid",
            tokenHash: "hashed_token",
            isRevoked: false,
            expiresAt: futureDate,
          },
        ],
        [
          {
            id: "user-uuid",
            email: "test@example.com",
            role: "user",
            status: "active",
          },
        ],
      ]);

      const result = await service.refreshToken({
        refreshToken: "valid_refresh_token",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.accessToken).toBe("mock_access_token");
      expect(result.data.refreshToken).toBeDefined();
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException if refresh token is not found", async () => {
      mockDb.setSelectResult([]);

      let thrown = false;
      try {
        await service.refreshToken({
          refreshToken: "invalid_refresh_token",
        });
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as UnauthorizedException).message).toBe(
          "auth.TOKEN_INVALID_OR_EXPIRED",
        );
      }
      expect(thrown).toBe(true);
    });
  });

  describe("logout", () => {
    it("should successfully delete the refresh token if valid", async () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 60);
      mockDb.setSelectResult([
        {
          id: "token-record-id",
          isRevoked: false,
          expiresAt: futureDate,
        },
      ]);

      const result = await service.logout({
        refreshToken: "valid_refresh_token",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should throw UnauthorizedException if refresh token is not found", async () => {
      mockDb.setSelectResult([]);

      let thrown = false;
      try {
        await service.logout({
          refreshToken: "invalid_refresh_token",
        });
      } catch (err) {
        thrown = true;
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as UnauthorizedException).message).toBe(
          "auth.TOKEN_INVALID_OR_EXPIRED",
        );
      }
      expect(thrown).toBe(true);
    });
  });
});
