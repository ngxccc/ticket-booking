import { describe, expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import {
  generatePayOSOrderCode,
  isPayOSTimestampValid,
  sortAndFormatPayloadData,
  verifyPayOSSignature,
} from "./payos-crypto.util";

describe("PayOS Crypto & OrderCode Utilities", () => {
  describe("generatePayOSOrderCode", () => {
    it("should generate numeric orderCodes strictly within JS Number.MAX_SAFE_INTEGER", () => {
      const orderCode = generatePayOSOrderCode();

      expect(typeof orderCode).toBe("number");
      expect(Number.isInteger(orderCode)).toBe(true);
      expect(orderCode).toBeGreaterThan(0);
      expect(orderCode).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
    });

    it("should produce 100% collision-free unique orderCodes across rapid sequential calls", () => {
      const TOTAL_CODES = 10000;
      const codeSet = new Set<number>();

      for (let i = 0; i < TOTAL_CODES; i++) {
        const code = generatePayOSOrderCode();
        expect(code).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
        codeSet.add(code);
      }

      expect(codeSet.size).toBe(TOTAL_CODES);
    });
  });

  describe("sortAndFormatPayloadData", () => {
    it("should sort payload keys alphabetically and format as query string", () => {
      const payload = {
        orderCode: 123456,
        amount: 200000,
        description: "Cinema ticket booking",
      };

      const formatted = sortAndFormatPayloadData(payload);
      expect(formatted).toBe(
        "amount=200000&description=Cinema ticket booking&orderCode=123456",
      );
    });
  });

  describe("verifyPayOSSignature", () => {
    it("should return true when HMAC-SHA256 signature matches", () => {
      const payload = {
        amount: 150000,
        orderCode: 123456,
      };
      const checksumKey = "secret-checksum-key-12345";
      const validSignature = createHmac("sha256", checksumKey)
        .update("amount=150000&orderCode=123456")
        .digest("hex");

      const isValid = verifyPayOSSignature(
        payload,
        validSignature,
        checksumKey,
      );
      expect(isValid).toBe(true);
    });

    it("should return false when signature is invalid or tampered", () => {
      const payload = {
        amount: 150000,
        orderCode: 123456,
      };
      const checksumKey = "secret-checksum-key-12345";
      const invalidSignature = "invalid_tampered_signature_hex_code_123456";

      const isValid = verifyPayOSSignature(
        payload,
        invalidSignature,
        checksumKey,
      );
      expect(isValid).toBe(false);
    });
  });

  describe("isPayOSTimestampValid", () => {
    it("should return true when timestamp is within 5 minutes skew window", () => {
      const recentTimestamp = new Date(Date.now() - 60000).toISOString();
      expect(isPayOSTimestampValid(recentTimestamp, 300)).toBe(true);
    });

    it("should return false when timestamp is older than 5 minutes", () => {
      const staleTimestamp = new Date(Date.now() - 600000).toISOString();
      expect(isPayOSTimestampValid(staleTimestamp, 300)).toBe(false);
    });
  });
});
