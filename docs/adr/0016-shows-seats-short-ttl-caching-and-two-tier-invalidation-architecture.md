# 16. Showtime Seating Chart Short-TTL Caching, Two-Tier Expiration Lifecycle, and Bandwidth Optimization Architecture

Date: 2026-10-04
Deciders: Team / Core Architecture

- **Status**: `Accepted`
- **Date**: `2026-10-04`
- **Feature**: `shows` & `booking`
- **Topic**: `Short-TTL Cache-Aside (GET /shows/:id/seats), Two-Tier Seat Hold Expiration Lifecycle (BullMQ Delayed Job + Fallback Cron), Compare-And-Swap Race Condition Safety, Deterministic Multi-Point Invalidation, Three-Tier Bandwidth Optimization (HTTP Compression, Compact Dictionary Schema, Cache-Control & ETag)`
- **Target Module**: `src/modules/shows/`, `src/modules/booking/`, `src/main.ts`, `test/load/`
- **Spec Reference**: Issue #128, Issue #93, Issue #37, `ADR-0001` (Redlock Distributed Lock), `ADR-0004` (Payment Confirmation Architecture), `ADR-0015` (Show Seating Chart Matrix and Pricing Architecture)

## Status

Accepted

## Context

`ADR-0015` established the foundational single-JOIN database query and virtual status computation (`CASE WHEN ss.status = 'reserved' AND ss.locked_until < NOW() THEN 'available'`) for `GET /api/v1/shows/:id/seats`.

However, under production conditions and flash-sale surges (e.g. blockbuster ticket release windows), this baseline introduced three severe performance and architectural bottlenecks identified in **Issue #128**:

1. **Database Connection Pool Exhaustion under Read Surges**:
   - Serving repeated 6-table relational queries directly from PostgreSQL during peak traffic saturates PostgreSQL connection limits (`max: 20`), introducing high p95/p99 tail latency and risk of `ConnectionPoolTimeout`.
2. **Two-Tier Seat Hold Cleanup & Race Hazard Between Worker and Cron**:
   - Seat holds expire after 10 minutes (`lockedUntil`). The system employs BullMQ delayed jobs (`BookingCancellationProcessor`) for immediate release at second 600, paired with a periodic backup cron (`BookingCronService`) every 5 minutes to sweep orphaned holds.
   - A concurrent execution hazard exists where both the worker and cron attempt to release the same expired booking simultaneously, risking conflicting state transitions and double-invalidation overhead.
3. **Severe Network Bandwidth and Network Saturation**:
   - Rendering high-density seating layouts (e.g. IMAX halls with 500 seats) returned extensive verbose JSON payloads ($\sim 120\text{ KB}$ per uncompressed response).
   - Under moderate load (8,000–12,000 requests), network consumption escalated to over $750\text{ MB}$, saturating network interfaces and inflating client time-to-first-byte (TTFB).

## Decision

We establish an end-to-end, resilient caching, lifecycle cleanup, and bandwidth optimization architecture structured across four core pillars:

### 1. Two-Tier Seat Expiration Lifecycle Architecture with Compare-And-Swap Safety

To guarantee zero stale holds without reliance on a single point of failure, seat expiration is governed by a two-tier defense-in-depth model protected by atomic SQL Compare-And-Swap (CAS):

- **Primary Tier (Real-Time Precision)**:
  - When `POST /bookings/reserve` locks seats, an enqueued BullMQ delayed job (`BOOKING_JOBS.CANCEL_BOOKING`, delay: `600,000ms`) is scheduled.
  - At exactly second 600, `BookingCancellationProcessor` executes to transition unconfirmed holds.
- **Secondary Tier (Safety-Net Periodic Sweeper)**:
  - `BookingCronService` runs every 5 minutes (`EVERY_5_MINUTES`) to discover and release any orphaned reserved seats whose `lockedUntil < NOW()`. This mitigates Redis restarts, process crashes, or worker queue eviction.
