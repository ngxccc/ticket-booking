export function isPostgresErrorCode(
  error: unknown,
  targetCode: string,
): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code === targetCode;
}
