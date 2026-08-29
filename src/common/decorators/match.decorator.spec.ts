import { describe, expect, it } from "bun:test";
import { Match, MatchConstraint } from "./match.decorator";
import { validate, IsString } from "class-validator";

class TestPasswordDto {
  @IsString()
  password!: string;

  @Match("password")
  confirmPassword!: string;
}

describe("Match Decorator", () => {
  const constraint = new MatchConstraint();

  describe("MatchConstraint.validate", () => {
    it("should return true when target value and related value are identical", () => {
      const args = {
        constraints: ["password"],
        object: {
          password: "secretPassword",
          confirmPassword: "secretPassword",
        },
      };

      expect(constraint.validate("secretPassword", args as never)).toBe(true);
    });

    it("should return false when target value and related value do not match", () => {
      const args = {
        constraints: ["password"],
        object: {
          password: "secretPassword",
          confirmPassword: "differentPassword",
        },
      };

      expect(constraint.validate("differentPassword", args as never)).toBe(
        false,
      );
    });

    it("should return false when relatedPropertyName constraint is missing", () => {
      const args = {
        constraints: [],
        object: { password: "secretPassword" },
      };

      expect(constraint.validate("secretPassword", args as never)).toBe(false);
    });

    it("should deep equal complex object values", () => {
      const args = {
        constraints: ["meta"],
        object: { meta: { a: 1, b: 2 } },
      };

      expect(constraint.validate({ a: 1, b: 2 }, args as never)).toBe(true);
      expect(constraint.validate({ a: 1, b: 3 }, args as never)).toBe(false);
    });
  });

  describe("MatchConstraint.defaultMessage", () => {
    it("should return formatted validation message with target property name", () => {
      const args = {
        property: "confirmPassword",
        constraints: ["password"],
      };

      expect(constraint.defaultMessage(args as never)).toBe(
        "confirmPassword must match password",
      );
    });

    it("should return formatted message with fallback when constraints are empty", () => {
      const args = {
        property: "confirmPassword",
        constraints: [],
      };

      expect(constraint.defaultMessage(args as never)).toBe(
        "confirmPassword must match unknown",
      );
    });
  });

  describe("class-validator integration", () => {
    it("should pass validation when passwords match", async () => {
      const dto = new TestPasswordDto();
      dto.password = "P@ssword123";
      dto.confirmPassword = "P@ssword123";

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it("should fail validation with error when passwords mismatch", async () => {
      const dto = new TestPasswordDto();
      dto.password = "P@ssword123";
      dto.confirmPassword = "WrongPassword";

      const errors = await validate(dto);
      expect(errors.length).toBe(1);
      expect(errors[0]?.property).toBe("confirmPassword");
    });
  });
});
