import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import { Logger } from "nestjs-pino";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  // WHY: Trust reverse proxy headers (e.g. X-Forwarded-For from Cloudflare/Nginx) so throttler correctly identifies client IPs behind WAF/CDN.
  app.set("trust proxy", 1);

  // WHY: Enable shutdown hooks explicitly so NestJS can trigger onApplicationShutdown in OutboxService to clear background timers gracefully.
  app.enableShutdownHooks();

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
