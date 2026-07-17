import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function comparePassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  // WHY: Split limit of 2 guards against colons inside a base-encoded key segment producing extra parts.
  const [salt, key] = storedHash.split(":", 2);
  if (!salt || !key) {
    return false;
  }
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuffer = Buffer.from(key, "hex");

  // WHY: timingSafeEqual throws on length mismatch — guard prevents an uncaught TypeError.
  if (derivedKey.length !== keyBuffer.length) {
    return false;
  }

  // WHY: Timing-safe comparison prevents timing-attack inference of the correct hash length.
  return timingSafeEqual(derivedKey, keyBuffer);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
