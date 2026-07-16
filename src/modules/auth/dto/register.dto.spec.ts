import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { RegisterDto } from "./register.dto";
import { describe, expect, it } from "bun:test";

interface RawRegisterDto {
  email?: unknown;
  fullName?: unknown;
  phoneNumber?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
  agreeTerms?: unknown;
}

describe("RegisterDto Validation", () => {
  const getValidDto = (): RawRegisterDto => ({
    email: "test@example.com",
    fullName: "John Doe",
    phoneNumber: "0912345678",
    password: "Password123",
    confirmPassword: "Password123",
    agreeTerms: true,
  });

  const validateDto = async (dtoObj: RawRegisterDto) => {
    const dto = plainToInstance(RegisterDto, dtoObj);
    return validate(dto);
  };

  it("should pass validation with valid data", async () => {
    const dto = getValidDto();
    const errors = await validateDto(dto);
    expect(errors.length).toBe(0);
  });

  describe("Email Validation", () => {
    it("should fail when email is empty", async () => {
      const dto = getValidDto();
      dto.email = "";
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const emailError = errors.find((e) => e.property === "email");
      expect(emailError).toBeDefined();
    });

    it("should fail when email format is invalid", async () => {
      const dto = getValidDto();
      dto.email = "invalid-email-format";
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const emailError = errors.find((e) => e.property === "email");
      expect(emailError).toBeDefined();
    });
  });

  describe("Full Name Validation", () => {
    it("should fail when fullName is empty", async () => {
      const dto = getValidDto();
      dto.fullName = "";
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find((e) => e.property === "fullName");
      expect(nameError).toBeDefined();
    });
  });

  describe("Phone Number Validation", () => {
    it("should fail when phoneNumber is empty", async () => {
      const dto = getValidDto();
      dto.phoneNumber = "";
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const phoneError = errors.find((e) => e.property === "phoneNumber");
      expect(phoneError).toBeDefined();
    });

    it("should fail when phoneNumber is too short", async () => {
      const dto = getValidDto();
      dto.phoneNumber = "091234567"; // 9 digits
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const phoneError = errors.find((e) => e.property === "phoneNumber");
      expect(phoneError).toBeDefined();
    });

    it("should fail when phoneNumber is too long", async () => {
      const dto = getValidDto();
      dto.phoneNumber = "09123456789"; // 11 digits
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const phoneError = errors.find((e) => e.property === "phoneNumber");
      expect(phoneError).toBeDefined();
    });

    it("should fail when phoneNumber does not start with valid Vietnamese prefix", async () => {
      const dto = getValidDto();
      dto.phoneNumber = "0212345678"; // Prefix 02 is not 03/05/07/08/09
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const phoneError = errors.find((e) => e.property === "phoneNumber");
      expect(phoneError).toBeDefined();
    });

    it("should fail when phoneNumber contains non-numeric characters", async () => {
      const dto = getValidDto();
      dto.phoneNumber = "091234567a";
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const phoneError = errors.find((e) => e.property === "phoneNumber");
      expect(phoneError).toBeDefined();
    });
  });

  describe("Password Validation", () => {
    it("should fail when password is less than 8 characters", async () => {
      const dto = getValidDto();
      dto.password = "Pass12";
      dto.confirmPassword = "Pass12";
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const passwordError = errors.find((e) => e.property === "password");
      expect(passwordError).toBeDefined();
    });

    it("should fail when password does not contain an uppercase letter", async () => {
      const dto = getValidDto();
      dto.password = "password123";
      dto.confirmPassword = "password123";
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const passwordError = errors.find((e) => e.property === "password");
      expect(passwordError).toBeDefined();
    });

    it("should fail when password does not contain a number", async () => {
      const dto = getValidDto();
      dto.password = "Password";
      dto.confirmPassword = "Password";
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const passwordError = errors.find((e) => e.property === "password");
      expect(passwordError).toBeDefined();
    });

    it("should fail when password and confirmPassword do not match", async () => {
      const dto = getValidDto();
      dto.confirmPassword = "DifferentPassword123";
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const confirmError = errors.find((e) => e.property === "confirmPassword");
      expect(confirmError).toBeDefined();
    });
  });

  describe("Terms Acceptance Validation", () => {
    it("should fail when agreeTerms is false", async () => {
      const dto = getValidDto();
      dto.agreeTerms = false;
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const termsError = errors.find((e) => e.property === "agreeTerms");
      expect(termsError).toBeDefined();
    });

    it("should fail when agreeTerms is not a boolean", async () => {
      const dto = getValidDto();
      dto.agreeTerms = "true";
      const errors = await validateDto(dto);
      expect(errors.length).toBeGreaterThan(0);
      const termsError = errors.find((e) => e.property === "agreeTerms");
      expect(termsError).toBeDefined();
    });
  });
});
