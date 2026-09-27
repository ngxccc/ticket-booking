import {
  BadRequestException,
  Injectable,
  Optional,
  type ArgumentMetadata,
  type PipeTransform,
} from "@nestjs/common";
import { type ZodError, type ZodType } from "zod";
import { i18nZodMsg } from "@/common/utils/i18n-message.util";

/**
 * Formats a Zod issue path array into a dot/bracket notation string (e.g. timeSlots[2], customer.address.city).
 *
 * @param path Array of string, number, or symbol path segments from ZodIssue
 * @returns Human-readable property path string
 */
export function formatZodIssuePath(
  path?: readonly PropertyKey[] | (string | number)[],
): string {
  if (!path || path.length === 0) {
    return "";
  }

  return path.reduce<string>((acc, segment, index) => {
    const str = String(segment);
    if (typeof segment === "number") {
      return `${acc}[${str}]`;
    }
    if (index === 0) {
      return str;
    }
    return `${acc}.${str}`;
  }, "");
}

/**
 * Standard Schema and Zod schema holder interface for DTO metatypes.
 */
interface SchemaHolder {
  zodSchema?: ZodType;
  schema?: ZodType;
}

/**
 * Validates incoming HTTP request payloads using Zod schemas and formats errors into RFC 9457 Problem Details.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(@Optional() private readonly schema?: ZodType) {}

  /**
   * Transforms and validates the incoming payload against the configured or inferred Zod schema.
   *
   * @param value Incoming raw request body, query, or parameter
   * @param metadata NestJS pipeline argument metadata
   * @returns Sanitized and type-validated payload
   * @throws BadRequestException with RFC 9457 invalidParams when payload fails schema validation
   */
  public transform(value: unknown, metadata?: ArgumentMetadata): unknown {
    const activeSchema = this.resolveSchema(metadata);

    if (!activeSchema) {
      // Passthrough when no validation schema is declared on the route or metatype.
      return value;
    }

    const result = activeSchema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    const invalidParams = this.formatZodErrors(result.error);

    throw new BadRequestException({
      detail: i18nZodMsg("common.INVALID_INPUT"),
      invalidParams,
    });
  }

  /**
   * Resolves the effective Zod schema from pipe constructor or route metatype properties.
   */
  private resolveSchema(metadata?: ArgumentMetadata): ZodType | undefined {
    if (this.schema) {
      return this.schema;
    }

    const metatype = metadata?.metatype;
    if (metatype && typeof metatype === "function") {
      const holder = metatype as unknown as SchemaHolder;
      if (holder.zodSchema) {
        return holder.zodSchema;
      }
      if (holder.schema) {
        return holder.schema;
      }
    }

    return undefined;
  }

  /**
   * Transforms Zod error issues into RFC 9457 invalidParams list with automatic i18n token resolution.
   */
  private formatZodErrors(error: ZodError): { name: string; reason: string }[] {
    const params: { name: string; reason: string }[] = [];

    for (const issue of error.issues) {
      // Handle unrecognized keys from .strict() objects where issue.path is empty and keys are listed in issue.keys
      if (
        issue.code === "unrecognized_keys" &&
        Array.isArray((issue as unknown as { keys?: string[] }).keys)
      ) {
        const unrecognizedKeys = (issue as unknown as { keys: string[] }).keys;
        const prefix = formatZodIssuePath(issue.path);
        for (const key of unrecognizedKeys) {
          params.push({
            name: prefix ? `${prefix}.${key}` : key,
            reason: issue.message || `Unrecognized key: "${key}"`,
          });
        }
        continue;
      }

      const fieldPath = formatZodIssuePath(issue.path);
      params.push({
        name: fieldPath || "payload",
        reason: this.resolveIssueReason(issue),
      });
    }

    return params;
  }

  /**
   * Resolves raw Zod issue into encoded i18n translation token.
   */
  private resolveIssueReason(issue: ZodError["issues"][number]): string {
    if (issue.message.includes("|")) {
      return issue.message;
    }

    switch (issue.code) {
      case "invalid_type": {
        const issueObj = issue as unknown as {
          received?: string;
          expected?: string;
        };
        if (issueObj.received === "undefined" || issueObj.received === "null") {
          return i18nZodMsg("validation.isNotEmpty");
        }
        if (issueObj.expected === "string") {
          return i18nZodMsg("validation.isString");
        }
        if (issueObj.expected === "number") {
          return i18nZodMsg("validation.isInt");
        }
        if (issueObj.expected === "boolean") {
          return i18nZodMsg("validation.isBoolean");
        }
        return i18nZodMsg("common.INVALID_INPUT");
      }
      case "too_small": {
        const issueObj = issue as unknown as {
          type?: string;
          minimum?: number;
        };
        if (issueObj.type === "string") {
          return i18nZodMsg("validation.minLength", {
            "0": issueObj.minimum ?? 0,
          });
        }
        if (issueObj.type === "number") {
          return i18nZodMsg("validation.isPositive");
        }
        if (issueObj.type === "array") {
          return i18nZodMsg("validation.isNotEmpty");
        }
        return i18nZodMsg("common.INVALID_INPUT");
      }
      case "too_big": {
        const issueObj = issue as unknown as { maximum?: number };
        return i18nZodMsg("validation.maxLength", {
          "0": issueObj.maximum ?? Infinity,
        });
      }
      case "invalid_format": {
        const issueObj = issue as unknown as { format?: string };
        if (issueObj.format === "email") {
          return i18nZodMsg("validation.isEmail");
        }
        if (issueObj.format === "uuid") {
          return i18nZodMsg("validation.isUuid");
        }
        if (
          issueObj.format === "datetime" ||
          issueObj.format === "date" ||
          issueObj.format === "iso_date" ||
          issueObj.format === "iso_datetime"
        ) {
          return i18nZodMsg("validation.isDate");
        }
        if (issueObj.format === "regex") {
          return i18nZodMsg("validation.matches");
        }
        return i18nZodMsg("common.INVALID_INPUT");
      }
      case "invalid_value": {
        const issueObj = issue as unknown as { values?: unknown[] };
        if (Array.isArray(issueObj.values)) {
          return i18nZodMsg("validation.isIn", {
            "0": issueObj.values.join(", "),
          });
        }
        return i18nZodMsg("common.INVALID_INPUT");
      }
      default:
        return issue.message || i18nZodMsg("common.INVALID_INPUT");
    }
  }
}
