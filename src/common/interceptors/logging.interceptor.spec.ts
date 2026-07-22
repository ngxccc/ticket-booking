import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import { LoggingInterceptor } from "./logging.interceptor";
import type {
  Logger,
  type ExecutionContext,
  type CallHandler,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { of, throwError } from "rxjs";

interface InterceptorWithLogger {
  logger: Logger;
}

function getInterceptorLogger(interceptor: LoggingInterceptor): Logger {
  const target = interceptor as unknown as InterceptorWithLogger;
  return target.logger;
}

describe("LoggingInterceptor", () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it("should ignore non-HTTP execution contexts", (done) => {
    const mockContext = {
      getType: () => "rpc",
    } as unknown as ExecutionContext;

    const mockHandler = {
      handle: () => of("test-data"),
    } as CallHandler;

    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: (val) => {
        expect(val).toBe("test-data");
        done();
      },
    });
  });

  it("should log HTTP 2xx success responses at debug level with formatted message", (done) => {
    const loggerSpy = spyOn(getInterceptorLogger(interceptor), "debug");

    const mockRequest = { method: "GET", originalUrl: "/api/test" };
    const mockResponse = { statusCode: 200 };

    const mockContext = {
      getType: () => "http",
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler = {
      handle: () => of({ success: true }),
    } as CallHandler;

    interceptor.intercept(mockContext, mockHandler).subscribe({
      next: () => {
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(/^\[GET\] \/api\/test 200 - \d+ms$/),
        );
        done();
      },
    });
  });

  it("should log 4xx HttpExceptions at warn level with status code and error message", (done) => {
    const loggerSpy = spyOn(getInterceptorLogger(interceptor), "warn");

    const mockRequest = { method: "POST", originalUrl: "/auth/login" };
    const mockResponse = { statusCode: 200 };

    const mockContext = {
      getType: () => "http",
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const error = new HttpException("Bad Request", HttpStatus.BAD_REQUEST);
    const mockHandler = {
      handle: () => throwError(() => error),
    } as CallHandler;

    interceptor.intercept(mockContext, mockHandler).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[POST\] \/auth\/login 400 - \d+ms - Error: Bad Request$/,
          ),
        );
        done();
      },
    });
  });

  it("should log 5xx HttpExceptions at error level with status code and error stack", (done) => {
    const loggerSpy = spyOn(getInterceptorLogger(interceptor), "error");

    const mockRequest = { method: "GET", originalUrl: "/crash" };
    const mockResponse = { statusCode: 500 };

    const mockContext = {
      getType: () => "http",
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const error = new HttpException(
      "Database Failure",
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const mockHandler = {
      handle: () => throwError(() => error),
    } as CallHandler;

    interceptor.intercept(mockContext, mockHandler).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[GET\] \/crash 500 - \d+ms - Error: Database Failure$/,
          ),
        );
        done();
      },
    });
  });

  it("should handle non-HttpException generic errors and default status code to 500", (done) => {
    const loggerSpy = spyOn(getInterceptorLogger(interceptor), "error");

    const mockRequest = { method: "DELETE", originalUrl: "/data" };
    const mockResponse = { statusCode: 200 };

    const mockContext = {
      getType: () => "http",
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const error = new Error("Unhandled runtime error");
    const mockHandler = {
      handle: () => throwError(() => error),
    } as CallHandler;

    interceptor.intercept(mockContext, mockHandler).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[DELETE\] \/data 500 - \d+ms - Error: Unhandled runtime error$/,
          ),
        );
        done();
      },
    });
  });
});
