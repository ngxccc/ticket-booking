<div align="center">

# Ticket Booking System

## High-Performance & Concurrency-Safe Cinema Ticket Reservation Backend

A modern, enterprise-grade ticket booking and reservation backend built with **NestJS**, **Drizzle ORM**, and **PostgreSQL**, leveraging **Redlock distributed locking**, **BullMQ (Redis)** queues, and a **Transactional Outbox** pattern for concurrency-safe ticket reservations and event-driven workflows.

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![NestJS](https://img.shields.io/badge/NestJS-11.1-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Bun](https://img.shields.io/badge/Bun-1.1%2B-000000?logo=bun&logoColor=white)](https://bun.sh)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18.0-316192?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-1.0.0--rc.4-FF6B00?logo=drizzle&logoColor=white)](https://orm.drizzle.team)
[![Redis](https://img.shields.io/badge/Redis-8.0-DC382D?logo=redis&logoColor=white)](https://redis.io)
[![BullMQ](https://img.shields.io/badge/BullMQ-6.0-FF4500?logo=redis&logoColor=white)](https://bullmq.io)
[![PayOS](https://img.shields.io/badge/PayOS-2.0-0052CC)](https://payos.vn)
[![Scalar API Docs](https://img.shields.io/badge/Scalar_UI-OpenAPI_3.1-00B4D8)](https://scalar.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [System Architecture & Project Structure](#system-architecture--project-structure)
- [API Documentation & Overview](#api-documentation--overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development Setup](#local-development-setup)
- [Environment Configuration](#environment-configuration)
- [Available Scripts](#available-scripts)
- [Background Processing & Cron Jobs](#background-processing--cron-jobs)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Deployment & Infrastructure](#deployment--infrastructure)
- [Architecture Decision Records & Design Docs](#architecture-decision-records--design-docs)
- [License & Author](#license--author)

---

## Key Features

- **Concurrency-Safe Seat Locking**: Prevents double-booking under high concurrent requests using Redis Redlock distributed locking combined with PostgreSQL pessimistic row locking (`SELECT ... FOR UPDATE`).
- **10-Minute Seat Reservation Lifecycle**: Reserved seats are automatically locked for 10 minutes. Lock expirations are driven by BullMQ delayed jobs with a 5-minute cron worker as a backup layer.
- **Transactional Outbox Pattern**: Implements an asynchronous outbox event relay (`outbox_events` table + `OutboxService` worker polling every 5s) to guarantee email dispatch and event processing without blocking primary database transactions.
- **Payment Confirmation & PayOS Integration**: Integrates PayOS payment gateway for payment confirmation (`POST /bookings/confirm` & `POST /payments/payos-webhook`). Webhooks use HMAC-SHA256 signature validation via `timingSafeEqual` and a 5-minute anti-replay timestamp window.
- **Idempotency Protection**: Enforces an `Idempotency-Key` header stored in Redis (60s TTL) on reservation and confirmation endpoints to prevent duplicate payments or bookings.
- **Complete Authentication Lifecycle**: Supports registration, email verification via token, resending verification emails, JWT login, access/refresh token rotation, device-tracked refresh tokens, global logout (`logout-all`), password reset, and password change.
- **RFC 9457 Problem Details & i18n**: Returns standardized RFC 9457 error responses with localized error messages in Vietnamese (`vi`) and English (`en`) via `nestjs-i18n`.
- **Interactive API Documentation**: Offers OpenAPI 3.1.0 specifications rendered dynamically using the **Scalar API Reference UI** at `/reference` and raw JSON at `/api-json`.
- **Redis-Backed Rate Limiting**: Distributed rate limiting powered by `@nest-lab/throttler-storage-redis` and NestJS `ThrottlerModule`.
- **Type-Safe Environment & DTOs**: Zero ambient environment guesswork using `@t3-oss/env-core` + Zod schemas for boot verification. Automatic Swagger OpenAPI schema mapping for generic DTO responses.
- **Multi-Stage Docker & Security**: Production Docker setup running on Alpine Linux as a non-root `bun` user (UID/GID 1001) with system health checks and low-RAM memory resource limits.
- **Zero-Downtime Blue-Green Deployment**: Automated Blue-Green deployment pipeline to Azure VM via Cloudflare Tunnel (zero open public inbound ports) and HTTP-only Caddy reverse proxy.

---

## Tech Stack

| Domain                | Technology                                          | Description                                                                     |
| :-------------------- | :-------------------------------------------------- | :------------------------------------------------------------------------------ |
| **Framework**         | **NestJS 11** (`@nestjs/core` v11.1.28)             | Enterprise-grade modular TypeScript framework                                   |
| **Runtime**           | **Bun** (v1.1+)                                     | High-performance JavaScript/TypeScript runtime and package manager              |
| **Language**          | **TypeScript 6.0**                                  | Strict mode, ESNext target, module bundler resolution                           |
| **Database**          | **PostgreSQL 18** via **Drizzle ORM** (v1.0.0-rc.4) | Type-safe SQL ORM and migration tool (`drizzle-kit`) with `pg` driver           |
| **Cache & Lock**      | **Redis 8-alpine** & **Redlock** (v5.0.0-beta.2)    | Redis distributed cache and Redlock seat locking service                        |
| **Background Queues** | **BullMQ** (v6.0.8) & **ioredis** (v6.0.0)          | Distributed queue management for email outbox and seat release                  |
| **Payment Gateway**   | **PayOS** (`@payos/node` v2.0.5)                    | HMAC-SHA256 verified payment processor                                          |
| **API Documentation** | **Scalar UI** (v1.2.12) & **Swagger** (v11.4.6)     | Interactive OpenAPI 3.1.0 reference documentation at `/reference`               |
| **Email Service**     | **Resend** (v6.18.1)                                | Transactional email delivery service via MailProcessor worker                   |
| **Rate Limiting**     | **NestJS Throttler** (v6.5.0)                       | Redis-stored throttler guard (`@nest-lab/throttler-storage-redis`)              |
| **Localization**      | **nestjs-i18n** (v10.8.5)                           | Multilingual support (Vietnamese & English) via `Accept-Language` or `x-lang`   |
| **Environment**       | **Zod** (v4.4.3) + **@t3-oss/env-core**             | Type-safe environment validation schema                                         |
| **Logging**           | **Pino** (`nestjs-pino` v4.6.1)                     | Structured JSON logging (`pino-pretty` in dev, NDJSON in production)            |
| **Testing**           | **Bun Test Runner**                                 | Built-in test runner for unit tests and E2E integration suites                  |
| **DevOps & Deploy**   | **Docker**, **Caddy**, **Cloudflare Tunnel**        | Multi-stage Docker builds, Cloudflare Tunnel SSH/HTTP, Blue-Green bash pipeline |
| **Secrets Manager**   | **Doppler CLI**                                     | Universal secrets management across development, staging, and production        |

---

## System Architecture & Project Structure

```text
ticket-booking/
├── src/                          # NestJS Application Source
│   ├── modules/                  # Feature Modules
│   │   ├── auth/                 # Auth (register, verify-email, login, refresh, logout, password reset)
│   │   ├── users/                # User management (GET /users/me profile)
│   │   ├── booking/              # Booking engine (reserve seats, confirm booking, Redlock, PayOS webhook)
│   │   │   ├── processors/       # BullMQ workers (cancellation, payment reconciliation)
│   │   │   └── cron/             # BookingCronService (5-min seat cleanup cron)
│   │   ├── outbox/               # Transactional Outbox relay (OutboxService polling worker)
│   │   └── mail/                 # Email delivery via Resend API (MailProcessor)
│   ├── database/                 # Database Module & Drizzle Schemas
│   │   ├── database.module.ts    # Drizzle ORM + PG connection pool with SSL normalization
│   │   └── schemas/              # 18 Drizzle table definitions & 9 enums
│   ├── common/                   # Shared Infrastructure & Utilities
│   │   ├── dto/                  # RFC 9457 Problem Details error DTO
│   │   ├── filters/              # GlobalExceptionFilter (RFC 9457 + i18n)
│   │   ├── guards/               # JwtAuthGuard, CustomThrottlerGuard
│   │   ├── interceptors/         # LoggingInterceptor (Pino request/response timing)
│   │   ├── services/             # RedlockService (distributed locking)
│   │   └── utils/                # PayOS crypto verification, client info, i18n helpers
│   ├── config/                   # Configuration loaders (Redis parser)
│   ├── i18n/                     # Translation files (vi/ & en/ JSON dictionaries)
│   ├── env.ts                    # Zod type-safe environment schema
│   ├── main.ts                   # Application entry point (Logger, Pipes, Swagger, Scalar)
│   └── app.module.ts             # Root module with global filters and interceptors
├── test/                         # Test Suites & Mocks
│   ├── integration/              # E2E Integration tests (auth.spec.ts, booking.spec.ts, users.spec.ts)
│   ├── helpers/                  # Test app initializer & database setup helpers
│   ├── mocks/                    # Queue, Redlock, Database, and i18n test mocks
│   └── generated/                # OpenAPI-generated TypeScript assertion types
├── drizzle/                      # Drizzle SQL Migrations & snapshots
├── docker/                       # Docker container files (Dockerfile, Dockerfile.prod)
├── docs/                         # Project Documentation
│   ├── adr/                      # Architectural Decision Records (ADR 0001 - 0008)
│   └── design/                   # 11 Formal Feature & Infrastructure Workflow Specs
├── scripts/                      # Deployment & Setup Automation Scripts
└── docker-compose.yml            # PostgreSQL 18 & Redis 8 development services
```

---

## API Documentation & Overview

Interactive, full API specifications (parameters, request/response bodies, DTO schemas, and try-it-out capabilities) are dynamically served by **Scalar UI**:

- **Scalar Interactive API Reference UI**: [http://localhost:3000/reference](http://localhost:3000/reference)
- **OpenAPI 3.1.0 JSON Spec**: [http://localhost:3000/api-json](http://localhost:3000/api-json)

### Core Functional Modules Overview

| Domain                | Key Endpoints                                                                                                                                                                 | Auth                | Features & Highlights                                                                                                             |
| :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------ | :-------------------------------------------------------------------------------------------------------------------------------- |
| **API Docs & Health** | `GET /`<br>`GET /reference`                                                                                                                                                   | Public              | Application health status check & interactive Scalar OpenAPI documentation.                                                       |
| **Authentication**    | `POST /auth/register`<br>`POST /auth/verify-email`<br>`POST /auth/login`<br>`POST /auth/refresh`<br>`POST /auth/logout`<br>`POST /auth/logout-all`<br>`POST /auth/*-password` | Public / Bearer JWT | Complete identity lifecycle: token verification, device refresh token rotation, multi-device revocation, password reset & change. |
| **User Profile**      | `GET /users/me`                                                                                                                                                               | Bearer JWT          | Returns current authenticated user profile (`isVerified`, `role`, `status`). Throws `403` for suspended accounts.                 |
| **Ticket Booking**    | `POST /bookings/reserve`<br>`POST /bookings/confirm`                                                                                                                          | Bearer JWT + Header | Concurrency-safe seat reservation & confirmation. Enforces `Idempotency-Key` header, Redlock + `SELECT FOR UPDATE` dual-locking.  |
| **Payment Gateway**   | `POST /payments/payos-webhook`                                                                                                                                                | Signature           | PayOS payment webhook gateway. Validates HMAC-SHA256 signature and 5-min anti-replay window.                                      |

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your machine:

- **Bun**: v1.1 or higher ([https://bun.sh](https://bun.sh))
- **Docker & Docker Compose**: For running PostgreSQL 18 and Redis 8 containers locally
- **Doppler CLI** _(Optional)_: Recommended for secret injection across dev/staging/prod environments

### Local Development Setup

1. **Clone repository and install dependencies**:

   ```bash
   git clone https://github.com/ngxccc/ticket-booking.git
   cd ticket-booking
   bun install
   ```

2. **Set up Environment Variables**:
   Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

3. **Start local database and cache services**:

   ```bash
   docker compose up -d
   ```

4. **Run Database Migrations**:

   ```bash
   # Generate TypeScript types for i18n
   bun run i18n:generate

   # Apply Drizzle migrations to local PostgreSQL database
   bun run db:migrate
   ```

5. **Launch Development Server**:

   ```bash
   bun run dev
   ```

   The application will start on `http://localhost:3000`. You can visit `http://localhost:3000/reference` to explore the API endpoints.

---

## Environment Configuration

Environment variables are strictly validated on boot using Zod schema defined in `src/env.ts`.

| Variable                 | Required | Default                 | Description                                                                      |
| :----------------------- | :------- | :---------------------- | :------------------------------------------------------------------------------- |
| `NODE_ENV`               | No       | `development`           | Environment mode (`development`, `production`, `test`)                           |
| `PORT`                   | No       | `3000`                  | Port number the backend server listens on                                        |
| `DOMAIN_NAME`            | No       | `http://localhost:3000` | Backend public base URL                                                          |
| `FRONTEND_URL`           | No       | `http://localhost:3000` | Frontend SPA base URL (used for email verification & reset links)                |
| `LOG_LEVEL`              | No       | `log`                   | Pino logging level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `log`)   |
| `DB_HOST`                | No       | `localhost`             | PostgreSQL database host                                                         |
| `DB_PORT`                | No       | `5432`                  | PostgreSQL database port                                                         |
| `DB_USERNAME`            | No       | `postgres`              | PostgreSQL database username                                                     |
| `DB_PASSWORD`            | No       | `postgrespassword`      | PostgreSQL database password                                                     |
| `DB_DATABASE`            | No       | `ticket_booking`        | PostgreSQL database name                                                         |
| `DB_URL`                 | No       | _None_                  | Full PostgreSQL connection string (overrides individual DB host/user parameters) |
| `REDIS_HOST`             | No       | `localhost`             | Redis host                                                                       |
| `REDIS_PORT`             | No       | `6379`                  | Redis port                                                                       |
| `REDIS_URL`              | No       | _None_                  | Full Redis connection string (overrides individual Redis parameters)             |
| `JWT_SECRET`             | **Yes**  | _None_                  | Secret key used to sign JWT access tokens (min 32 characters)                    |
| `JWT_ACCESS_EXPIRES_IN`  | No       | `15m`                   | Lifetime duration of access tokens                                               |
| `JWT_REFRESH_EXPIRES_IN` | No       | `7d`                    | Lifetime duration of refresh tokens                                              |
| `RESEND_API_KEY`         | **Yes**  | _None_                  | API key for Resend transactional email delivery                                  |
| `EMAIL_FROM`             | No       | `onboarding@resend.dev` | Sender email address for outgoing system emails                                  |
| `PAYOS_CLIENT_ID`        | **Yes**  | _None_                  | PayOS merchant Client ID                                                         |
| `PAYOS_API_KEY`          | **Yes**  | _None_                  | PayOS merchant API key                                                           |
| `PAYOS_CHECKSUM_KEY`     | **Yes**  | _None_                  | PayOS HMAC-SHA256 checksum key for webhook verification                          |

---

## Available Scripts

All commands are defined in `package.json` and executed via `bun`:

```bash
# Application Development & Production
bun run dev             # Start NestJS dev server with live reload & Doppler secrets
bun run build           # Compile TypeScript source code into production JavaScript in dist/
bun run start           # Run compiled production server (bun dist/main.js)
bun run start:debug     # Start NestJS in debug mode with Bun inspector

# Code Quality & Formatting
bun run check-types     # Perform TypeScript type verification (tsc --noEmit)
bun run lint            # Scan and autofix static analysis errors using ESLint
bun run format          # Enforce code styling standards across the project using Prettier

# Database & Migrations (Drizzle ORM)
bun run db:generate     # Generate new SQL migration files from schema updates
bun run db:migrate      # Execute pending migrations against the target database
bun run db:push         # Push schema changes directly to the database (development mode)
bun run db:studio       # Open Drizzle Studio web GUI for database exploration
bun run db:baseline     # Run database baseline verification script across environments

# Testing
bun test                # Run unit test suite in src/ using Bun Test
bun run test:watch      # Run unit test suite in watch mode
bun run test:cov        # Execute unit tests with code coverage report
bun run test:e2e        # Run E2E integration test suite in test/ (requires local Postgres & Redis)

# Code Generation & Tools
bun run i18n:generate   # Auto-generate TypeScript definitions for localization JSON files
bun run openapi:generate# Generate OpenAPI TypeScript client types from running app
```

---

## Background Processing & Cron Jobs

The system runs several background tasks and worker processes:

### BullMQ Queues

1. **`mail` Queue**: Consumed by `MailProcessor`. Asynchronously dispatches verification emails and password reset emails via Resend.
2. **`booking` Queue**: Consumed by `BookingCancellationProcessor` (delayed job triggered on seat reservation) and `PaymentReconciliationProcessor`. Releases locked seats if payment is not completed within 10 minutes.
3. **`outbox` Queue**: Consumed by `OutboxCleanupProcessor`. Deletes old, successfully processed outbox events from the database.

### Background Workers & Crons

- **Transactional Outbox Relay (`OutboxService`)**: Runs every 5 seconds on application startup. Reads pending rows from `outbox_events`, dispatches jobs to BullMQ queues, and marks status as `processed` (or `failed` after 3 retries).
- **Seat Cleanup Backup Cron (`BookingCronService`)**: Runs every 5 minutes (`0 */5 * * * *`). Queries seats with `lockedUntil < NOW()` and status `reserved`, resets seat status to `available`, and marks linked bookings as `expired`.
- **Token Cleanup Cron (`TokenCleanupService`)**: Periodically purges revoked and expired refresh tokens from the `refresh_tokens` table.

---

## Testing & Quality Assurance

The repository maintains strict quality control with 100% passing tests, 0 type errors, and zero lint warnings.

### Running Unit Tests

Unit tests are co-located alongside source files (*.spec.ts) in `src/`:

```bash
bun test
```

### Running E2E Integration Tests

E2E tests in `test/integration/` evaluate real HTTP workflows against PostgreSQL and Redis containers:

```bash
bun run test:e2e
```

### Automated CI/CD & Security Pipelines

Every GitHub Pull Request and push to `main` runs the following automated workflow chain (`.github/workflows/`):

- **CI Pipeline (`ci.yml` & `integration.yml`)**: Executes ESLint, TypeScript type checks (`check-types`), unit tests, database migration dry-runs, application compilation, and E2E integration tests against PostgreSQL 18 & Redis 8 container services.
- **Security Pipeline (`security.yml`)**: Runs **Trivy** vulnerability, misconfiguration, and secret scanning alongside **CodeQL** static analysis (security-extended & code quality rulesets).

---

## Deployment & Infrastructure

The application is containerized and optimized for deployment on resource-constrained Virtual Machines (e.g., Azure B2ats_v2 VM with 2 vCPU, 1GB RAM, 2GB Swap).

### Security Architecture

- **Zero Open Public Ports**: The production server opens **no** inbound SSH (22), HTTP (80), or HTTPS (443) ports to the public internet. All traffic is securely routed outbound using a **Cloudflare Tunnel** daemon (`cloudflared`).
- **Edge SSL Termination**: Cloudflare terminates SSL certificates at the edge. Internal proxy **Caddy** runs in HTTP-only mode to prevent SSL renewal rate limits and redirect loops.

### Zero-Downtime Blue-Green Deployment

Deployments are managed automatically via `./scripts/deploy-app.sh`:

1. Builds a fresh Docker image from `docker/Dockerfile` (or `docker/Dockerfile.prod`).
2. Starts the new container target (e.g., `ticket-booking-app-green` on port `3001`).
3. Performs health check verification via `wget` on `/`.
4. Atomically reloads Caddy configuration (`scripts/reload-caddy.sh`) to point incoming traffic to the new container.
5. Gracefully stops the previous container (`ticket-booking-app-blue` on port `3000`).

### Container Resource Limits

To avoid OOM crashes on low-RAM hosts, container resources are capped via `docker-compose.yml`:

| Service                         | CPU Cap | Hard RAM Limit | Soft RAM Limit | Notes                                   |
| :------------------------------ | :------ | :------------- | :------------- | :-------------------------------------- |
| `ticket-booking-postgres`       | `0.50`  | `512 MB`       | `256 MB`       | PostgreSQL 18 Database                  |
| `ticket-booking-redis`          | `0.25`  | `128 MB`       | `32 MB`        | Redis 8 (`maxmemory 128mb allkeys-lru`) |
| `ticket-booking-caddy`          | `0.15`  | `128 MB`       | `64 MB`        | Reverse Proxy                           |
| `ticket-booking-app-blue/green` | `0.50`  | `256 MB`       | `128 MB`       | Application Container (non-root `bun`)  |

---

## Architecture Decision Records & Design Docs

System design decisions and workflow specifications are version-controlled in the repository:

- **Architectural Decision Records (`docs/adr/`)**:
  - `0001-redlock-distributed-locking.md`: Redlock algorithm for multi-seat reservation concurrency.
  - `0002-user-name-format.md`: Standardized single `fullName` field schema decision.
  - `0003-route-constants-centralization.md`: Centralized route path constants pattern.
  - `0004-payment-confirmation-architecture.md`: PayOS webhook HMAC validation and payment processing.
  - `0005-pino-structured-logging.md`: Pino structured logging configuration.
  - `0006-concurrency-micro-collisions.md`: Micro-collision mitigation strategies under high load.
  - `0007-password-hashing-scrypt.md`: Scrypt password hashing parameters and security strategy.
  - `0008-refresh-token-separation.md`: Per-device refresh token storage and revocation.

- **Workflow Specifications (`docs/design/`)**:
  - Contains 11 formal design specifications covering Auth, Booking Concurrency, Payment Confirmation, Outbox Event Relay, Docker Deployment, and Error Filters.

---

## License & Author

Distributed under the MIT License. See `LICENSE` for details.

Developed with ❤️ by **Ngoc Tran** ([@ngxccc](https://github.com/ngxccc)).
