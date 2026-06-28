# Auth System Research Report: NestJS & Drizzle ORM Setup

**Author:** Auth-flow DB Architect
**Date:** June 28, 2026
**Status:** Proposal / Design Reference
**Path:** `process/general-plans/references/auth-research.md`

---

## 1. Executive Summary

This report establishes the design context and database schema options for implementing a user registration, login, and social OAuth (Google and Facebook) authentication system in the **NestJS** application using **Drizzle ORM** (PostgreSQL) and **Bun**.

Based on an audit of the codebase:

- **No authentication-related packages** are currently installed in `package.json`.
- NestJS configuration is centrally managed via a global `@nestjs/config` `ConfigModule`.
- The database module (`DatabaseModule`) is configured in `src/database/database.module.ts` and imports an empty `src/database/schema.ts`.
- The database connection is injected globally via the `DATABASE_CONNECTION` token.

Per the architecture team's guidance, database schemas will be organized in a modular folder structure under `src/database/schemas/` consisting of dedicated schema files (e.g., `auth.schema.ts`, `user-address.schema.ts`), centralized relationships (`relations.ts`), and a barrel export file (`index.ts`).

---

## 2. Codebase Configuration Audit

### 2.1 NestJS Configuration Setup

The configuration uses `@nestjs/config` loaded globally in `src/app.module.ts`:

```typescript
ConfigModule.forRoot({
  isGlobal: true,
});
```

Environment variables are injected using the standard `ConfigService` class.

