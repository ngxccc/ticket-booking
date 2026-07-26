import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { I18nContext, I18nService } from "nestjs-i18n";

export interface InvalidParam {
  name: string;
  reason: string;
}

export interface Rfc9457ErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  invalidParams: InvalidParam[];
  timestamp: string;
}

function isRecordObject(res: unknown): res is Record<string, unknown> {
  return typeof res === "object" && res !== null;
}

// WHY: Standardize error responses across DTO Validation, Auth/Domain Exceptions, and Unhandled Errors per RFC 9457 with I18n support.
@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(@Optional() private readonly i18n?: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const lang = I18nContext.current(host)?.lang;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = "Internal Server Error";
    let detail: string;
    let invalidParams: InvalidParam[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      title = this.formatTitle(exception.name, exception.getResponse());

      const parsed = this.parseHttpExceptionResponse(
        exception.getResponse(),
        lang,
      );
      detail = parsed.detail;
      invalidParams = parsed.invalidParams;
    } else {
      const errStack =
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception);
      this.logger.error(`Unhandled Exception: ${errStack}`);

      // WHY: Production sanitization safeguard to prevent information disclosure (stack traces, raw SQL queries).
      detail = this.translate(
        "common.INTERNAL_SERVER_ERROR",
        lang,
        "An internal server error occurred. Please try again later.",
      );
    }

    const hostHeader = request.get("host") ?? "localhost";
    const typeUri = `${request.protocol}://${hostHeader}/errors/${title.toLowerCase().replace(/\s+/g, "-")}`;
    response
      .status(status)
      .setHeader("Content-Type", "application/problem+json")
      .json({
        type: typeUri,
        title,
        status,
        detail,
        instance: request.url,
        invalidParams,
        timestamp: new Date().toISOString(),
      });
  }

  // WHY: Parse different payload shapes from NestJS HttpException without deeply nested conditionals.
  private parseHttpExceptionResponse(
    res: unknown,
    lang?: string,
  ): { detail: string; invalidParams: InvalidParam[] } {
    if (typeof res === "string") {
      return { detail: res, invalidParams: [] };
    }

    if (!isRecordObject(res)) {
      return { detail: "Invalid error payload", invalidParams: [] };
    }

    const detail = this.extractDetail(res, lang);
    const invalidParams = this.extractInvalidParams(res, lang);

    return { detail, invalidParams };
  }

  private extractDetail(res: Record<string, unknown>, lang?: string): string {
    if (typeof res["detail"] === "string") {
      return res["detail"];
    }

    const msg = res["message"];
    if (typeof msg === "string") {
      return msg;
    }

    if (Array.isArray(msg) && msg.length > 0) {
      const first = msg[0] as unknown;
      if (typeof first === "string") {
        return first;
      }
      if (isRecordObject(first) && "property" in first) {
        return this.translate(
          "common.INVALID_INPUT",
          lang,
          "Submitted data format is invalid",
        );
      }
    }

    return "Error occurred";
  }

  private extractInvalidParams(
    res: Record<string, unknown>,
    lang?: string,
  ): InvalidParam[] {
    let rawParams: InvalidParam[] = [];

    if (Array.isArray(res["invalidParams"])) {
      rawParams = res["invalidParams"] as InvalidParam[];
    } else {
      const msg = res["message"];
      if (
        Array.isArray(msg) &&
        msg.length > 0 &&
        isRecordObject(msg[0]) &&
        "property" in msg[0]
      ) {
        rawParams = (msg as Record<string, unknown>[]).map((item) => {
          const propObj = item["property"];
          const prop = typeof propObj === "string" ? propObj : "";
          const constraints = (item["constraints"] ?? {}) as Record<
            string,
            string
          >;
          const firstReason = Object.values(constraints)[0] ?? "";
          return { name: prop, reason: firstReason };
        });
      }
    }

    return rawParams.map((param) => ({
      name: param.name,
      reason: this.formatReason(param.reason, lang),
    }));
  }

  private formatReason(rawReason: string, lang?: string): string {
    if (!rawReason) return "Invalid value";

    // WHY: Format nestjs-i18n raw validation message string "key|{args_json}" into localized human-readable error text.
    if (rawReason.includes("|")) {
      const pipeIndex = rawReason.indexOf("|");
      const key = rawReason.slice(0, pipeIndex);
      const jsonStr = rawReason.slice(pipeIndex + 1);

      let args: Record<string, unknown> = {};
      if (jsonStr) {
        try {
          args = JSON.parse(jsonStr) as Record<string, unknown>;
        } catch {
          // ignore JSON parse error
        }
      }

      if (key) {
        return this.translateWithArgs(key, lang, args, key);
      }
    }

    return rawReason;
  }

  private formatTitle(exceptionName: string, resResponse?: unknown): string {
    if (
      isRecordObject(resResponse) &&
      typeof resResponse["error"] === "string" &&
      resResponse["error"]
    ) {
      return resResponse["error"];
    }
    const rawName = exceptionName.replace(/Exception$/, "");
    return rawName.replace(/([a-z])([A-Z])/g, "$1 $2");
  }

  // WHY: Safe fallback helper to translate error messages without risk of crashing if I18nService is missing or fails.
  private translate(key: string, lang?: string, fallback = ""): string {
    return this.translateWithArgs(key, lang, undefined, fallback);
  }

  private translateWithArgs(
    key: string,
    lang?: string,
    args?: Record<string, unknown>,
    fallback = "",
  ): string {
    if (!this.i18n) return fallback;
    try {
      const result = this.i18n.translate(key, { lang, args });
      return typeof result === "string" ? result : fallback;
    } catch {
      return fallback;
    }
  }
}
