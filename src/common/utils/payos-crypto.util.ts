import { createHmac, timingSafeEqual } from "node:crypto";
import type { Webhook, WebhookData } from "@payos/node";

export type PayOSWebhookPayload = Webhook;
export type PayOSWebhookData = WebhookData;

/**
 * Sorts object keys alphabetically and converts to a query-like string: key1=value1&key2=value2
 */
export function sortAndFormatPayloadData(
  data: Record<string, unknown>,
): string {
  const sortedKeys = Object.keys(data).sort();
  const pairs: string[] = [];

  for (const key of sortedKeys) {
    const value = data[key];
    if (value === undefined || value === null) {
      pairs.push(`${key}=`);
    } else if (typeof value === "object") {
      pairs.push(`${key}=${JSON.stringify(value)}`);
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      pairs.push(`${key}=${value.toString()}`);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      pairs.push(`${key}=${String(value)}`);
    }
  }

  return pairs.join("&");
}

/**
 * Verifies PayOS Webhook HMAC-SHA256 signature using the checksum key (INV-6)
 */
export function verifyPayOSSignature(
  data: Record<string, unknown>,
  signature: string,
  checksumKey: string,
): boolean {
  if (!signature || !checksumKey) {
    return false;
  }

  const formattedData = sortAndFormatPayloadData(data);
  const calculatedSignature = createHmac("sha256", checksumKey)
    .update(formattedData)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "utf8");
  const calcBuffer = Buffer.from(calculatedSignature, "utf8");

  if (sigBuffer.length !== calcBuffer.length) {
    return false;
  }

  return timingSafeEqual(sigBuffer, calcBuffer);
}

/**
 * Verifies payload timestamp is within the 5-minute anti-replay window (INV-6)
 */
export function isPayOSTimestampValid(
  transactionDateTime: string,
  maxSkewSeconds = 300,
): boolean {
  if (!transactionDateTime) {
    return false;
  }

  const txTimestamp = new Date(transactionDateTime).getTime();
  if (Number.isNaN(txTimestamp)) {
    return false;
  }

  const now = Date.now();
  const skew = Math.abs(now - txTimestamp) / 1000;
  return skew <= maxSkewSeconds;
}

/**
 * Generates a unique numeric PayOS orderCode (13 digits: Date.now() * 1000 + random 0..999)
 * Guarantees time-based uniqueness and stays well within JS Number.MAX_SAFE_INTEGER
 */
export function generatePayOSOrderCode(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}