- **Compare-And-Swap Race Condition Safety**:
  - Both processes execute conditional atomic updates guarded by status invariants:
    ```sql
    UPDATE bookings
    SET status = 'expired'
    WHERE id = :bookingId AND status = 'pending_payment';
    ```
  - PostgreSQL row-level locks (`X-Lock` on `bookings`) serialize concurrent execution. The first committing transaction transitions the status to `'expired'`. The subsequent transaction evaluates `status = 'pending_payment'` as false, returning 0 rows and skipping downstream seat mutations cleanly.

### 2. Short-TTL Cache-Aside Pattern with Fail-Open Graceful Degradation

- `GET /api/v1/shows/:id/seats` caches serialized seating layout responses in Redis under the localized key schema:
  ```
  shows:seats:{showId}:{lang}
  ```
- **TTL Duration**: Fixed at `SEATS_CACHE_TTL_SECONDS = 2` seconds.
  - A 2-second window is sufficient to absorb over 95% of burst read traffic for hot blockbuster showtimes during high concurrency.
  - Mitigates long-lived stale read anomalies even in the theoretical event of dropped pub/sub or invalidation signals.
- **Fail-Open Policy (INV-7 Graceful Degradation)**:
  - All Redis read and write operations inside `ShowsService` are wrapped in try-catch guards.
  - If Redis is unreachable, timeouts occur, or connection blips occur, the service logs a warning and falls back immediately to the authoritative PostgreSQL query with SQL `CASE WHEN` virtual status computation.

### 3. Deterministic Multi-Point Cache Invalidation

To guarantee that seat state changes are immediately visible to subsequent requests without waiting for the 2-second TTL expiration, deterministic cache invalidation is hooked into all four mutation lifecycle transitions:

1. **Reservation Hold**: `POST /bookings/reserve` invalidates `shows:seats:{showId}:*`.
2. **Booking Confirmation**: `POST /bookings/confirm` invalidates `shows:seats:{showId}:*`.
3. **Worker Timeout**: `BookingCancellationProcessor` invalidates `shows:seats:{showId}:*` upon expiring holds.
4. **Cron Sweeper**: `BookingCronService` gathers distinct affected `showIds` and executes parallel invalidations via `Promise.allSettled`.

```ts
await Promise.allSettled(
  affectedShowIds.map((showId) =>
    showsService.invalidateShowSeatsCache(showId),
  ),
);
```

`Promise.allSettled` ensures parallel non-blocking dispatch and prevents individual Redis transmission errors from crashing queue processors or cron transactions.

### 4. Three-Tier Bandwidth & Network Payload Optimization

To address payload bloat, network transfer is optimized across three independent tiers:

- **Tier 1 (Transport Compression - Gzip/Deflate)**:
  - Middleware registered in `src/main.ts` using `compression({ threshold: 1024 })`.
  - Automatically compresses HTTP response bodies exceeding 1 KB.
- **Tier 2 (Compact Schema - Dictionary Pattern)**:
  - `ShowSeatsResponseDto` refactored to lift duplicate seat type definitions into a top-level dictionary:
    ```json
    {
      "seatTypes": [
        {
          "id": "uuid",
          "name": "Standard",
          "priceMultiplier": "1.00",
          "finalPrice": 120000
        },
        {
          "id": "uuid",
          "name": "VIP",
          "priceMultiplier": "1.50",
          "finalPrice": 180000
        }
      ],
      "seats": [
        {
          "seatId": "...",
          "seatTypeId": "uuid",
          "row": "A",
          "number": 1,
          "status": "available"
        }
      ]
    }
    ```
  - Eliminates redundant nested `type: { id, name, priceMultiplier }` objects across hundreds of individual seat objects.
- **Tier 3 (HTTP Caching & Conditional Revalidation)**:
  - Decorated with `@Header("Cache-Control", "public, max-age=2, stale-while-revalidate=1")`.
  - Enables downstream proxies, CDNs, and browsers to leverage ETag headers and return `304 Not Modified` with 0-byte payload bodies for repeated client polling.

## Invariants

