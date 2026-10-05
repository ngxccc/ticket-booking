---
title: "Booking Load & Stress Testing SSOT Operational Workflow"
docType: "feature-workflow"
status: "approved"
date: 2026-08-28
author: "Team / Core Architecture"
version: "1.0.0"
---

# Booking Load & Stress Testing SSOT Operational Workflow

---

## Overview & Context

This document is the **Single Source of Truth (SSOT)** describing the architecture, operational workflow, test data lifecycle, and metrics verification for the Grafana k6 Load & Stress Testing Suite (`test/load/`) targeting high-concurrency seat reservations (`POST /bookings/reserve`).

### Core Objectives & Concurrency Targets

1. **Mass Contention Stress Simulation**: Simulate 500 to 2,000 Virtual Users (VUs) simultaneously attempting to reserve the exact same VIP seat within a 5-second burst window.
2. **Lock Integrity & Zero Overselling (ACID Validation)**: Strictly verify that Redlock (RAM layer) and PostgreSQL `SELECT ... FOR UPDATE` (Pessimistic DB layer) guarantee:
   - Exactly **1 user receives HTTP 201 Created**.
   - Exactly **$N - 1$ users receive HTTP 409 Conflict** (`SEATS_ALREADY_LOCKED` or `SEATS_NOT_AVAILABLE`).
   - **Zero unhandled HTTP 500 server crashes** or database deadlocks (`40P01`).
3. **Abuse Defense & Rate Limiting Verification**: Verify `CustomThrottlerGuard` triggers `HTTP 429 Too Many Requests` (RFC 9457) when client IPs exceed 10 req/min.
4. **Performance Thresholds**: Assert $p95 \le 700\text{ms}$ (accounting for ADR 0006 Redlock 3-retry delay) and $p99 \le 800\text{ms}$ under peak concurrent burst.

---

## Architecture

- **Test Data Seeder & Token Factory**: Bun-driven seeding script generating isolated movie, cinema, hall, and user batches (`test/load/suites/booking-concurrency/seed.ts`).
- **k6 Test Engine**: High-concurrency scenario runners (`hot_seat_burst`, `rate_limit_abuse`) executed via Goja runtime.
- **Post-Test Verifier & Teardown**: Database and Redis state verification ensuring atomicity and cleanup (`test/load/suites/booking-concurrency/teardown.ts`).

---

## Operational Flow

```mermaid
sequenceDiagram
    autonumber
    actor Dev as "Developer / CI Dispatch"
    participant CLI as "Bun CLI (bun run test:load)"
    participant Seeder as "Data Seeder (seed.ts)"
    participant SUT as "Backend SUT (NestJS :3000)"
    participant K6 as "Grafana k6 Engine"
    participant Redis as "Redis (Redlock & Throttler)"
    participant DB as "PostgreSQL (Drizzle ORM)"
    participant Verifier as "Verifier (teardown.ts)"

    Dev->>CLI: bun run test:load (VUS=500/2000)
    CLI->>SUT: Healthcheck ping (GET /api-json or :3000 TCP)
    alt SUT is offline
        CLI-->>Dev: Abort with error message (Start server first)
    end

    Note over CLI,Seeder: Phase 1: Test Data Seeding
    CLI->>Seeder: Execute suites/booking-concurrency/seed.ts
    Seeder->>DB: Insert Movie, Cinema, Hall, Show, VIP Seats
    Seeder->>DB: Bulk insert N Test Users
    Seeder->>Seeder: Sign N JWT Access Tokens (offline via JWT_SECRET)
    Seeder->>CLI: Write test/load/fixtures/booking-fixtures.json

    Note over CLI,K6: Phase 2: Transpile & Load Testing
    CLI->>CLI: bun build test/load/suites/booking-concurrency/scenario.k6.ts -> .dist/booking-concurrency.k6.js
    CLI->>K6: Run dist/load-test.js (Native binary or Docker fallback)

    par Scenario 1: Hot Seat Burst (t=0s to 10s)
        K6->>SUT: 500-2,000 VUs simultaneous POST /bookings/reserve (Target: Exact Same Seat)
        SUT->>Redis: Acquire Redlock lock:show_seat:<seatId> (2000ms TTL)
        alt 1 Winner Request (First to acquire lock)
            SUT->>DB: BEGIN TX -> SELECT ... FOR UPDATE -> UPDATE reserved -> Commit
            SUT-->>K6: HTTP 201 Created (Booking Details)
        else N-1 Loser Requests (Contention micro-collision)
            SUT->>Redis: 3 retries (200ms delay) fail -> throw ConflictException
            SUT-->>K6: HTTP 409 Conflict (SEATS_ALREADY_LOCKED)
        end
    and Scenario 2: Rate Limit Abuse (t=12s to 20s)
        K6->>SUT: 1 VU sends 30 rapid requests from fixed IP (X-Forwarded-For: 192.168.1.100)
        alt First 10 requests
            SUT-->>K6: HTTP 200/409 (Allowed)
        else Requests 11 to 30
            SUT-->>K6: HTTP 429 Too Many Requests (RFC 9457)
        end
    end

    K6-->>CLI: Output test metrics and assert Thresholds (p95, p99)

    Note over CLI,Verifier: Phase 3: Post-Test Invariant Verification & Teardown
    CLI->>Verifier: Execute suites/booking-concurrency/teardown.ts
    Verifier->>DB: Assert: Exactly 1 row in bookings for test show
    Verifier->>DB: Assert: Exactly 1 seat marked 'reserved' in show_seats
    Verifier->>Redis: Assert: Zero leaked lock:show_seat:* keys
    Verifier->>DB: Truncate test entities & clean up fixtures
    Verifier-->>CLI: Invariant verification passed
    CLI-->>Dev: Exit code 0 (Success)
```

