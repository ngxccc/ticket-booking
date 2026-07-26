import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { CustomThrottlerGuard } from "@/common/guards/throttler.guard";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { UserResponseDto } from "./dto/user-response.dto";

describe("UsersController", () => {
  let controller: UsersController;

  const mockUsersService = {
    getProfile: mock(() =>
      Promise.resolve({
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "user@example.com",
        fullName: "Nguyen Van A",
        role: "user",
        isVerified: true,
        status: "active",
      } as UserResponseDto),
    ),
    clearAll() {
      this.getProfile.mockClear();
    },
  };

  beforeEach(async () => {
    mockUsersService.clearAll();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    })
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get<UsersController>(UsersController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getMe", () => {
    it("should return apiSuccess wrapped user profile", async () => {
      const userId = "123e4567-e89b-12d3-a456-426614174000";
      const result = await controller.getMe(userId);

      expect(mockUsersService.getProfile).toHaveBeenCalledWith(userId);
      expect(result).toEqual({
        success: true,
        data: {
          id: userId,
          email: "user@example.com",
          fullName: "Nguyen Van A",
          role: "user",
          isVerified: true,
          status: "active",
        },
      });
    });
  });
});
