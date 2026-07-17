/**
 * Parse a duration string (e.g., "7d", "15m", "2h", "30s") and return its equivalent in milliseconds.
 * @param duration The duration string
 * @param defaultMs Default milliseconds to return if parsing fails (defaults to 7 days)
 */
export function parseDuration(
  duration: string,
  defaultMs = 7 * 24 * 60 * 60 * 1000,
): number {
  const value = parseInt(duration, 10);
  const unit = duration.slice(-1);

  if (isNaN(value)) {
    return defaultMs;
  }

  switch (unit) {
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "m":
      return value * 60 * 1000;
    case "s":
      return value * 1000;
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
