import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { DATABASE_CONNECTION } from "@/database/database.module";
import { beforeEach, describe, expect, it } from "bun:test";
import { ConflictException } from "@nestjs/common";
import type { RegisterDto } from "./dto";
import { I18nService } from "nestjs-i18n";
import { createMockDb, createMockI18nService } from "../../../test/mocks";

describe("AuthService", () => {
  let service: AuthService;
  const mockDb = createMockDb();
  const mockI18nService = createMockI18nService();

  beforeEach(async () => {
    mockDb.clearAll();
    mockI18nService.clearAll();

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

    it("should successfully register a new user and return success-data JSON", () => {
      mockDb.setSelectResult([]);

      expect(service.register(registerDto)).resolves.toEqual({
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
    });

    it("should throw ConflictException with localized message if email already exists", () => {
      mockDb.setSelectResult([{ id: "some-uuid" }]);

      expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException("auth.EMAIL_ALREADY_EXISTS"),
      );

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});
