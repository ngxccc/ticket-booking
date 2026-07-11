import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Hash a password using the Scrypt algorithm (built into Node.js/Bun)
 * @param password The user's plain-text password
 * @returns A hash string in the format salt:hash_key
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Compare a plain-text password with the hash stored in the database
 * @param password The plain-text password to verify
 * @param storedHash The hash stored in the DB (format salt:hash_key)
 */
export async function comparePassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  // WHY: Limit split to 2 parts to guard against malformed stored-hash values.
  const [salt, key] = storedHash.split(":", 2);
  if (!salt || !key) {
    return false;
  }
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuffer = Buffer.from(key, "hex");

  // WHY: timingSafeEqual throws if buffers differ in length — guard prevents an uncaught TypeError.
  if (derivedKey.length !== keyBuffer.length) {
    return false;
  }

  // WHY: Protect against timing attacks by using timingSafeEqual comparison.
  return timingSafeEqual(derivedKey, keyBuffer);
}
