import { describe, beforeEach, it, expect } from "bun:test";
import { CustomThrottlerGuard } from "./throttler.guard";
import type { ExecutionContext } from "@nestjs/common";
import { HttpException, HttpStatus } from "@nestjs/common";
import type {
  ThrottlerModuleOptions,
  ThrottlerStorage,
  ThrottlerLimitDetail,
} from "@nestjs/throttler";
import { Reflector } from "@nestjs/core";
import { ERROR_MESSAGES } from "@/common/constants/error.constant";

class TestCustomThrottlerGuard extends CustomThrottlerGuard {
  public override throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}

describe("CustomThrottlerGuard", () => {
  let guard: TestCustomThrottlerGuard;

  beforeEach(() => {
    guard = new TestCustomThrottlerGuard(
      {} as ThrottlerModuleOptions,
      {} as ThrottlerStorage,
      new Reflector(),
    );
  });

  describe("throwThrottlingException", () => {
    it("should throw HttpException with status 429 and default fallback message when i18n context is missing", () => {
      const mockContext = {} as ExecutionContext;
      const mockLimitDetail = {
        limit: 5,
        ttl: 60000,
        key: "test-key",
        tracker: "ip",
        throttlerName: "auth",
        totalHits: 6,
        timeToExpire: 59,
        isBlocked: true,
        timeToBlockExpire: 60,
      };

      expect(() =>
        guard.throwThrottlingException(mockContext, mockLimitDetail),
      ).toThrow(
        new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: "Too many requests. Please try again later",
            error: ERROR_MESSAGES.TOO_MANY_REQUESTS,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    });
  });
});
