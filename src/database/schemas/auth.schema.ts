import {
  index,
  snakeCase,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { baseEntity } from "./helpers.schema";

export const users = snakeCase.table(
  "users",
  {
    ...baseEntity,
    email: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    phoneNumber: varchar({ length: 20 }),
    avatarUrl: text(),

    // Local Authentication (Nullable for OAuth users)
    passwordHash: text(),

    // Token Refresh management (support revocation/rotation in single-table schema)
    refreshTokenHash: text(),

    // OAuth Providers (Nullable, unique constraints to avoid multi-linking anomalies)
    googleId: varchar({ length: 255 }),
    facebookId: varchar({ length: 255 }),

    // Authorization & Account Lifecycle
    role: varchar({ length: 50 }).default("user").notNull(),
    status: varchar({ length: 50 }).default("active").notNull(),
  },
  (table) => [
    // Explicit indexes to optimize authentication lookups under load
    uniqueIndex("users_email_uidx").on(table.email),
    uniqueIndex("users_google_id_uidx").on(table.googleId),
    uniqueIndex("users_facebook_id_uidx").on(table.facebookId),

    // Non-unique index to optimize booking/ticket lookups using phoneNumber
    index("users_phone_number_idx").on(table.phoneNumber),
  ],
);

export type TUser = typeof users.$inferSelect;
export type TNewUser = typeof users.$inferInsert;
