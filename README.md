<div align="center">

# Ticket Booking System

## High-Performance & Concurrency-Safe Ticket Reservation Backend

A modern, high-performance ticket booking and reservation backend built with **NestJS**, **Drizzle ORM**, and **PostgreSQL**, utilizing **BullMQ (Redis)** for concurrency-safe ticket reservations and background job queueing.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-FF6B00?logo=drizzle&logoColor=white)](https://orm.drizzle.team)
[![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com)

## </div>

## Key Features

- **Concurrency-Safe Reservations**: Pessimistic row locking (`SELECT ... FOR UPDATE`) implemented at the database transaction level to prevent double-booking of seats under high concurrent load.
- **Background Job Processing**: Asynchronous tasks and event processing powered by **BullMQ** and **Redis**.
- **Type-Safe Database Schema**: Modern data access layer using **Drizzle ORM** with automatic SQL migration generation via **Drizzle Kit**.
- **Secure Docker Environment**: Multi-stage production-ready Docker configuration running as a non-root `bun` user (UID/GID 1001) with Alpine-compatible healthcheck.
- **Pre-commit Formatting Hook**: Standardized code formatting and linting on staged files using **Husky** and **lint-staged** running Prettier and ESLint.
- **Clean Architecture & Configuration**: Global config management using NestJS `ConfigService` with full support for single database connection URLs (`DATABASE_URL`) or individual variables.

---

## Tech Stack

The application leverages the following modern technologies:

- **Framework**: NestJS (v11) - Node.js framework for building scalable enterprise-grade applications.
- **Runtime**: Bun (v1.3.14) - Ultra-fast JavaScript and TypeScript runtime.
- **Database ORM**: Drizzle ORM (v1.0.0-rc line) with Drizzle Kit for database access and migration management.
- **Database Driver**: pg (node-postgres) for connecting to PostgreSQL.
- **Background Jobs**: BullMQ (v5.79.1) & ioredis for distributed queues.
- **Linting & Formatting**: ESLint (v10) + Prettier (v3) with unified rules to prevent project warnings.
- **Git Hooks**: Husky & lint-staged for pre-commit quality gates.

---

## Concurrency Control & Database Locking

For a ticket booking application, preventing double-booking under high load is the most critical requirement. The system implements **Pessimistic Row Locking** at the database transaction level.

When a client attempts to book a seat, the transaction locks the specific seat row immediately using `FOR UPDATE`. This blocks any concurrent transactions attempting to read or modify the same seat until the first transaction either commits or rolls back.

```typescript
// Sample booking service logic implementing pessimistic locking
await this.db.transaction(async (tx) => {
  // Lock the seat row using FOR UPDATE
  const [seat] = await tx
    .select()
    .from(seats)
    .where(eq(seats.id, seatId))
    .for("update")
    .limit(1);

  if (!seat) throw new NotFoundException("Seat not found");
  if (seat.isBooked) throw new ConflictException("Seat is already booked");

  // Perform updates and create booking ticket
  await tx.update(seats).set({ isBooked: true }).where(eq(seats.id, seatId));
  await tx.insert(tickets).values({ userId, seatId });
});
```

---

## Getting Started

### Prerequisites

- **Bun**: v1.3.14 or later
- **Docker & Docker Compose**: For running PostgreSQL and Redis containers locally

### Local Development Setup

1. **Clone the repository and install dependencies**:

   ```bash
   bun install
   ```

2. **Spin up local PostgreSQL and Redis services**:

   ```bash
   docker compose up -d
   ```

3. **Database Migrations**:
   Run Drizzle Kit to generate and push schemas to your local database:

   ```bash
   # Generate database migrations based on Drizzle schema
   bun run db:generate

   # Push changes and execute migrations against the database
   bun run db:push
   ```

4. **Start the development server**:

   ```bash
   bun run dev
   ```

5. **Build for production**:

   ```bash
   bun run build
   ```

---

## Available Scripts

The following scripts are defined in the workspace root `package.json`:

- `bun run dev`: Launches the NestJS development server in watch mode (`nest start --watch`).
- `bun run build`: Compiles the NestJS application into production-ready JavaScript in the `dist/` directory.
- `bun run lint`: Runs ESLint with autofix enabled to scan for static code quality and formatting issues.
- `bun run check-types`: Runs TypeScript validation checks (`tsc --noEmit`) to verify there are no compilation or type errors.
- `bun run format`: Runs Prettier to enforce consistent code styling (enforcing double quotes across files).
- `bun test`: Executes the test suites in `src/` using the native Bun Test runner.
- `bun run start:prod`: Starts the compiled application in production mode.
- `bun run db:generate`: Generates database migrations based on schema.
- `bun run db:push`: Applies database schema changes and migrations.
- `bun run db:studio`: Opens Drizzle Studio GUI for database exploration.

> **Note on Upgrading Drizzle Prereleases:** Because the project uses the `1.0.0-rc` line, standard package updates may ignore newer release candidate hashes. To upgrade to the latest RC build manually, run `bun add drizzle-orm@rc4` and `bun add -d drizzle-kit@rc4`.
