# Design Document: Auth System Schema for Movie Ticket Booking

**Date:** 2026-06-28
**Author:** Antigravity (AI Architect)
**Status:** Approved

## 1. Overview

This document specifies the database schema design for a user authentication and registration system (Email/Password + Google/Facebook Social Login) tailored for a Movie Ticket Booking platform using **NestJS**, **Drizzle ORM** (PostgreSQL), and **Bun**.

## 2. Directory Structure

All schema files are organized under the `src/database/schemas/` folder to modularize domain logic:

```text
src/database/
  └── schemas/
      ├── helpers.schema.ts   # Client-side UUIDv7 generator & baseEntity
      ├── auth.schema.ts      # Unified User Table (Local & Social Credentials)
      ├── relations.ts        # Centralized relations config
      └── index.ts            # Barrel file exporting all tables and relationships
```

## 3. Database Schema Implementation

### 3.1 `src/database/schemas/helpers.schema.ts`

```typescript
import { timestamp, uuid } from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

export const baseEntity = {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
};
```

### 3.2 `src/database/schemas/auth.schema.ts`

```typescript
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { baseEntity } from "./helpers.schema";

export const users = pgTable("users", {
  ...baseEntity,
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }),
  avatarUrl: text("avatar_url"),

  // Local Authentication (Nullable for OAuth users)
  passwordHash: text("password_hash"),

  // Token Refresh management (support revocation/rotation in single-table schema)
  refreshTokenHash: text("refresh_token_hash"),


  // OAuth Providers (Nullable, unique constraints to avoid multi-linking anomalies)
  googleId: varchar("google_id", { length: 255 }).unique(),
  facebookId: varchar("facebook_id", { length: 255 }).unique(),

  // Authorization & Account Lifecycle
  role: varchar("role", { length: 50 }).default("user").notNull(),
  status: varchar("status", { length: 50 }).default("active").notNull(),
});

export type TUser = typeof users.$inferSelect;
export type TNewUser = typeof users.$inferInsert;
```

### 3.3 `src/database/schemas/relations.ts`

```typescript
import { relations } from "drizzle-orm";
import { users } from "./auth.schema";

export const usersRelations = relations(users, ({ many }) => ({
  // Define future relations here (e.g. bookings, tickets)
}));
```

### 3.4 `src/database/schemas/index.ts`

```typescript
export * from "./helpers.schema";
export * from "./auth.schema";
export * from "./relations";
```

## 4. User Authentication Flow Logic

- **Signup (Traditional):** Accepts `email`, `name`, `password`, `phoneNumber`. Inserts into `users` with `passwordHash` and sets default status as `active`.
- **Login (Traditional):** Queries user by `email`. Compares hash. Returns Stateless JWT.
- **Social OAuth:** Receives identity token from Google/Facebook. Checks matching `googleId` or `facebookId`. If email exists but identity key does not, links social login by updating key. Otherwise, registers a new account with null `passwordHash`.