- **`INV-1 (Two-Tier Sweeper Idempotence)`**: Concurrent execution of `BookingCancellationProcessor` and `BookingCronService` MUST NOT double-transition booking statuses or corrupt seat availability.
- **`INV-2 (Zero Stale Seat Holds)`**: A seat whose reservation lock has lapsed (`lockedUntil < NOW()`) MUST be perceived as `available` on the immediate next read request.
- **`INV-3 (Fail-Open Read Availability)`**: In the event of complete Redis unavailability, `GET /shows/:id/seats` MUST succeed by reading directly from PostgreSQL without throwing 500 errors.
- **`INV-4 (Locale Isolation)`**: Invalidation operations MUST wipe cached entries across all supported locales (`vi`, `en`) for the target `showId`.
- **`INV-5 (Bandwidth Envelope Threshold)`**: High-density seating chart responses (up to 500 seats) with HTTP compression MUST NOT exceed 10 KB per response.

## Positive Consequences

- **92.6% Bandwidth Reduction**: Average response size slashed from $89.3\text{ KB}$ to $6.63\text{ KB}$ per request. Total data transferred over 15,000 requests dropped from $>750\text{ MB}$ to $\sim 100\text{ MB}$.
- **PostgreSQL Pool Protection**: Under 200 concurrent VUs distributed via Pareto 80/20 across 20 distinct shows, connection pool usage remained stable with 0 pool saturation timeouts.
- **Sub-800ms Tail Latency**:
  - Standard Hall p(95): **789.1 ms** (SLA: $<1500\text{ms}$).
  - IMAX Hall (500 seats) p(95): **760.0 ms** (SLA: $<2500\text{ms}$).
- **100% Reliable State Machine**: Zero race condition collisions between BullMQ delayed worker and periodic cleanup cron.

## Negative Consequences / Risks

- **Redis Key Write Overhead**: Each seat mutation incurs an extra Redis `DEL` operation across configured locale keys ($O(1)$ round trip).
- **Client De-referencing Requirement**: Frontend clients must map `seat.seatTypeId` against `envelope.seatTypes[seatTypeId]` instead of reading seat type names directly from the seat object.
- **Memory Footprint**: Redis holds serialized JSON representations for active showtimes for up to 2 seconds ($\sim 55\text{ KB}$ per hot show), requiring approximately $50\text{ MB}$ RAM under 1,000 concurrent peak showtimes nationwide.

## Explicit Tradeoffs

- **Short TTL (2s) vs Invalidation Complexity**: Utilizing an ultra-short 2s TTL eliminates long-term stale read risks even if invalidation signals drop, while deterministic multi-point invalidation guarantees immediate consistency for active users.
- **Two-Tier Cleanup (Worker + Cron) vs Single Mechanism**: Running both BullMQ delayed jobs and a backup sweeper cron introduces queue management overhead in exchange for defense-in-depth against Redis or worker outages.
- **Compact Dictionary Schema vs Direct Object Nesting**: Moving `seatTypes` to the root envelope requires client-side identifier lookup in exchange for a 92.6% reduction in network payload size.

## Validation & Verification

1. **Automated Concurrency & Load Verification (`test/load/suites/shows-seats/`)**:
   - Verified against 20 shows under Pareto 80/20 distribution with 15,537 requests over 82 seconds without dead time.
   - Achieved 100% success rate (HTTP 200 OK) with 0 HTTP 5xx server errors and p95 latency under 800ms.
   - Full empirical benchmark telemetry and comparative data matrix documented in `docs/benchmarks/shows-seats-caching-performance.md`.
2. **Unit & Integration Test Suites**:
   - `test/integration/shows.spec.ts`: Validates compact schema output and itemized seat pricing.
   - `src/modules/shows/shows.service.spec.ts`: Asserts Redis caching, cache key construction, and `invalidateShowSeatsCache` behavior across all locales.
   - `src/modules/booking/booking-cron.service.ts`: Confirms `Promise.allSettled` cache invalidation across affected show IDs upon releasing expired holds.
