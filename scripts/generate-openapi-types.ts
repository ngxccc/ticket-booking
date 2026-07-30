import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import openapiTS, { astToString } from "openapi-typescript";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

async function generate() {
  // WHY: Dynamically import AppModule after setting SKIP_ENV_VALIDATION so environment validation does not throw during build-time schema generation.
  const { AppModule } = await import("../src/app.module");
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle("Ticket Booking API")
    .setDescription("The API specification for the Ticket Booking System")
    .setVersion("1.0.0")
    .setOpenAPIVersion("3.1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  await app.close();
  const ast = await openapiTS(
    document as unknown as Parameters<typeof openapiTS>[0],
  );
  const contents = astToString(ast);

  // WHY: Output to test/generated/api-schema.d.ts to preserve strict black-box separation between application source and test contract artifacts.
  const outputPath = resolve(process.cwd(), "test/generated/api-schema.d.ts");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, contents, "utf-8");

  console.log(`OpenAPI types successfully generated at ${outputPath}`);
}
generate().catch((err: unknown) => {
  console.error("Failed to generate OpenAPI types:", err);
  process.exit(1);
});
