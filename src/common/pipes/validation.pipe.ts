import { BadRequestException, ValidationPipe } from "@nestjs/common";
import type { ValidationError } from "class-validator";

// WHY: Use ValidationPipe with exceptionFactory to flatten DTO validation errors into RFC 9457 invalidParams.
export function createAppValidationPipe(): ValidationPipe {
  return new ValidationPipe({
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
  });
}
