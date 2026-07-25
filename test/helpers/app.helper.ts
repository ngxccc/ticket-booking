import { Test, type TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ValidationPipe,
  type INestApplication,
} from "@nestjs/common";
import { type ValidationError } from "class-validator";
import { AppModule } from "@/app.module";
import { MailService } from "@/modules/mail/mail.service";
import {
  DATABASE_CONNECTION,
  type DrizzleDB,
} from "@/database/database.module";

export interface TestAppSetup {
  app: INestApplication;
  db: DrizzleDB;
}

// WHY: Provide a standardized test application helper that mirrors production behavior (pipes, filters)
// and mock integrations like MailService to prevent side-effects.
export async function createTestApp(): Promise<TestAppSetup> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // WHY: Override MailService to bypass real Resend API calls during testing.
    .overrideProvider(MailService)
    .useValue({
      sendVerificationEmail: async () => Promise.resolve(),
      sendPasswordResetEmail: async () => Promise.resolve(),
    })
    .compile();

  const app = moduleFixture.createNestApplication();

  // WHY: Match the global pipes/filters configuration defined in src/main.ts for request validation.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const invalidParams = errors.map((err) => {
          const firstConstraintKey = Object.keys(err.constraints ?? {})[0];
          return {
            name: err.property,
            reason: firstConstraintKey
              ? (err.constraints?.[firstConstraintKey] ?? "Invalid value")
              : "Invalid value",
          };
        });

        return new BadRequestException({
          detail: "Invalid payload format",
          invalidParams,
        });
      },
    }),
  );

  await app.init();

  const db = app.get<DrizzleDB>(DATABASE_CONNECTION);

  return { app, db };
}
