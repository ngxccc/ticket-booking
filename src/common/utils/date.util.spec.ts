import { describe, expect, it } from "bun:test";
import {
  parseDuration,
  getExpiryDate,
  getPastDate,
  minutesToMs,
  daysToMs,
  getTimezoneDateParts,
} from "./date.util";
import { TIME_IN_MS } from "@/common/constants/time.constant";

describe("Date Utilities", () => {
  describe("parseDuration", () => {
    it("should return milliseconds when duration unit is days", () => {
      expect(parseDuration("7d")).toBe(7 * TIME_IN_MS.DAY);
      expect(parseDuration("1d")).toBe(TIME_IN_MS.DAY);
    });

    it("should return milliseconds when duration unit is hours", () => {
      expect(parseDuration("2h")).toBe(2 * TIME_IN_MS.HOUR);
      expect(parseDuration("24h")).toBe(24 * TIME_IN_MS.HOUR);
    });

    it("should return milliseconds when duration unit is minutes", () => {
      expect(parseDuration("15m")).toBe(15 * TIME_IN_MS.MINUTE);
      expect(parseDuration("1m")).toBe(TIME_IN_MS.MINUTE);
    });

    it("should return milliseconds when duration unit is seconds", () => {
      expect(parseDuration("30s")).toBe(30 * TIME_IN_MS.SECOND);
      expect(parseDuration("1s")).toBe(TIME_IN_MS.SECOND);
    });

    it("should return default milliseconds when input is not a number", () => {
      expect(parseDuration("invalid")).toBe(7 * TIME_IN_MS.DAY);
      expect(parseDuration("invalid", 5000)).toBe(5000);
    });

    it("should return default milliseconds when unit is unrecognized", () => {
      expect(parseDuration("10x")).toBe(7 * TIME_IN_MS.DAY);
      expect(parseDuration("10x", 1234)).toBe(1234);
    });
  });

  describe("getExpiryDate", () => {
    it("should return a future Date when calculating expiry from duration string", () => {
      const before = Date.now();
      const expiry = getExpiryDate("15m");
      const after = Date.now();

      expect(expiry.getTime()).toBeGreaterThanOrEqual(
        before + 15 * TIME_IN_MS.MINUTE,
      );
      expect(expiry.getTime()).toBeLessThanOrEqual(
        after + 15 * TIME_IN_MS.MINUTE,
      );
    });
  });

  describe("getPastDate", () => {
    it("should return a past Date when calculating past date from duration string", () => {
      const before = Date.now();
      const past = getPastDate("15m");
      const after = Date.now();

      expect(past.getTime()).toBeLessThanOrEqual(
        after - 15 * TIME_IN_MS.MINUTE,
      );
      expect(past.getTime()).toBeGreaterThanOrEqual(
        before - 15 * TIME_IN_MS.MINUTE - 100,
      );
    });
  });

  describe("minutesToMs and daysToMs", () => {
    it("should return milliseconds when converting minutes", () => {
      expect(minutesToMs(5)).toBe(5 * 60 * 1000);
      expect(minutesToMs(0)).toBe(0);
    });

    it("should return milliseconds when converting days", () => {
      expect(daysToMs(3)).toBe(3 * 24 * 60 * 60 * 1000);
      expect(daysToMs(0)).toBe(0);
    });
  });

  describe("getTimezoneDateParts", () => {
    it("should correctly extract numerical date parts in Asia/Ho_Chi_Minh timezone", () => {
      // 2026-09-01T02:00:00Z -> 2026-09-01 09:00:00 UTC+7
      const utcDate = new Date("2026-09-01T02:00:00Z");
      const parts = getTimezoneDateParts(utcDate, "Asia/Ho_Chi_Minh");

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(9);
      expect(parts.day).toBe(1);
    });

    it("should handle late night UTC rollover to next calendar day in UTC+7", () => {
      // 2026-08-31T20:00:00Z -> 2026-09-01 03:00:00 UTC+7
      const utcDate = new Date("2026-08-31T20:00:00Z");
      const parts = getTimezoneDateParts(utcDate, "Asia/Ho_Chi_Minh");

      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(9);
      expect(parts.day).toBe(1);
    });

    it("should default to current date and Asia/Ho_Chi_Minh timezone when called with no arguments", () => {
      const parts = getTimezoneDateParts();
      expect(parts.year).toBeGreaterThanOrEqual(2024);
      expect(parts.month).toBeGreaterThanOrEqual(1);
      expect(parts.month).toBeLessThanOrEqual(12);
      expect(parts.day).toBeGreaterThanOrEqual(1);
      expect(parts.day).toBeLessThanOrEqual(31);
    });
  });
});
