import type { DrizzleDB } from "@/database/database.module";
import {
  bookings,
  vouchers,
  type TBooking,
  type TNewBooking,
  type TVoucher,
  type TNewVoucher,
} from "@/database/schemas";
import { createUser } from "./user.factory";
import { createShow } from "./show.factory";

export async function createVoucher(
  db: DrizzleDB,
  overrides: Partial<TNewVoucher> = {},
): Promise<TVoucher> {
  const code = `VOUCHER-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

  const [voucher] = await db
    .insert(vouchers)
    .values({
      code,
      discountType: "percentage",
      discountValue: 10,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000 * 30),
      ...overrides,
    })
    .returning();

  if (!voucher) {
    throw new Error("Failed to create Voucher entity in test factory");
  }
  return voucher;
}

export async function createBooking(
  db: DrizzleDB,
  overrides: Partial<TNewBooking> = {},
): Promise<TBooking> {
  const userId = overrides.userId ?? (await createUser(db)).id;
  const showId = overrides.showId ?? (await createShow(db)).id;

  const [booking] = await db
    .insert(bookings)
    .values({
      userId,
      showId,
      originalPrice: 100000,
      discountPrice: 0,
      totalPrice: 100000,
      status: "pending_payment",
      expiresAt: new Date(Date.now() + 900000),
      ...overrides,
    })
    .returning();

  if (!booking) {
    throw new Error("Failed to create Booking entity in test factory");
  }
  return booking;
}
