# Drizzle ORM Database Schema Implementation - Plan

Date: 04-07-26
Complexity: Simple
Status: ✅ COMPLETED

## Overview

Implement the production-ready Drizzle ORM database schema in `src/database/schemas/` based on the finalized DBML specification at `second-brain/Docs/Database_Schema.dbml`. The implementation converts all 14 domain tables, 9 PostgreSQL ENUM types, and explicit multi-table relationships into modular TypeScript schemas adhering strictly to workspace Drizzle ORM standards (`snakeCase.table`, `baseEntity` mixins, UUIDv7 primary keys, and centralized `defineRelations`).

This plan aligns with the project architecture guidelines in `process/context/all-context.md` and testing guidelines in `process/context/tests/all-tests.md`.

## Quick Links

- [Drizzle ORM Database Schema Implementation - Plan](#drizzle-orm-database-schema-implementation---plan)
  - [Overview](#overview)
  - [Quick Links](#quick-links)
  - [Design Specification](#design-specification)
    - [1. Schema File Grouping](#1-schema-file-grouping)
    - [2. Centralized Relations Configuration (`relations.ts`)](#2-centralized-relations-configuration-relationsts)
    - [3. Schema Exports (`index.ts`)](#3-schema-exports-indexts)
  - [Touchpoints](#touchpoints)
  - [Public Contracts](#public-contracts)
  - [Blast Radius](#blast-radius)
  - [Phase Completion Rules](#phase-completion-rules)
  - [Acceptance Criteria](#acceptance-criteria)
  - [Implementation Checklist](#implementation-checklist)
  - [Verification Evidence](#verification-evidence)

---

## Design Specification

### 1. Schema File Grouping

The 14 database tables and 9 domain ENUMs are grouped into 7 modular schema files under `src/database/schemas/`:

- **`enums.schema.ts`** (CODE DONE): Centralized PostgreSQL ENUM types using `pgEnum`:
  - `userRoleEnum`: `user_role` (`user`, `admin`, `staff`)
  - `userStatusEnum`: `user_status` (`active`, `inactive`, `suspended`)
  - `movieRatingEnum`: `movie_rating` (`G`, `PG`, `PG_13`, `R`, `NC_17`)
  - `showSeatStatusEnum`: `show_seat_status` (`available`, `reserved`, `booked`)
  - `bookingStatusEnum`: `booking_status` (`pending_payment`, `confirmed`, `cancelled`, `expired`)
  - `discountTypeEnum`: `discount_type` (`percentage`, `flat`)
  - `paymentStatusEnum`: `payment_status` (`pending`, `completed`, `failed`, `refunded`)
  - `paymentMethodEnum`: `payment_method` (`MOMO`, `VNPAY`, `Credit_Card`, `ShopeePay`)
  - `outboxEventStatusEnum`: `outbox_event_status` (`pending`, `processed`, `failed`)

- **`auth.schema.ts`** (CODE DONE): User authentication & session management
  - `users`: Core user accounts (Local & OAuth credentials, role, status)
  - `refreshTokens`: Multi-device refresh tokens and revocation tracking (`userId` FK -> `users.id` with `onDelete: "cascade"`)

- **`movies.schema.ts`** (CODE DONE): Movie catalog & localization
  - `movies`: Movie technical metadata, duration, release date, rating ENUM
  - `genres`: Genre lookup table
  - `movieGenres`: Many-to-many junction table (`movieId` FK, `genreId` FK)
  - `movieTranslations`: Localized titles and descriptions (`movieId` FK, `languageCode`)

- **`cinemas.schema.ts`** (CODE DONE): Cinema venues, screening halls, and physical seats
  - `cinemas`: Physical cinema locations
  - `halls`: Screening halls (`cinemaId` FK -> `cinemas.id` with `onDelete: "cascade"`)
  - `seatTypes`: Seat tier definitions (Standard, VIP, Couple) with `priceMultiplier`
  - `seats`: Installed seats (`hallId` FK -> `halls.id`, `seatTypeId` FK -> `seatTypes.id`)

- **`shows.schema.ts`** (CODE DONE): Showtime schedules and concurrent seat status
  - `shows`: Screening instances (`movieId` FK, `hallId` FK, `startTime`, `endTime`, `basePrice`)
  - `showSeats`: Seat status per show for high-concurrency booking (`showId` FK, `seatId` FK, `status` ENUM, `lockedUntil`)

- **`bookings.schema.ts`** (PLANNED): Orders, vouchers, tickets, and concessions
  - `vouchers`: Promotional coupons (`discountType` ENUM, `discountValue`)
  - `bookings`: Customer orders (`userId` FK, `showId` FK, `voucherId` FK, `totalPrice`, `status` ENUM, `expiresAt`)
  - `tickets`: Issued seat tickets (`bookingId` FK, `showSeatId` FK, `ticketCode`)
  - `combos`: Snacks & drinks concessions catalog
  - `bookingCombos`: Ordered concessions junction table (`bookingId` FK, `comboId` FK, `quantity`)

- **`payments.schema.ts`** (PLANNED): Payment transactions and Transactional Outbox
  - `payments`: Payment records (`bookingId` FK, `paymentMethod` ENUM, `transactionId`, `amount`, `status` ENUM)
  - `outboxEvents`: Transactional outbox pattern table (`eventType`, `payload`, `status` ENUM, `processedAt`)

---

### 2. Centralized Relations Configuration (`relations.ts`)

All entity relationships are centrally declared in `relations.ts` using `defineRelations` per rule `relations-configuration`:

```typescript
export const schemaRelations = defineRelations(
  {
    users,
    refreshTokens,
    movies,
    genres,
    movieGenres,
    movieTranslations,
    cinemas,
    halls,
    seatTypes,
    seats,
    shows,
    showSeats,
    vouchers,
    bookings,
    tickets,
    combos,
    bookingCombos,
    payments,
  },
  (r) => ({
    users: {
      refreshTokens: r.many.refreshTokens({
        from: r.users.id,
        to: r.refreshTokens.userId,
      }),
      bookings: r.many.bookings({
        from: r.users.id,
        to: r.bookings.userId,
      }),
    },
    refreshTokens: {
      user: r.one.users({
        from: r.refreshTokens.userId,
        to: r.users.id,
        optional: false,
      }),
    },
    // Additional relations for movies, cinemas, halls, seats, shows, showSeats, bookings, tickets, combos, payments...
  }),
);
```

---

### 3. Schema Exports (`index.ts`)

`index.ts` re-exports all 7 schema modules and infer types (`TUser`, `TNewUser`, `TBooking`, `TNewBooking`, etc.) to provide clean imports for services and modules across the NestJS application.

---

## Touchpoints

- `src/database/schemas/enums.schema.ts` (Done)
- `src/database/schemas/auth.schema.ts` (Done)
- `src/database/schemas/movies.schema.ts` (Done)
- `src/database/schemas/cinemas.schema.ts` (Done)
- `src/database/schemas/shows.schema.ts` (Done)
- `src/database/schemas/bookings.schema.ts` (Planned)
- `src/database/schemas/payments.schema.ts` (Planned)
- `src/database/schemas/relations.ts` (Planned)
- `src/database/schemas/index.ts` (Planned)

---

## Public Contracts

- Re-exported Drizzle Table definitions: `users`, `refreshTokens`, `movies`, `genres`, `movieGenres`, `movieTranslations`, `cinemas`, `halls`, `seatTypes`, `seats`, `shows`, `showSeats`, `vouchers`, `bookings`, `tickets`, `combos`, `bookingCombos`, `payments`, `outboxEvents`.
- Re-exported Drizzle ENUM definitions: `userRoleEnum`, `userStatusEnum`, `movieRatingEnum`, `showSeatStatusEnum`, `bookingStatusEnum`, `discountTypeEnum`, `paymentStatusEnum`, `paymentMethodEnum`, `outboxEventStatusEnum`.
- Re-exported Drizzle Relational Mapping: `schemaRelations`.

---

## Blast Radius

- High: Modifies core database schema definitions in `src/database/schemas/`.
- No runtime side effects until migrations are run against a live PostgreSQL database.

---

## Phase Completion Rules

1. Each schema file must be written using `snakeCase.table` and `baseEntity` mixins.
2. All relations must be centrally defined in `relations.ts` using `defineRelations`.
3. All schema exports must pass TypeScript type-checking (`tsc --noEmit` or `bun run build`).

---

## Acceptance Criteria

1. All 14 physical domain tables and 9 ENUMs from `Database_Schema.dbml` are represented in TypeScript schemas.
2. `relations.ts` defines all foreign key mappings using `defineRelations`.
3. `index.ts` re-exports all schema modules and inferred TypeScript types (`TUser`, `TNewUser`, etc.).
4. The codebase builds cleanly without TypeScript or Drizzle type errors.

---

## Implementation Checklist

1. [x] Create `enums.schema.ts` with all 9 PostgreSQL pgEnum definitions
2. [x] Update `auth.schema.ts` with users & refreshTokens tables
3. [x] Create `movies.schema.ts` with movies, genres, movieGenres, movieTranslations
4. [x] Create `cinemas.schema.ts` with cinemas, halls, seatTypes, seats
5. [x] Create `shows.schema.ts` with shows, showSeats
6. [x] Create `bookings.schema.ts` with vouchers, bookings, tickets, combos, bookingCombos
7. [x] Create `payments.schema.ts` with payments, outboxEvents
8. [x] Update `relations.ts` with centralized relations via `defineRelations`
9. [x] Update `index.ts` to re-export all schemas and types
10. [x] Run TypeScript Verification (`bun run build`)

---

## Verification Evidence

- Post-Phase Testing: TypeScript typecheck passes without errors per guidelines in `process/context/tests/all-tests.md`.
- Schema imports resolve cleanly in NestJS module files.

---

All 14 schemas, 9 ENUMs, relations, and type exports are implemented and pass `bun run build` with 0 errors.
