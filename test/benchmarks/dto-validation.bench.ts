import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { z } from "zod";
import { LoginDto } from "@/modules/auth/dto/login.dto";
import { RegisterDto } from "@/modules/auth/dto/register.dto";
import { CreateShowBatchDto } from "@/modules/shows/dto/create-show-batch.dto";
import {
  zEmail,
  zPassword,
  zPhoneNumber,
  zSanitizedString,
  zUuidV7,
} from "@/common/schemas/zod-primitives";
import { measureBenchmark, type BenchmarkMetric } from "./benchmark.util";

/**
 * Zod equivalents for side-by-side baseline benchmark comparisons.
 */
const zodLoginSchema = z
  .object({
    email: zEmail(),
    password: z.string().min(8),
  })
  .strict();

const zodRegisterSchema = z
  .object({
    email: zEmail(),
    fullName: zSanitizedString({ min: 1, max: 100 }),
    phoneNumber: zPhoneNumber(),
    password: zPassword(),
    confirmPassword: z.string().min(8),
    agreeTerms: z.literal(true),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
  });

const zodCreateShowBatchSchema = z
  .object({
    movieId: zUuidV7(),
    hallId: zUuidV7(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeSlots: z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)),
    basePrice: z.number().int().min(0),
  })
  .strict();

export function runBenchmark(): BenchmarkMetric[] {
  const metrics: BenchmarkMetric[] = [];
  const ITERATIONS = 10000;
  const WARMUP = 1000;

  // 1. Small DTO (Login Payload - Valid Happy Path)
  const loginPayload = {
    email: "user@example.com",
    password: "Password123!",
  };

  metrics.push(
    measureBenchmark(
      "Small DTO Valid: class-validator (LoginDto)",
      () => {
        const dto = plainToInstance(LoginDto, loginPayload);
        validateSync(dto);
      },
      ITERATIONS,
      WARMUP,
    ),
  );

  metrics.push(
    measureBenchmark(
      "Small DTO Valid: Zod schema (LoginDto)",
      () => {
        zodLoginSchema.safeParse(loginPayload);
      },
      ITERATIONS,
      WARMUP,
    ),
  );

  // 2. Medium DTO (Register Payload - Valid Happy Path)
  const registerPayload = {
    email: "john.doe@example.com",
    fullName: "John Doe",
    phoneNumber: "0912345678",
    password: "Password123!",
    confirmPassword: "Password123!",
    agreeTerms: true,
  };

  metrics.push(
    measureBenchmark(
      "Medium DTO Valid: class-validator (RegisterDto)",
      () => {
        const dto = plainToInstance(RegisterDto, registerPayload);
        validateSync(dto);
      },
      ITERATIONS,
      WARMUP,
    ),
  );

  metrics.push(
    measureBenchmark(
      "Medium DTO Valid: Zod schema (RegisterDto)",
      () => {
        zodRegisterSchema.safeParse(registerPayload);
      },
      ITERATIONS,
      WARMUP,
    ),
  );

  // 3. Large / Array DTO (CreateShowBatch Payload - Valid Happy Path)
  const batchPayload = {
    movieId: "019fa8bc-8f4d-7000-b366-e691f45cfb8f",
    hallId: "019fa8bc-8f4d-7000-b366-e691f45cfb90",
    startDate: "2026-10-01",
    endDate: "2026-10-30",
    timeSlots: ["08:00", "11:00", "14:00", "17:00", "20:00", "22:30"],
    basePrice: 150000,
  };

  metrics.push(
    measureBenchmark(
      "Large DTO Valid: class-validator (CreateShowBatchDto)",
      () => {
        const dto = plainToInstance(CreateShowBatchDto, batchPayload);
        validateSync(dto);
      },
      ITERATIONS,
      WARMUP,
    ),
  );

  metrics.push(
    measureBenchmark(
      "Large DTO Valid: Zod schema (CreateShowBatchDto)",
      () => {
        zodCreateShowBatchSchema.safeParse(batchPayload);
      },
      ITERATIONS,
      WARMUP,
    ),
  );

  // 4. Invalid Payload Stress (Error Path - Multi-Field Failures)
  const invalidRegisterPayload = {
    email: "not-an-email",
    fullName: "",
    phoneNumber: "12345",
    password: "weak",
    confirmPassword: "mismatch",
    agreeTerms: false,
  };

  metrics.push(
    measureBenchmark(
      "Invalid DTO (Error Path): class-validator (RegisterDto)",
      () => {
        const dto = plainToInstance(RegisterDto, invalidRegisterPayload);
        validateSync(dto);
      },
      ITERATIONS,
      WARMUP,
    ),
  );

  metrics.push(
    measureBenchmark(
      "Invalid DTO (Error Path): Zod schema (RegisterDto)",
      () => {
        zodRegisterSchema.safeParse(invalidRegisterPayload);
      },
      ITERATIONS,
      WARMUP,
    ),
  );

  return metrics;
}

export default runBenchmark;
