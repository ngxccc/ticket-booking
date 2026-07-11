import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard, type ThrottlerLimitDetail } from "@nestjs/throttler";
import { I18nContext } from "nestjs-i18n";
import { HttpException, HttpStatus } from "@nestjs/common";
import { ERROR_MESSAGES } from "@/common/constants/error.constant";
import type { I18nTranslations } from "@/generated/i18n.generated";

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    const i18n = I18nContext.current<I18nTranslations>()?.service;
    const lang = I18nContext.current()?.lang;

    const message = i18n
      ? i18n.t("auth.TOO_MANY_REQUESTS", { lang })
      : "Too many requests. Please try again later";

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message,
        error: ERROR_MESSAGES.TOO_MANY_REQUESTS,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