The database module (`src/database/database.module.ts`) loads the connection string (`DB_URL`) or individual variables (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`) and instantiates a `pg` `Pool`. Drizzle is initialized as follows:

```typescript
return drizzle({ client: pool, jit: true });
```

### 2.2 Auth Dependencies Status

Currently, `package.json` contains **zero dependencies** for authentication, hashing, sessions, or passport strategies. To support the target auth features, we must select and install:

1. **Hashing & Cryptography:** A secure hashing library like `bcrypt` or `argon2`.
2. **Strategy/Guard Middleware:** Passport-based middleware (`@nestjs/passport`, `passport`, `passport-local`, `passport-google-oauth20`, `passport-facebook`) or lightweight custom strategies.
3. **Session/Token Management:** JWT handling libraries (`@nestjs/jwt`, `jsonwebtoken`, or `jose`).

---

## 3. Database Schema Design Helpers (Proposed)

To enforce consistent schema creation across the application, we propose establishing a helper schema file at `src/database/helpers.schema.ts` containing a client-side time-sortable **UUIDv7 generator** and standard entity definitions (`baseEntity`, `fullEntity`), in compliance with the `schema-creation` standards.

```typescript
// src/database/helpers.schema.ts
import { timestamp, uuid } from "drizzle-orm/pg-core";
import { randomBytes } from "crypto";

/**
 * Generates a valid UUIDv7 on the client-side.
 * Time-ordered keys prevent index fragmentation in PostgreSQL.
 */
export function uuidv7(): string {
  const now = Date.now();
  const hexTime = now.toString(16).padStart(12, "0");
  const rand = randomBytes(10);

  const part1 = hexTime.slice(0, 8);
  const part2 = hexTime.slice(8, 12);
  const ver =
    "7" + (rand[0] & 0x0f).toString(16) + rand[1].toString(16).padStart(2, "0");
  const variantVal = ((rand[2] & 0x3f) | 0x80).toString(16).padStart(2, "0");
  const part4 = variantVal + rand[3].toString(16).padStart(2, "0");
  const part5 = randomBytes(6).toString("hex");

  return `${part1}-${part2}-${ver}-${part4}-${part5}`.toLowerCase();
}

/**
 * Base Entity:
 * Includes a UUIDv7 primary key and timezone-aware timestamps.
 */
export const baseEntity = {
  id: uuid()
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
};

/**
 * Full Entity:
 * Includes a UUIDv7 primary key, timezone-aware timestamps, and a soft-delete timestamp.
 */
export const fullEntity = {
  ...baseEntity,
  deletedAt: timestamp({ withTimezone: true }),
};
```

---

## 4. Proposed Database Folder Structure

The schema files will be structured inside the `src/database/schemas/` folder to cleanly isolate domains while remaining unified for Drizzle Kit:

```text
src/database/
  ├── helpers.schema.ts       # Shared baseEntity, fullEntity, and UUIDv7 generator
  ├── database.module.ts      # Database connection module (updates schema imports)
  └── schemas/
      ├── index.ts            # Barrel file exporting all tables and relationships
      ├── auth.schema.ts      # Users and Auth Providers (OAuth + Local credentials)
      ├── user-address.schema.ts # User billing/shipping addresses
      └── relations.ts        # Centralized relations config using defineRelations
```

### Drizzle Configuration Setup (`drizzle.config.ts`)

To align with this modular directory structure, `drizzle.config.ts` will point to the barrel file:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/database/schemas/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // ... credentials ...
});
```

---

## 5. Database Schema Options

We present three schema options for handling email/password + social login using Drizzle ORM's `snakeCase.table` PostgreSQL dialect, structured in modular files.

### Option 1: Unified Users Schema (Single-Table Approach)

In this approach, user credentials and OAuth provider IDs are stored inside a single `users` table under `src/database/schemas/auth.schema.ts`.

#### File: `src/database/schemas/auth.schema.ts`

```typescript
import { snakeCase, text, varchar } from "drizzle-orm/pg-core";
import { baseEntity } from "../helpers.schema";

export const users = snakeCase.table("user", {
  ...baseEntity,
  email: varchar({ length: 255 }).unique().notNull(),
  name: varchar({ length: 255 }).notNull(),
  avatarUrl: text(),

  // Local Credential Field (Nullable for OAuth-only users)
  passwordHash: text(),

  // Social OAuth Fields (Nullable)
  googleId: varchar({ length: 255 }).unique(),
  facebookId: varchar({ length: 255 }).unique(),
});

export type TUser = typeof users.$inferSelect;
export type TNewUser = typeof users.$inferInsert;
```

#### File: `src/database/schemas/user-address.schema.ts`

```typescript
import { snakeCase, varchar, uuid } from "drizzle-orm/pg-core";
import { baseEntity } from "../helpers.schema";
import { users } from "./auth.schema";

export const userAddresses = snakeCase.table("user_address", {
  ...baseEntity,
  userId: uuid()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  addressLine1: varchar({ length: 255 }).notNull(),
  addressLine2: varchar({ length: 255 }),
  city: varchar({ length: 100 }).notNull(),
  state: varchar({ length: 100 }).notNull(),
  postalCode: varchar({ length: 20 }).notNull(),
  country: varchar({ length: 100 }).notNull(),
});

export type TUserAddress = typeof userAddresses.$inferSelect;
```

#### File: `src/database/schemas/relations.ts`

```typescript
import { defineRelations } from "drizzle-orm";
import { users } from "./auth.schema";
import { userAddresses } from "./user-address.schema";

export const schemaRelations = defineRelations(
  {
    users,
    userAddresses,
  },
  (r) => ({
    users: {
      addresses: r.many.userAddresses({
        from: r.users.id,
        to: r.userAddresses.userId,
      }),
    },
    userAddresses: {
      user: r.one.users({
        from: r.userAddresses.userId,
        to: r.users.id,
        optional: false,
      }),
    },
  }),
);
```

#### Trade-offs

- **Pros:**
  - **Simplicity:** Profile details, credentials, and OAuth IDs are retrieved in a single flat database read without joins.
- **Cons:**
  - **Extensibility:** Adding other OAuth providers (e.g., Apple, GitHub) requires a database migration to add columns.
  - **Risk:** The presence of `passwordHash` in the main `users` table increases the surface area for exposing secrets to HTTP responses if queries use wildcard selects.
  - **No Multi-Link:** Users cannot bind multiple social accounts of the same provider.

---

### Option 2: Separated Auth Providers (One-to-Many Linked Accounts) — _RECOMMENDED_

This design isolates the user profile (`users`) from authentication methods (`auth_providers`). A user can have one or more login methods associated with their profile.

#### File: `src/database/schemas/auth.schema.ts`

```typescript
import { snakeCase, text, unique, varchar, uuid } from "drizzle-orm/pg-core";
import { baseEntity } from "../helpers.schema";

// 1. User Profiles
export const users = snakeCase.table("user", {
  ...baseEntity,
  email: varchar({ length: 255 }).unique().notNull(),
  name: varchar({ length: 255 }).notNull(),
  avatarUrl: text(),
});

// 2. Authentication Providers (Local Credentials and Social OAuth Links)
export const authProviders = snakeCase.table(
  "auth_provider",
  {
    ...baseEntity,
    userId: uuid()
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    provider: varchar({ length: 50 }).notNull(), // 'local', 'google', 'facebook'
    providerAccountId: varchar({ length: 255 }).notNull(), // Provider's unique user ID (or email for 'local')
    passwordHash: text(), // Only populated if provider is 'local'
  },
  (table) => [
    // Unique index ensures a user cannot link the same provider account twice,
    // and facilitates extremely fast credential verification queries.
    unique("provider_account_idx").on(table.provider, table.providerAccountId),
  ],
);

export type TUser = typeof users.$inferSelect;
export type TAuthProvider = typeof authProviders.$inferSelect;
```

#### File: `src/database/schemas/user-address.schema.ts`

```typescript
import { snakeCase, varchar, uuid } from "drizzle-orm/pg-core";
import { baseEntity } from "../helpers.schema";
import { users } from "./auth.schema";

export const userAddresses = snakeCase.table("user_address", {
  ...baseEntity,
  userId: uuid()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  addressLine1: varchar({ length: 255 }).notNull(),
  addressLine2: varchar({ length: 255 }),
  city: varchar({ length: 100 }).notNull(),
  state: varchar({ length: 100 }).notNull(),
  postalCode: varchar({ length: 20 }).notNull(),
  country: varchar({ length: 100 }).notNull(),
});

export type TUserAddress = typeof userAddresses.$inferSelect;
```

#### File: `src/database/schemas/relations.ts`

```typescript
import { defineRelations } from "drizzle-orm";
import { users, authProviders } from "./auth.schema";
import { userAddresses } from "./user-address.schema";

export const schemaRelations = defineRelations(
  {
    users,
    authProviders,
    userAddresses,
  },
  (r) => ({
    users: {
      authProviders: r.many.authProviders({
        from: r.users.id,
        to: r.authProviders.userId,
      }),
      addresses: r.many.userAddresses({
        from: r.users.id,
        to: r.userAddresses.userId,
      }),
    },
    authProviders: {
      user: r.one.users({
        from: r.authProviders.userId,
        to: r.users.id,
        optional: false, // Mandatory relation
      }),
    },
    userAddresses: {
      user: r.one.users({
        from: r.userAddresses.userId,
        to: r.users.id,
        optional: false, // Mandatory relation
      }),
    },
  }),
);
```

#### Trade-offs

- **Pros:**
  - **Extensibility:** Support for new social login providers is instant. No database migrations are required; we simply insert a record with `provider: 'apple'`.
  - **Multiple Identities:** Users can seamlessly log in with Google OR Facebook OR Email/Password and link/unlink these providers in their settings.
  - **Credential Safety:** The `passwordHash` is separated from the `users` table, minimizing the risk of accidentally exposing credentials when fetching user profiles.
- **Cons:**
  - Slower initial login check: Requires a join or a subquery to look up the credentials for a user (although easily mitigated using indexed lookups).

---

### Option 3: NextAuth/Auth.js-Compatible Multi-Table Schema

This option represents a standard industry-wide schema compatible with Auth.js / NextAuth. It consists of `users`, `accounts`, `sessions` (if using database-backed sessions instead of JWTs), and `verification_tokens` (for magic links).

#### File: `src/database/schemas/auth.schema.ts`

```typescript
import {
  integer,
  snakeCase,
  text,
  timestamp,
  unique,
  varchar,
  uuid,
} from "drizzle-orm/pg-core";
import { baseEntity } from "../helpers.schema";

export const users = snakeCase.table("user", {
  ...baseEntity,
  name: varchar({ length: 255 }),
  email: varchar({ length: 255 }).unique().notNull(),
  emailVerified: timestamp({ withTimezone: true }),
  image: text(),
  passwordHash: text(), // For local credentials alongside OAuth
});

export const accounts = snakeCase.table(
  "account",
  {
    ...baseEntity,
    userId: uuid()
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar({ length: 50 }).notNull(), // 'oauth', 'email', 'credentials'
    provider: varchar({ length: 50 }).notNull(), // e.g. 'google'
    providerAccountId: varchar({ length: 255 }).notNull(),
    refreshToken: text(),
    accessToken: text(),
    expiresAt: integer(),
    tokenType: varchar({ length: 50 }),
    scope: varchar({ length: 255 }),
    idToken: text(),
    sessionState: varchar({ length: 255 }),
  },
  (table) => [
    unique("account_provider_idx").on(table.provider, table.providerAccountId),
  ],
);

export const sessions = snakeCase.table("session", {
  ...baseEntity,
  sessionToken: varchar({ length: 255 }).unique().notNull(),
  userId: uuid()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  expires: timestamp({ withTimezone: true }).notNull(),
});
```

#### File: `src/database/schemas/user-address.schema.ts`

```typescript
import { snakeCase, varchar, uuid } from "drizzle-orm/pg-core";
import { baseEntity } from "../helpers.schema";
import { users } from "./auth.schema";

export const userAddresses = snakeCase.table("user_address", {
  ...baseEntity,
  userId: uuid()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  addressLine1: varchar({ length: 255 }).notNull(),
  addressLine2: varchar({ length: 255 }),
  city: varchar({ length: 100 }).notNull(),
  state: varchar({ length: 100 }).notNull(),
  postalCode: varchar({ length: 20 }).notNull(),
  country: varchar({ length: 100 }).notNull(),
});

export type TUserAddress = typeof userAddresses.$inferSelect;
```

#### File: `src/database/schemas/relations.ts`

```typescript
import { defineRelations } from "drizzle-orm";
import { users, accounts, sessions } from "./auth.schema";
import { userAddresses } from "./user-address.schema";

export const schemaRelations = defineRelations(
  {
    users,
    accounts,
    sessions,
    userAddresses,
  },
  (r) => ({
    users: {
      accounts: r.many.accounts({
        from: r.users.id,
        to: r.accounts.userId,
      }),
      sessions: r.many.sessions({
        from: r.users.id,
        to: r.sessions.userId,
      }),
      addresses: r.many.userAddresses({
        from: r.users.id,
        to: r.userAddresses.userId,
      }),
    },
    accounts: {
      user: r.one.users({
        from: r.accounts.userId,
        to: r.users.id,
        optional: false,
      }),
    },
    sessions: {
      user: r.one.users({
        from: r.sessions.userId,
        to: r.users.id,
        optional: false,
      }),
    },
    userAddresses: {
      user: r.one.users({
        from: r.userAddresses.userId,
        to: r.users.id,
        optional: false,
      }),
    },
  }),
);
```

#### Trade-offs

- **Pros:**
  - **Standardized Ecosystem:** Out-of-the-box compatibility with NextAuth.js or Auth.js if a frontend framework (e.g., Next.js) is linked.
  - **Feature Complete:** Out-of-the-box support for managing OAuth refresh tokens, access tokens, database sessions, and passwordless OTP verification flows.
- **Cons:**
  - **High Overhead:** High number of tables and columns to maintain, particularly if using stateless JWT tokens where `sessions` and `accounts` token storage are unnecessary.

---

## 6. Schema Barrel Export (`index.ts`)

To bundle the schemas for imports in Drizzle config and the NestJS database provider, the barrel file will export all schema contents:

#### File: `src/database/schemas/index.ts`

```typescript
export * from "./auth.schema";
export * from "./user-address.schema";
export * from "./relations";
```

### Database Module Schema Import Update

In `src/database/database.module.ts`, change the schema import line from `import * as schema from "./schema";` to:

```typescript
import * as schema from "./schemas";
```

---

## 7. DTO Isolation & Query Guidelines

To comply with the project's critical Drizzle rules:

### 7.1 DTO Boundary Isolation (`dto-omit-for-objects`)

When writing services, user entity records should be mapped to strict Data Transfer Objects (DTOs) before crossing the boundary into controllers or HTTP responses.

```typescript
// src/users/dto/user-profile.dto.ts
import { TUser } from "../../database/schemas/auth.schema";

// Ensure passwordHash (Option 1) or system audit timestamps are omitted from API responses
export type UserProfileDTO = Omit<TUser, "createdAt" | "updatedAt">;
```

### 7.2 Avoid Wildcard Returns (`select-yagni-returning`)

When querying the database, select only the columns required to fulfill the business request:

```typescript
// Example: Lookup user profile
const [userProfile] = await db
  .select({
    id: users.id,
    email: users.email,
    name: users.name,
    avatarUrl: users.avatarUrl,
  })
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);
```

---

## 8. Recommendation & Implementation Blueprint

### 8.1 Recommended Schema

**Option 2 (Separated Auth Providers)** is highly recommended. It balances the extensibility of adding any arbitrary social login providers with database cleanliness and security isolation. It cleanly decouples user attributes from credentials.

### 8.2 Recommended Packages to Install

To implement this auth system, run:

```bash
bun add @nestjs/jwt @nestjs/passport passport passport-local passport-google-oauth20 passport-facebook bcrypt
bun add -d @types/passport-local @types/passport-google-oauth20 @types/passport-facebook @types/bcrypt
```

_(Optionally, substitute `bcrypt` for `argon2` if preferred)._

### 8.3 Implementation Step-by-Step Roadmap

1. **Schema Initialization:** Set up `src/database/helpers.schema.ts` and write the selected schema folder structure inside `src/database/schemas/`.
2. **Migration Generation:** Run `bun run db:generate` to generate Drizzle SQL migrations, then run `bun run db:push` to apply the migrations to PostgreSQL.
3. **Guard & Strategy Scaffolding:**
   - Set up an `AuthModule` containing an `AuthService`, `AuthController`, and strategies (e.g. `LocalStrategy`, `GoogleStrategy`, `FacebookStrategy`).
   - Configure a JWT strategy to decode auth tokens on protected routes.
4. **Environment Variables Configuration:**
   - Add OAuth client IDs and secrets to `.env` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `JWT_SECRET`).
   - Register these config keys safely using the NestJS `ConfigService`.
5. **Testing Verification:** Author unit and E2E test suites in `test/` to check local credential signups, password verification, duplicate constraint handling, and JWT generation.
