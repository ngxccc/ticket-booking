import type { DrizzleDB } from "@/database/database.module";
import { createUser } from "../factories/user.factory";
import type { TUser } from "@/database/schemas";

export const UserMother = {
  /** Người dùng thông thường (role: user, status: active) */
  customer(
    db: DrizzleDB,
    email = `customer-${crypto.randomUUID().slice(0, 6)}@ticketbooking.com`,
  ): Promise<TUser> {
    return createUser(db, {
      email,
      fullName: "Regular Customer",
      role: "user",
      status: "active",
    });
  },

  /** Quản trị viên hệ thống (role: admin, status: active) */
  admin(
    db: DrizzleDB,
    email = `admin-${crypto.randomUUID().slice(0, 6)}@ticketbooking.com`,
  ): Promise<TUser> {
    return createUser(db, {
      email,
      fullName: "System Admin",
      role: "admin",
      status: "active",
    });
  },

  /** Người dùng chưa kích hoạt (status: pending_verification) */
  unverified(db: DrizzleDB): Promise<TUser> {
    return createUser(db, {
      role: "user",
      status: "pending_verification",
      verificationToken: crypto.randomUUID(),
      verificationExpiresAt: new Date(Date.now() + 86400000),
    });
  },
} as const;
