export function isPostgresErrorCode(
  error: unknown,
  targetCode: string,
): boolean {
  if (typeof error !== "object" || error === null) return false;
  const directCode = (error as { code?: unknown }).code;
  if (typeof directCode === "string" && directCode === targetCode) return true;

  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === "object" && cause !== null) {
    const causeCode = (cause as { code?: unknown }).code;
    return typeof causeCode === "string" && causeCode === targetCode;
  }
  return false;
}
