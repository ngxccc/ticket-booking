import {
  BadRequestException,
  Injectable,
  ValidationPipe,
  type ArgumentMetadata,
  type PipeTransform,
} from "@nestjs/common";
import type { ValidationError } from "class-validator";
import { ZodValidationPipe } from "./zod-validation.pipe";

/**
 * Hybrid validation pipe enabling gradual expand-contract migration from class-validator to Zod.
 */
@Injectable()
export class HybridValidationPipe implements PipeTransform {
  private readonly zodPipe = new ZodValidationPipe();
  private readonly classValidatorPipe = new ValidationPipe({
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
        detail: "common.INVALID_INPUT|{}",
        invalidParams,
      });
    },
  });

  /**
   * Delegates validation to ZodValidationPipe if DTO defines static zodSchema; otherwise falls back to class-validator.
   */
  public async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    const metatype = metadata.metatype;
    if (metatype && typeof metatype === "function") {
      const holder = metatype as unknown as { zodSchema?: unknown };
      if (holder.zodSchema) {
        return this.zodPipe.transform(value, metadata);
      }
    }
    return this.classValidatorPipe.transform(value, metadata);
  }
}

/**
 * Factory creating the application global validation pipe.
 */
export function createAppValidationPipe(): PipeTransform {
  return new HybridValidationPipe();
}
