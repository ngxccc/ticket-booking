import "reflect-metadata";
process.env["SKIP_ENV_VALIDATION"] = "true";

async function generate() {
  const { NestFactory } = await import("@nestjs/core");
  const { AppModule } = await import("../src/app.module");
  const { createOpenApiDocument } =
    await import("../src/common/config/openapi.config");

  const app = await NestFactory.create(AppModule, { logger: false });
  const document = createOpenApiDocument(app);

  const openapiTSModule = await import("openapi-typescript");
  const openapiTS = openapiTSModule.default;
  const { astToString } = openapiTSModule;
  const ast = await openapiTS(
    document as unknown as Parameters<typeof openapiTS>[0],
  );
  const rawContents = astToString(ast);

  const outputPath = "test/generated/api-schema.d.ts";
  await Bun.write(outputPath, rawContents);

  console.log(`OpenAPI types successfully generated at ${outputPath}`);
}

generate().catch((err: unknown) => {
  console.error("Failed to generate OpenAPI types:", err);
  process.exit(1);
});
