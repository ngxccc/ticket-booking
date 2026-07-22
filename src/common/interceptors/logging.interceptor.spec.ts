import {
  describe,
  it,
  expect,
  beforeEach,
  spyOn,
  afterEach,
  type Mock,
} from "bun:test";
import { LoggingInterceptor } from "./logging.interceptor";
import {
  type ExecutionContext,
  type CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { of, throwError } from "rxjs";

describe("LoggingInterceptor", () => {
  let interceptor: LoggingInterceptor;
  let debugSpy: Mock<(...args: unknown[]) => void>;
  let warnSpy: Mock<(...args: unknown[]) => void>;
  let errorSpy: Mock<(...args: unknown[]) => void>;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    debugSpy = spyOn(Logger.prototype, "debug").mockImplementation(
      () => undefined,
    );
    warnSpy = spyOn(Logger.prototype, "warn").mockImplementation(
      () => undefined,
    );
    errorSpy = spyOn(Logger.prototype, "error").mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    debugSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
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
        expect(debugSpy).toHaveBeenCalledWith(
          expect.stringMatching(/^\[GET\] \/api\/test 200 - \d+ms$/),
        );
        done();
      },
    });
  });

  it("should log 4xx HttpExceptions at warn level with status code and error message", (done) => {
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
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[POST\] \/auth\/login 400 - \d+ms - Error: Bad Request$/,
          ),
        );
        done();
      },
    });
  });

  it("should log 5xx HttpExceptions at error level with status code and error stack", (done) => {
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
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[GET\] \/crash 500 - \d+ms - Error: Database Failure$/,
          ),
        );
        done();
      },
    });
  });

  it("should handle non-HttpException generic errors and default status code to 500", (done) => {
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
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringMatching(
            /^\[DELETE\] \/data 500 - \d+ms - Error: Unhandled runtime error$/,
          ),
        );
        done();
      },
    });
  });
});
