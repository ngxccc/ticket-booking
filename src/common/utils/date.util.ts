import { TIME_IN_MS } from "@/common/constants/time.constant";

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
