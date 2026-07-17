import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const ENVIRONMENT_MODES = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
} as const;

export const env = createEnv({
  server: {
    PORT: z.string().transform(Number).default(3000),
    DOMAIN_NAME: z.url().default("http://localhost:3000"),
    NODE_ENV: z
      .enum([
        ENVIRONMENT_MODES.DEVELOPMENT,
        ENVIRONMENT_MODES.PRODUCTION,
        ENVIRONMENT_MODES.TEST,
      ])
      .default(ENVIRONMENT_MODES.DEVELOPMENT),

    // Database configuration
    DB_URL: z.url().optional(),
    DB_HOST: z.string().default("localhost"),
    DB_PORT: z.string().transform(Number).default(5432),
    DB_USERNAME: z.string().default("postgres"),
    DB_PASSWORD: z.string().default("postgrespassword"),
    DB_DATABASE: z.string().default("ticket_booking"),

    // Redis configuration
    REDIS_URL: z.url().optional(),
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.string().transform(Number).default(6379),

    // Resend configuration
    RESEND_API_KEY: z.string().default("re_dummy_key_for_testing"),
    EMAIL_FROM: z.string().default("Ticket Booking <onboarding@resend.dev>"),

    // JWT configuration
    JWT_SECRET: z
      .string()
      .default("super-secret-jwt-key-minimum-32-chars-long"),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  },

  runtimeEnv: {
    PORT: process.env["PORT"],
    DOMAIN_NAME: process.env["DOMAIN_NAME"],
    NODE_ENV: process.env.NODE_ENV,
    DB_URL: process.env["DB_URL"],
    DB_HOST: process.env["DB_HOST"],
    DB_PORT: process.env["DB_PORT"],
    DB_USERNAME: process.env["DB_USERNAME"],
    DB_PASSWORD: process.env["DB_PASSWORD"],
    DB_DATABASE: process.env["DB_DATABASE"],
    REDIS_URL: process.env["REDIS_URL"],
    REDIS_HOST: process.env["REDIS_HOST"],
    REDIS_PORT: process.env["REDIS_PORT"],
    RESEND_API_KEY: process.env["RESEND_API_KEY"],
    EMAIL_FROM: process.env["EMAIL_FROM"],
    JWT_SECRET: process.env["JWT_SECRET"],
    JWT_ACCESS_EXPIRES_IN: process.env["JWT_ACCESS_EXPIRES_IN"],
    JWT_REFRESH_EXPIRES_IN: process.env["JWT_REFRESH_EXPIRES_IN"],
  },

  emptyStringAsUndefined: true,
  skipValidation:
    !!process.env["SKIP_ENV_VALIDATION"] || process.env.NODE_ENV === "test",

  onValidationError: (issues) => {
    console.error("❌ Invalid environment variables configuration:");
    issues.forEach((issue) => {
      let pathString = "root";
      if (issue.path && Array.isArray(issue.path)) {
        pathString = issue.path.map((segment) => String(segment)).join(".");
      }

      console.error(` - ${pathString}: ${issue.message}`);
    });
    process.exit(1);
  },
});
