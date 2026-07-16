import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { DATABASE_CONNECTION } from "@/database/database.module";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import type { RegisterDto } from "./dto";
import { I18nService } from "nestjs-i18n";
import { createMockDb, createMockI18nService } from "../../../test/mocks";

const mockQueue = {
  add: mock(() => Promise.resolve({})),
  clearAll() {
    this.add.mockClear();
  },
};

describe("AuthService", () => {
  let service: AuthService;
  const mockDb = createMockDb();
  const mockI18nService = createMockI18nService();

  beforeEach(async () => {
    mockDb.clearAll();
    mockI18nService.clearAll();
    mockQueue.clearAll();

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
          provide: getQueueToken("mail"),
          useValue: mockQueue,
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
      expect(mockQueue.add).toHaveBeenCalledWith(
        "send-verification",
        expect.objectContaining({
          email: registerDto.email,
          fullName: registerDto.fullName,
          token: expect.any(String) as unknown as string,
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
});
