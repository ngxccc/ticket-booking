import { describe, expect, it, mock, beforeEach } from "bun:test";
import {
  BadRequestException,
  UnauthorizedException,
  HttpStatus,
  type ArgumentsHost,
} from "@nestjs/common";
import type { I18nService } from "nestjs-i18n";
import { GlobalExceptionFilter } from "./global-exception.filter";
describe("GlobalExceptionFilter", () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: {
    status: ReturnType<typeof mock>;
    setHeader: ReturnType<typeof mock>;
    json: ReturnType<typeof mock>;
  };
  let mockRequest: {
    protocol: string;
    get: (header: string) => string;
    url: string;
  };
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {} as unknown as typeof mockResponse;
    mockResponse.status = mock().mockReturnValue(mockResponse);
    mockResponse.setHeader = mock().mockReturnValue(mockResponse);
    mockResponse.json = mock().mockReturnValue(mockResponse);

    mockRequest = {
      protocol: "http",
      get: mock().mockReturnValue("localhost:3000"),
      url: "/api/test",
    };

    mockArgumentsHost = {
      getType: () => "http",
      switchToHttp: mock().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it("should format UnauthorizedException correctly according to RFC 9457", () => {
    const exception = new UnauthorizedException(
      "Mật khẩu hiện tại không chính xác",
    );

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/problem+json",
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "http://localhost:3000/errors/unauthorized",
        title: "Unauthorized",
        status: 401,
        detail: "Mật khẩu hiện tại không chính xác",
        instance: "/api/test",
        invalidParams: [],
      }),
    );
  });

  it("should format DTO BadRequestException with invalidParams correctly", () => {
    const exception = new BadRequestException({
      detail: "Dữ liệu gửi lên không đúng định dạng",
      invalidParams: [
        {
          name: "confirmPassword",
          reason: "Mật khẩu xác nhận không trùng khớp",
        },
      ],
    });

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/problem+json",
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "http://localhost:3000/errors/bad-request",
        title: "Bad Request",
        status: 400,
        detail: "Dữ liệu gửi lên không đúng định dạng",
        instance: "/api/test",
        invalidParams: [
          {
            name: "confirmPassword",
            reason: "Mật khẩu xác nhận không trùng khớp",
          },
        ],
      }),
    );
  });

  it("should handle legacy array ValidationError payload safely", () => {
    const exception = new BadRequestException({
      message: [
        {
          property: "email",
          constraints: { isEmail: "Email không hợp lệ" },
        },
      ],
    });

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Bad Request",
        status: 400,
        invalidParams: [{ name: "email", reason: "Email không hợp lệ" }],
      }),
    );
  });

  it("should sanitize unhandled Error to HTTP 500 without leaking stack traces", () => {
    const exception = new Error("Database query failed: SELECT * FROM secret");

    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/problem+json",
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "http://localhost:3000/errors/internal-server-error",
        title: "Internal Server Error",
        status: 500,
        detail: "An internal server error occurred. Please try again later.",
        instance: "/api/test",
        invalidParams: [],
      }),
    );
  });

  it("should use I18nService to translate fallback messages when provided", () => {
    const mockI18n = {
      translate: mock().mockReturnValue(
        "An internal server error occurred. Please try again later.",
      ),
    };
    const i18nFilter = new GlobalExceptionFilter(
      mockI18n as unknown as I18nService,
    );
    i18nFilter.catch(new Error("Database boom"), mockArgumentsHost);

    expect(mockI18n.translate).toHaveBeenCalledWith(
      "common.INTERNAL_SERVER_ERROR",
      { lang: undefined },
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: "An internal server error occurred. Please try again later.",
      }),
    );
  });

  it("should decode raw nestjs-i18n pipe strings in invalidParams reason field", () => {
    const mockI18n = {
      translate: mock().mockImplementation((key: string) => {
        if (key === "validation.isEmail") return "Email không đúng định dạng";
        return key;
      }),
    };
    const i18nFilter = new GlobalExceptionFilter(
      mockI18n as unknown as I18nService,
    );

    const exception = new BadRequestException({
      detail: "Submitted data format is invalid",
      invalidParams: [
        {
          name: "email",
          reason: 'validation.isEmail|{"value":"invalid-email"}',
        },
      ],
    });

    i18nFilter.catch(exception, mockArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        invalidParams: [
          {
            name: "email",
            reason: "Email không đúng định dạng",
          },
        ],
      }),
    );
  });
});
