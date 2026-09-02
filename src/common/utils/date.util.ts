import { TIME_IN_MS } from "@/common/constants/time.constant";

const timezoneFormatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Parse a duration string (e.g., "7d", "15m", "2h", "30s") and return its equivalent in milliseconds.
 * @param duration The duration string
 * @param defaultMs Default milliseconds to return if parsing fails (defaults to 7 days)
 */
export function parseDuration(
  duration: string,
  defaultMs = 7 * TIME_IN_MS.DAY,
): number {
  const value = parseInt(duration, 10);
  const unit = duration.slice(-1);

  if (isNaN(value)) {
    return defaultMs;
  }

  switch (unit) {
    case "d":
      return value * TIME_IN_MS.DAY;
    case "h":
      return value * TIME_IN_MS.HOUR;
    case "m":
      return value * TIME_IN_MS.MINUTE;
    case "s":
      return value * TIME_IN_MS.SECOND;
    default:
      return defaultMs;
  }
}

/**
 * Calculate an expiration Date object from a duration string.
 * @param duration The duration string (e.g., "7d", "15m")
 */
export function getExpiryDate(duration: string): Date {
  return new Date(Date.now() + parseDuration(duration));
}

/**
 * Calculate a past Date object from a duration string (e.g., "7d", "15m").
 * @param duration The duration string
 */
export function getPastDate(duration: string): Date {
  return new Date(Date.now() - parseDuration(duration));
}

/**
 * Convert minutes to equivalent milliseconds.
 * @param minutes Number of minutes
 */
export function minutesToMs(minutes: number): number {
  return minutes * TIME_IN_MS.MINUTE;
}

/**
 * Convert days to equivalent milliseconds.
 * @param days Number of days
 */
export function daysToMs(days: number): number {
  return days * TIME_IN_MS.DAY;
}

/**
 * Extracts numerical calendar date parts ({ year, month, day }) in a target IANA timezone.
 * Uses cached Intl.DateTimeFormat instances to eliminate object allocation overhead on repeated calls.
 *
 * @param date - Source Date instance (defaults to new Date())
 * @param timeZone - Target IANA timezone identifier (defaults to "Asia/Ho_Chi_Minh")
 * @returns Object containing numerical { year, month, day } where month is 1-indexed (1..12)
 */
export function getTimezoneDateParts(
  date: Date = new Date(),
  timeZone = "Asia/Ho_Chi_Minh",
): { year: number; month: number; day: number } {
  let formatter = timezoneFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    timezoneFormatterCache.set(timeZone, formatter);
  }

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return { year, month, day };
}

/**
 * Formats a Date instance as a YYYY-MM-DD calendar date string in a specified target IANA timezone.
 *
 * @param date Source Date instance (defaults to new Date())
 * @param timeZone Target IANA timezone identifier (defaults to "Asia/Ho_Chi_Minh")
 * @returns Formatted YYYY-MM-DD calendar date string
 */
export function formatTimezoneDate(
  date: Date = new Date(),
  timeZone = "Asia/Ho_Chi_Minh",
): string {
  const { year, month, day } = getTimezoneDateParts(date, timeZone);
  return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Calculates a future calendar date string (YYYY-MM-DD) within an allowed forward day horizon in a target timezone.
 *
 * @param days Number of forward calendar days to add
 * @param timeZone Target IANA timezone identifier (defaults to "Asia/Ho_Chi_Minh")
 * @returns Formatted YYYY-MM-DD calendar date string
 */
export function getFutureTimezoneDate(
  days: number,
  timeZone = "Asia/Ho_Chi_Minh",
): string {
  const futureDate = new Date(Date.now() + days * TIME_IN_MS.DAY);
  return formatTimezoneDate(futureDate, timeZone);
}
