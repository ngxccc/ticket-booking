import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";
import type { INestApplication } from "@nestjs/common";
import type { Request, Response } from "express";
import { apiReference } from "@scalar/nestjs-api-reference";

/**
 * Builds the official OpenAPI 3.1.0 specification document for the Ticket Booking platform.
 *
 * @param app - Initialized NestJS application instance.
 * @returns Fully generated OpenAPIObject schema document.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Ticket Booking API")
    .setDescription(
      "High-concurrency movie ticket booking platform with seat locking, conflict detection, and payment integrations.",
    )
    .setVersion("1.0.0")
    .setOpenAPIVersion("3.1.0")
    .addTag("auth", "Authentication, session management, and password recovery")
    .addTag("users", "User profile retrieval and management")
    .addTag(
      "movies",
      "Public movie catalog discovery, details, and localization",
    )
    .addTag(
      "cinemas",
      "Cinema complexes, screening halls, and locations exploration",
    )
    .addTag(
      "shows",
      "Movie showtime scheduling, discovery, and seat pre-allocation",
    )
    .addTag(
      "bookings",
      "Seat reservation, Redlock concurrency, and booking lifecycle",
    )
    .addTag("payments", "Payment gateway webhook processing and verification")
    .addTag("app", "System health and operational monitoring")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your JWT token in the format: Bearer <token>",
      },
      "bearer",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Post-process document for OpenAPI 3.1: resolves Zod schemas, nullable unions, and cleans empty types.
  return cleanupOpenApiDoc(document, { version: "3.1" });
}

/**
 * Mounts the raw JSON specification and Scalar interactive API documentation routes onto the NestJS app.
 *
 * @param app - Initialized NestJS application instance.
 * @returns Generated OpenAPI document for downstream consumers.
 */
export function setupOpenApiAndScalar(app: INestApplication): OpenAPIObject {
  const document = createOpenApiDocument(app);

  // Expose raw JSON specification at /openapi.json for automated validation and frontend SDK generators.
  app.use("/openapi.json", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.json(document);
  });

  // Serve modern, interactive Scalar API Reference UI at /api/docs with live testing capability.
  app.use(
    "/api/docs",
    apiReference({
      spec: {
        content: document,
      },
      theme: "saturn",
    }),
  );

  return document;
}
