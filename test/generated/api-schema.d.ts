export interface paths {
  "/": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["AppController_getHealth"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/auth/register": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["AuthController_register"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/auth/verify-email": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["AuthController_verifyEmail"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/auth/resend-verification": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["AuthController_resendVerification"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/auth/login": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["AuthController_login"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/auth/refresh": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["AuthController_refresh"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/auth/logout": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["AuthController_logout"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/auth/logout-all": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["AuthController_logoutAll"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/auth/forgot-password": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["AuthController_forgotPassword"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/auth/reset-password": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["AuthController_resetPassword"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/auth/change-password": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["AuthController_changePassword"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/users/me": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get: operations["UsersController_getMe"];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  "/bookings/reserve": {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: operations["BookingController_reserveSeats"];
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    InvalidParamDto: {
      /**
       * @description Invalid field name
       * @example email
       */
      name: string;
      /**
       * @description Detailed reason for the validation error
       * @example Invalid email address format
       */
      reason: string;
    };
    Rfc9457ErrorResponseDto: {
      /**
       * @description Standard HTTP error type URI
       * @example http://localhost:3000/errors/bad-request
       */
      type: string;
      /**
       * @description Standard HTTP error title
       * @example Bad Request
       */
      title: string;
      /**
       * @description HTTP status code
       * @example 400
       */
      status: number;
      /**
       * @description Detailed error message
       * @example Submitted data format is invalid
       */
      detail: string;
      /**
       * @description API request path that triggered the error
       * @example /auth/register
       */
      instance: string;
      /** @description List of invalid parameters that failed validation */
      invalidParams?: components["schemas"]["InvalidParamDto"][];
      /**
       * @description Timestamp when error occurred in ISO 8601 format
       * @example 2026-07-25T02:45:00.000Z
       */
      timestamp: string;
    };
    ApiResponseDto: {
      /** @example true */
      success: boolean;
    };
    RegisterDto: Record<string, never>;
    VerifyEmailDto: Record<string, never>;
    ResendVerificationDto: Record<string, never>;
    LoginResponseDto: Record<string, never>;
    LoginDto: Record<string, never>;
    RefreshResponseDto: Record<string, never>;
    RefreshTokenDto: Record<string, never>;
    ForgotPasswordDto: Record<string, never>;
    ResetPasswordDto: Record<string, never>;
    ChangePasswordDto: Record<string, never>;
    UserResponseDto: {
      /** @example 123e4567-e89b-12d3-a456-426614174000 */
      id: string;
      /** @example user@example.com */
      email: string;
      /** @example John Doe */
      fullName: string;
      /** @example user */
      role: string;
      /**
       * @description True nếu người dùng đã xác minh email (status !== 'pending_verification')
       * @example true
       */
      isVerified: boolean;
      /**
       * @example active
       * @enum {string}
       */
      status: "active" | "inactive" | "suspended" | "pending_verification";
    };
    ReserveSeatsResponseDto: {
      /** @example 019fa8bc-8f4d-7000-b366-e691f45cfb8f */
      bookingId: string;
      /** @example 019fa8bc-8f4d-7000-b366-e691f45cfb8f */
      showId: string;
      /** @example 100000 */
      totalPrice: number;
      /** @example pending_payment */
      status: string;
      /** @example 2026-07-28T12:45:00.000Z */
      expiresAt: string;
      /**
       * @example [
       *       "019fa8bc-8f4d-7000-b366-e691f45cfb8f"
       *     ]
       */
      seats: string[];
    };
    ReserveSeatsDto: Record<string, never>;
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  AppController_getHealth: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content?: never;
      };
    };
  };
  AuthController_register: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["RegisterDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            /** @default null */
            data: Record<string, never> | null;
          };
        };
      };
      /** @description Validation failure (Bad Request) */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/bad-request",
           *       "title": "Bad Request",
           *       "status": 400,
           *       "detail": "Submitted data format is invalid",
           *       "instance": "/api/example",
           *       "invalidParams": [
           *         {
           *           "name": "email",
           *           "reason": "Invalid email address format"
           *         }
           *       ],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Resource conflict (Conflict) */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/conflict",
           *       "title": "Conflict",
           *       "status": 409,
           *       "detail": "Email address already exists",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Internal server error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/internal-server-error",
           *       "title": "Internal Server Error",
           *       "status": 500,
           *       "detail": "An internal server error occurred. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
  AuthController_verifyEmail: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["VerifyEmailDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            /** @default null */
            data: Record<string, never> | null;
          };
        };
      };
      /** @description Validation failure (Bad Request) */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/bad-request",
           *       "title": "Bad Request",
           *       "status": 400,
           *       "detail": "Submitted data format is invalid",
           *       "instance": "/api/example",
           *       "invalidParams": [
           *         {
           *           "name": "email",
           *           "reason": "Invalid email address format"
           *         }
           *       ],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Internal server error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/internal-server-error",
           *       "title": "Internal Server Error",
           *       "status": 500,
           *       "detail": "An internal server error occurred. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
  AuthController_resendVerification: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ResendVerificationDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            /** @default null */
            data: Record<string, never> | null;
          };
        };
      };
      /** @description Validation failure (Bad Request) */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/bad-request",
           *       "title": "Bad Request",
           *       "status": 400,
           *       "detail": "Submitted data format is invalid",
           *       "instance": "/api/example",
           *       "invalidParams": [
           *         {
           *           "name": "email",
           *           "reason": "Invalid email address format"
           *         }
           *       ],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Internal server error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/internal-server-error",
           *       "title": "Internal Server Error",
           *       "status": 500,
           *       "detail": "An internal server error occurred. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
  AuthController_login: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["LoginDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            data?: components["schemas"]["LoginResponseDto"];
          };
        };
      };
      /** @description Validation failure (Bad Request) */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/bad-request",
           *       "title": "Bad Request",
           *       "status": 400,
           *       "detail": "Submitted data format is invalid",
           *       "instance": "/api/example",
           *       "invalidParams": [
           *         {
           *           "name": "email",
           *           "reason": "Invalid email address format"
           *         }
           *       ],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Internal server error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/internal-server-error",
           *       "title": "Internal Server Error",
           *       "status": 500,
           *       "detail": "An internal server error occurred. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
  AuthController_refresh: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["RefreshTokenDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            data?: components["schemas"]["RefreshResponseDto"];
          };
        };
      };
      /** @description Validation failure (Bad Request) */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/bad-request",
           *       "title": "Bad Request",
           *       "status": 400,
           *       "detail": "Submitted data format is invalid",
           *       "instance": "/api/example",
           *       "invalidParams": [
           *         {
           *           "name": "email",
           *           "reason": "Invalid email address format"
           *         }
           *       ],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Authentication required or invalid token (Unauthorized) */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/unauthorized",
           *       "title": "Unauthorized",
           *       "status": 401,
           *       "detail": "Unauthorized access",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Internal server error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/internal-server-error",
           *       "title": "Internal Server Error",
           *       "status": 500,
           *       "detail": "An internal server error occurred. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
  AuthController_logout: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["RefreshTokenDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            /** @default null */
            data: Record<string, never> | null;
          };
        };
      };
      /** @description Validation failure (Bad Request) */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/bad-request",
           *       "title": "Bad Request",
           *       "status": 400,
           *       "detail": "Submitted data format is invalid",
           *       "instance": "/api/example",
           *       "invalidParams": [
           *         {
           *           "name": "email",
           *           "reason": "Invalid email address format"
           *         }
           *       ],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Internal server error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/internal-server-error",
           *       "title": "Internal Server Error",
           *       "status": 500,
           *       "detail": "An internal server error occurred. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
  AuthController_logoutAll: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            /** @default null */
            data: Record<string, never> | null;
          };
        };
      };
      /** @description Authentication required or invalid token (Unauthorized) */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/unauthorized",
           *       "title": "Unauthorized",
           *       "status": 401,
           *       "detail": "Unauthorized access",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Internal server error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/internal-server-error",
           *       "title": "Internal Server Error",
           *       "status": 500,
           *       "detail": "An internal server error occurred. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
  AuthController_forgotPassword: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ForgotPasswordDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            /** @default null */
            data: Record<string, never> | null;
          };
        };
      };
      /** @description Validation failure (Bad Request) */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/bad-request",
           *       "title": "Bad Request",
           *       "status": 400,
           *       "detail": "Submitted data format is invalid",
           *       "instance": "/api/example",
           *       "invalidParams": [
           *         {
           *           "name": "email",
           *           "reason": "Invalid email address format"
           *         }
           *       ],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Internal server error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/internal-server-error",
           *       "title": "Internal Server Error",
           *       "status": 500,
           *       "detail": "An internal server error occurred. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
  AuthController_resetPassword: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ResetPasswordDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            /** @default null */
            data: Record<string, never> | null;
          };
        };
      };
      /** @description Validation failure (Bad Request) */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/bad-request",
           *       "title": "Bad Request",
           *       "status": 400,
           *       "detail": "Submitted data format is invalid",
           *       "instance": "/api/example",
           *       "invalidParams": [
           *         {
           *           "name": "email",
           *           "reason": "Invalid email address format"
           *         }
           *       ],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Internal server error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/internal-server-error",
           *       "title": "Internal Server Error",
           *       "status": 500,
           *       "detail": "An internal server error occurred. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
  AuthController_changePassword: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ChangePasswordDto"];
      };
    };
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            /** @default null */
            data: Record<string, never> | null;
          };
        };
      };
      /** @description Validation failure (Bad Request) */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/bad-request",
           *       "title": "Bad Request",
           *       "status": 400,
           *       "detail": "Submitted data format is invalid",
           *       "instance": "/api/example",
           *       "invalidParams": [
           *         {
           *           "name": "email",
           *           "reason": "Invalid email address format"
           *         }
           *       ],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Authentication required or invalid token (Unauthorized) */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/unauthorized",
           *       "title": "Unauthorized",
           *       "status": 401,
           *       "detail": "Unauthorized access",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Internal server error */
      500: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/internal-server-error",
           *       "title": "Internal Server Error",
           *       "status": 500,
           *       "detail": "An internal server error occurred. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
  UsersController_getMe: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            data?: components["schemas"]["UserResponseDto"];
          };
        };
      };
      /** @description Authentication required or invalid token (Unauthorized) */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/unauthorized",
           *       "title": "Unauthorized",
           *       "status": 401,
           *       "detail": "Unauthorized access",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Forbidden access (Forbidden) */
      403: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/forbidden",
           *       "title": "Forbidden",
           *       "status": 403,
           *       "detail": "Account suspended or inactive",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Resource not found (Not Found) */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/not-found",
           *       "title": "Not Found",
           *       "status": 404,
           *       "detail": "User profile not found",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Rate limit exceeded (Too Many Requests) */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/too-many-requests",
           *       "title": "Too Many Requests",
           *       "status": 429,
           *       "detail": "Rate limit exceeded. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
  BookingController_reserveSeats: {
    parameters: {
      query?: never;
      header: {
        /** @description Client-generated UUID idempotency key for preventing duplicate booking requests */
        "idempotency-key": string;
      };
      path?: never;
      cookie?: never;
    };
    requestBody: {
      content: {
        "application/json": components["schemas"]["ReserveSeatsDto"];
      };
    };
    responses: {
      201: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          "application/json": components["schemas"]["ApiResponseDto"] & {
            data?: components["schemas"]["ReserveSeatsResponseDto"];
          };
        };
      };
      /** @description Validation failure (Bad Request) */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/bad-request",
           *       "title": "Bad Request",
           *       "status": 400,
           *       "detail": "Submitted data format is invalid",
           *       "instance": "/api/example",
           *       "invalidParams": [
           *         {
           *           "name": "email",
           *           "reason": "Invalid email address format"
           *         }
           *       ],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Authentication required or invalid token (Unauthorized) */
      401: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/unauthorized",
           *       "title": "Unauthorized",
           *       "status": 401,
           *       "detail": "Unauthorized access",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Resource conflict (Conflict) */
      409: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/conflict",
           *       "title": "Conflict",
           *       "status": 409,
           *       "detail": "Email address already exists",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
      /** @description Rate limit exceeded (Too Many Requests) */
      429: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          /**
           * @example {
           *       "type": "http://localhost:3000/errors/too-many-requests",
           *       "title": "Too Many Requests",
           *       "status": 429,
           *       "detail": "Rate limit exceeded. Please try again later.",
           *       "instance": "/api/example",
           *       "invalidParams": [],
           *       "timestamp": "2026-07-25T02:45:00.000Z"
           *     }
           */
          "application/problem+json": components["schemas"]["Rfc9457ErrorResponseDto"];
        };
      };
    };
  };
}
