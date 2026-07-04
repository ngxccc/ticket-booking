import {
  boolean,
  index,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { userRoleEnum, userStatusEnum } from "./enums.schema";
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

    // OAuth Providers (Nullable, unique constraints)
    googleId: varchar({ length: 255 }),
    facebookId: varchar({ length: 255 }),

    // Authorization & Account Lifecycle
    role: userRoleEnum().default("user").notNull(),
    status: userStatusEnum().default("active").notNull(),
  },
  (table) => [
    uniqueIndex("users_email_uidx").on(table.email),
    uniqueIndex("users_google_id_uidx").on(table.googleId),
    uniqueIndex("users_facebook_id_uidx").on(table.facebookId),
    index("users_phone_number_idx").on(table.phoneNumber),
  ],
);

export const refreshTokens = snakeCase.table(
  "refresh_tokens",
  {
    ...baseEntity,
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar({ length: 255 }).notNull(),
    deviceName: varchar({ length: 255 }),
    ipAddress: varchar({ length: 45 }),
    expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    isRevoked: boolean().default(false).notNull(),
  },
  (table) => [
    uniqueIndex("refresh_tokens_token_hash_uidx").on(table.tokenHash),
    index("refresh_tokens_user_id_idx").on(table.userId),
  ],
);

export type TUser = typeof users.$inferSelect;
export type TNewUser = typeof users.$inferInsert;
export type TRefreshToken = typeof refreshTokens.$inferSelect;
export type TNewRefreshToken = typeof refreshTokens.$inferInsert;
