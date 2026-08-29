import { describe, expect, it } from "bun:test";
import { IsEmailField } from "./is-email-field.decorator";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

class TestUserEmailDto {
  @IsEmailField()
  email!: string;
}

describe("IsEmailField Decorator", () => {
  it("should sanitize, trim, lowercase, and validate email string", async () => {
    const plain = { email: "  <script></script>ALEX@Example.COM   " };
    const dto = plainToInstance(TestUserEmailDto, plain);

    expect(dto.email).toBe("alex@example.com");

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should fail validation when email format is invalid", async () => {
    const plain = { email: "not-an-email" };
    const dto = plainToInstance(TestUserEmailDto, plain);

    const errors = await validate(dto);
    expect(errors.length).toBe(1);
    expect(errors[0]?.property).toBe("email");
  });

  it("should fail validation when email is empty", async () => {
    const plain = { email: "" };
    const dto = plainToInstance(TestUserEmailDto, plain);

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle non-string input safely during transformation", () => {
    const plain = { email: 12345 };
    const dto = plainToInstance(TestUserEmailDto, plain);

    expect(dto.email).toBe(12345 as unknown as string);
  });
});
