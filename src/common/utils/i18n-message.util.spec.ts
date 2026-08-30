import { describe, expect, it } from "bun:test";
import { i18nMsg, i18nZodMsg } from "./i18n-message.util";

describe("i18n Message Utility Specification", () => {
  describe("i18nMsg", () => {
    it("should return a function for class-validator integration", () => {
      const msgFn = i18nMsg("validation.isEmail");
      expect(typeof msgFn).toBe("function");
    });
  });

  describe("i18nZodMsg", () => {
    it("should format key with empty arguments when args are omitted", () => {
      const token = i18nZodMsg("validation.isEmail");
      expect(token).toBe("validation.isEmail|{}");
    });

    it("should format key with serialized JSON arguments when args are provided", () => {
      const token = i18nZodMsg("validation.minLength", { "0": 8 });
      expect(token).toBe('validation.minLength|{"0":8}');
    });
  });
});
