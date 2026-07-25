import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { ChangePasswordDto } from "./change-password.dto";
import { describe, expect, it } from "bun:test";

const valid = (overrides = {}) =>
  plainToInstance(ChangePasswordDto, {
    currentPassword: "OldPassword123!",
    newPassword: "NewPassword456!",
    ...overrides,
  });

describe("ChangePasswordDto Validation", () => {
  it("passes with valid inputs", async () => {
    const errors = await validate(valid());
    expect(errors).toHaveLength(0);
  });

  describe("currentPassword boundaries", () => {
    it("rejects empty string", async () => {
      const errors = await validate(valid({ currentPassword: "" }));
      expect(errors.some((e) => e.property === "currentPassword")).toBe(true);
    });

    it("rejects missing currentPassword", async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        newPassword: "NewPassword456!",
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === "currentPassword")).toBe(true);
    });

    it("rejects non-string values", async () => {
      const errors = await validate(valid({ currentPassword: 12345678 }));
      expect(errors.some((e) => e.property === "currentPassword")).toBe(true);
    });

    it("rejects currentPassword exceeding 256 chars", async () => {
      const errors = await validate(
        valid({ currentPassword: "x".repeat(257) }),
      );
      expect(errors.some((e) => e.property === "currentPassword")).toBe(true);
    });
  });

  describe("newPassword length boundaries (BVA)", () => {
    it("rejects 7-char password (min - 1)", async () => {
      const errors = await validate(valid({ newPassword: "Abcde1x" }));
      expect(errors.some((e) => e.property === "newPassword")).toBe(true);
    });

    it("accepts 8-char password (exact min)", async () => {
      const errors = await validate(valid({ newPassword: "Abcdef1!" }));
      expect(errors).toHaveLength(0);
    });

    it("accepts 9-char password (min + 1)", async () => {
      const errors = await validate(valid({ newPassword: "Abcdefg1!" }));
      expect(errors).toHaveLength(0);
    });

    it("rejects newPassword exceeding 128 chars", async () => {
      const errors = await validate(
        valid({ newPassword: "A1!" + "x".repeat(126) }),
      );
      expect(errors.some((e) => e.property === "newPassword")).toBe(true);
    });
  });

  describe("newPassword complexity boundaries", () => {
    it("rejects password with no uppercase letter", async () => {
      const errors = await validate(valid({ newPassword: "abcdefg1!" }));
      expect(errors.some((e) => e.property === "newPassword")).toBe(true);
    });

    it("rejects password with no digit", async () => {
      const errors = await validate(valid({ newPassword: "Abcdefgh!" }));
      expect(errors.some((e) => e.property === "newPassword")).toBe(true);
    });

    it("rejects password with no special character", async () => {
      const errors = await validate(valid({ newPassword: "Abcdefg1" }));
      expect(errors.some((e) => e.property === "newPassword")).toBe(true);
    });

    it("rejects password with neither uppercase nor digit nor special char", async () => {
      const errors = await validate(valid({ newPassword: "abcdefgh" }));
      expect(errors.some((e) => e.property === "newPassword")).toBe(true);
    });

    it("accepts uppercase + digit + special char (minimum valid complexity)", async () => {
      const errors = await validate(valid({ newPassword: "ABCDEFG1!" }));
      expect(errors).toHaveLength(0);
    });
  });

  describe("newPassword unicode edge cases", () => {
    it("rejects 4-emoji string (JS length 8 but 0 uppercase, 0 digit)", async () => {
      const errors = await validate(valid({ newPassword: "🔑🔑🔑🔑" }));
      expect(errors.some((e) => e.property === "newPassword")).toBe(true);
    });

    it("accepts emoji + ASCII uppercase + digit", async () => {
      const errors = await validate(valid({ newPassword: "🔑Abcdef1" }));
      expect(errors).toHaveLength(0);
    });
  });
});
