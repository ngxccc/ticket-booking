export function sanitizeString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  // Strip HTML tags to prevent stored XSS injection
  return value.replace(/<[^>]*>/g, "").trim();
}