---

## Technical Specifications & Scenarios

### 1. Token Distribution via `SharedArray`

To prevent memory amplification and eliminates false CPU bottlenecks on the Auth service:

- Fixtures are stored in `test/load/fixtures/booking-fixtures.json`.
- Loaded once in the k6 `init` context:
  ```ts
  import { SharedArray } from "k6/data";

  const fixtureData = new SharedArray("fixtures", () => {
    return JSON.parse(open("./fixtures/booking-fixtures.json"));
  });
  ```

### 2. K6 Scenarios & Custom Metrics Definition

```ts
import { Counter, Trend } from "k6/metrics";

export const reserveSuccess201 = new Counter("reserve_success_201");
export const reserveConflict409 = new Counter("reserve_conflict_409");
export const reserveThrottled429 = new Counter("reserve_throttled_429");
export const unexpectedErrors = new Counter("reserve_unexpected_errors");
export const reserveDuration = new Trend("reserve_duration_ms");
```

### 3. Scenario Thresholds

```ts
export const options = {
  scenarios: {
    hot_seat_burst: {
      executor: "per-vu-iterations",
      vus: Number(__ENV.VUS) || 500,
      iterations: 1,
      maxDuration: "10s",
      exec: "hotSeatScenario",
      startTime: "0s",
    },
    rate_limit_abuse: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 30,
      maxDuration: "10s",
      exec: "rateLimitScenario",
      startTime: "12s",
    },
  },
  thresholds: {
    reserve_success_201: ["count==1"],
    reserve_conflict_409: [`count==${(Number(__ENV.VUS) || 500) - 1}`],
    reserve_unexpected_errors: ["count==0"],
    "http_req_duration{scenario:hot_seat_burst}": ["p(95)<=700", "p(99)<=800"],
  },
};
```

---

## Security & Test Data Isolation

1. **Offline Token Signing Isolation**:
   - Test JWT tokens are signed locally using ephemeral test users created during the seeding phase, preventing password brute-force or real user credential exposure.
2. **Rate Limiter Bypass Protection**:
   - Production environments strictly enforce `CustomThrottlerGuard` with Redis storage, while load testing scripts use controlled `X-Forwarded-For` injection solely to verify rate limiting thresholds under `trust proxy` configuration.
3. **Deterministic Teardown**:
   - Post-test verification automatically cleans up temporary shows, halls, and bookings to prevent stale test data pollution.

---

## Domain Invariants & Verification Checklist

- [x] **INV-1 (Single Winner)**: Under 500–2,000 concurrent reservation attempts for the exact same seat, strictly 1 request succeeds (HTTP 201).
- [x] **INV-2 (Zero Overselling)**: Database table `bookings` contains exactly 1 booking record for the hot seat, and table `show_seats` contains exactly 1 seat in `reserved` status.
- [x] **INV-3 (Conflict Integrity)**: Exactly $N-1$ competing requests receive HTTP 409 Conflict without causing unhandled HTTP 500 errors or database deadlock exceptions (`40P01`).
- [x] **INV-4 (Rate Limit Protection)**: Excessive requests from a single client IP exceed 10 req/min trigger HTTP 429 Too Many Requests in accordance with RFC 9457.
- [x] **INV-5 (Lock Hygiene)**: All distributed Redis locks (`lock:show_seat:*`) are cleanly released upon transaction completion.
