import { hashPassword } from "@/common/utils/crypto.util";

/**
 * Default password assigned to all pre-seeded test and system accounts.
 */
export const DEFAULT_SEED_PASSWORD = "Password123!@#";

let cachedSeedPasswordHash: string | undefined;

/**
 * Retrieves the salted Scrypt password hash for the default seed password.
 * Memoizes the derived hash in memory to ensure single-calculation CPU efficiency (<1ms in test, ~50ms in dev)
 * while dynamically adapting to the active environment's Scrypt parameters (ADR 0007).
 *
 * @returns Colon-delimited salt and hex-encoded Scrypt hash
 */
export async function getSeedPasswordHash(): Promise<string> {
  cachedSeedPasswordHash ??= await hashPassword(DEFAULT_SEED_PASSWORD);
  return cachedSeedPasswordHash;
}

/**
 * Standard daily showtime slot times (Asia/Ho_Chi_Minh UTC+7).
 */
export const STANDARD_SHOW_SLOTS = [
  "09:30",
  "13:00",
  "16:30",
  "19:45",
  "22:15",
] as const;

/**
 * Valid atomic scope arguments supported by the database seeding engine.
 */
export const SEED_SCOPES = [
  "all",
  "reference",
  "catalog",
  "schedule",
  "genres",
  "seat-types",
  "users",
  "cinemas",
  "movies",
  "shows",
] as const;

export type SeedScope = (typeof SEED_SCOPES)[number];

/**
 * Parses and normalizes single string, comma-separated string, or array of scopes into a unique array of SeedScope.
 *
 * @param input - Raw scope input string, SeedScope, or array of SeedScope
 * @returns Array of validated SeedScope
 */
export function normalizeSeedScopes(
  input?: SeedScope | SeedScope[] | (string & {}),
): SeedScope[] {
  if (!input || input === "all") {
    return ["all"];
  }

  const rawArray = Array.isArray(input)
    ? input
    : input.split(",").map((s) => s.trim());

  const validScopes = new Set<SeedScope>();
  for (const item of rawArray) {
    if (SEED_SCOPES.includes(item as SeedScope)) {
      validScopes.add(item as SeedScope);
    } else {
      throw new Error(
        `Invalid seeding scope "${item}". Supported scopes: ${SEED_SCOPES.join(", ")}`,
      );
    }
  }

  return Array.from(validScopes);
}

/**
 * Evaluates whether any of the target scopes match the active scope list (handling 'all' wildcard).
 *
 * @param activeScopes - Current normalized list of active scopes
 * @param targets - Scopes to test against
 * @returns true if any target scope is active
 */
export function isScopeActive(
  activeScopes: SeedScope[],
  ...targets: SeedScope[]
): boolean {
  if (activeScopes.includes("all")) {
    return true;
  }
  return targets.some((target) => activeScopes.includes(target));
}

/**
 * Batch chunk sizes for high-performance multi-row database insertions.
 */
export const SEED_BATCH_CHUNK_SIZE = {
  SHOW_SEATS: 1000,
  SEATS: 500,
} as const;
