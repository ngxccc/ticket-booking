import { NestFactory } from "@nestjs/core";
import { LOG_LEVELS, type LogLevel } from "@nestjs/common";
import { env, ENVIRONMENT_MODES } from "./env";
import { I18nValidationExceptionFilter, I18nValidationPipe } from "nestjs-i18n";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";

// WHY: Determine log levels dynamically based on NestJS LOG_LEVELS hierarchy (verbose -> debug -> log -> warn -> error -> fatal).
function getLogLevels(): LogLevel[] {
  if (env.NODE_ENV === ENVIRONMENT_MODES.DEVELOPMENT) {
    return LOG_LEVELS;
  }

  const targetIndex = LOG_LEVELS.indexOf(env.LOG_LEVEL);
  return targetIndex !== -1
    ? LOG_LEVELS.slice(targetIndex)
    : ["log", "warn", "error", "fatal"];
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: getLogLevels(),
  });

  // WHY: Trust reverse proxy headers (e.g. X-Forwarded-For from Cloudflare/Nginx) so throttler correctly identifies client IPs behind WAF/CDN.
  app.set("trust proxy", 1);

  // WHY: Enable shutdown hooks explicitly so NestJS can trigger onApplicationShutdown in OutboxService to clear background timers gracefully.
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new I18nValidationExceptionFilter());

  // WHY: Generate OpenAPI schema for automatic documentation, testing via Apidog/MCP, and SDK generation.
  const config = new DocumentBuilder()
    .setTitle("Ticket Booking API")
    .setDescription("The API specification for the Ticket Booking System")
    .setVersion("1.0.0")
    .setOpenAPIVersion("3.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // WHY: Expose the raw JSON specification so external tools (e.g. Apidog Auto-Import, Postman) can fetch it.
  app.use("/api-json", (_req: Request, res: Response) => {
    res.json(document);
  });

  // WHY: Serve a modern, interactive Scalar API Reference UI instead of the traditional Swagger UI.
  app.use(
    "/reference",
    apiReference({
      spec: {
        content: document,
      },
    }),
  );

  await app.listen(process.env["PORT"] ?? 3000);
}
void bootstrap();
