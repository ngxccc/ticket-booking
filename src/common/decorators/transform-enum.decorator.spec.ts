import { describe, expect, it } from "bun:test";
import { TransformEnum } from "./transform-enum.decorator";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

const ALLOWED_ROLES = ["ADMIN", "CUSTOMER", "OPERATOR"] as const;

class TestEnumDto {
  @TransformEnum(ALLOWED_ROLES)
  role!: string;
}

describe("TransformEnum Decorator", () => {
  it("should transform case-insensitive enum value to canonical format", async () => {
    const plain = { role: "admin" };
    const dto = plainToInstance(TestEnumDto, plain);

    expect(dto.role).toBe("ADMIN");

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should fail validation when enum value is not in allowed list", async () => {
    const plain = { role: "SUPERUSER" };
    const dto = plainToInstance(TestEnumDto, plain);

    const errors = await validate(dto);
    expect(errors.length).toBe(1);
    expect(errors[0]?.property).toBe("role");
  });

  it("should fail validation when enum value is empty", async () => {
    const plain = { role: "" };
    const dto = plainToInstance(TestEnumDto, plain);

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle non-string input safely during transformation", () => {
    const plain = { role: 12345 };
    const dto = plainToInstance(TestEnumDto, plain);

    expect(dto.role).toBe(12345 as unknown as string);
  });
});
