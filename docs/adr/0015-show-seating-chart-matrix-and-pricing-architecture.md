# 15. Showtime Seating Chart Matrix, Live Availability Computation, and Pricing Architecture

Date: 2026-09-27
Deciders: Team / Core Architecture

- **Status**: `Accepted`
- **Date**: `2026-09-27`
- **Feature**: `shows`
- **Topic**: `Showtime Seating Chart Matrix (GET /api/v1/shows/:id/seats), Virtual Computed Status (Zero-Stale Holds), Single-JOIN Database Query, Catalog Multiplier Standardization (Zero-Fraction Currency)`
- **Target Module**: `src/modules/shows/shows.controller.ts`, `src/modules/shows/shows.service.ts`, `src/modules/shows/dto/show-seats-response.dto.ts`, `src/database/schemas/`
- **Spec Reference**: Issue #93, Issue #37, Issue #128, `docs/standards/api-design-and-error-handling.md`, `ADR-0009` (Show Seat Preallocation and Schedule Collision)

## Status

Accepted

## Context

When a customer navigates to select cinema seats for a scheduled movie showtime (`GET /api/v1/shows/:id/seats`), the backend must render a comprehensive seating layout that reflects exact physical coordinates, hall dimensions, calculated seat pricing, and real-time reservation availability.

Serving seating chart matrixes introduces four core engineering challenges:

1. **Stale Lock Invariant (Lapsed Reservations)**:
   When reservations are held (`show_seats.status = 'reserved'`) with a time-to-live (`lockedUntil`), users may abandon their checkout sessions. If the system relies solely on asynchronous background cleanup jobs, expired seats remain visually blocked for other customers until the worker runs.
2. **Realtime Protocol Coordination (HTTP vs WebSockets)**:
   Continuous HTTP polling for seating updates creates excessive database and network load. The system requires a clean boundary between the initial layout snapshot (HTTP) and subsequent seat status changes (WebSockets).
3. **Currency Precision & Cash/Transfer Friction (Fractional VND)**:
   In Vietnam, physical currency does not circulate denominations below 1,000 VND. Calculating seat prices via non-standard multipliers (e.g., $90,000 \times 1.15 = 103,500$ VND) introduces fractional change dilemmas at POS physical counters.
4. **Query Latency under High Concurrency**:
   Seating charts involve joining 6 distinct database entities (`shows`, `movies`, `halls`, `cinemas`, `show_seats`, `seats`, `seat_types`). Inefficient multi-step queries or unindexed scans degrade read performance during ticket release surges.

## Decision

We decided to establish a High-Performance Seating Chart & Live Availability Architecture structured across 5 core pillars:

1. **Initial Snapshot Pattern (HTTP) + Delta Broadcast (WebSockets #37)**:
   - `GET /api/v1/shows/:id/seats` serves strictly as the **Initial Layout & State Snapshot**.
   - Clients fetch this snapshot once upon entering the seating screen, obtaining complete hall dimensions, itemized seat coordinates, prices, and status summary.
   - Subsequent real-time state changes (`AVAILABLE` $\leftrightarrow$ `RESERVED` $\leftrightarrow$ `BOOKED`) are streamed via WebSocket room delta broadcasts (`show:${showId}`) per Issue #37, eliminating repeated HTTP polling.
2. **Virtual Computed Status Invariant (Zero-Stale Holds)**:
   - The seating query computes real-time availability dynamically in SQL:

     ```sql
     CASE
       WHEN ss.status = 'reserved' AND ss.locked_until < NOW() THEN 'available'
       ELSE ss.status
     END AS computed_status
     ```

   - Guarantees immediate seat availability to incoming customers the exact millisecond a hold expires, decoupling user experience from background worker execution intervals.
3. **Catalog Multiplier Standardization (Zero-Fraction Currency Policy - Option A)**:
   - Standardize all cinema catalog configurations such that:
     - `shows.basePrice` is always a multiple of 10,000 VND (e.g. 80,000, 90,000, 100,000 VND).
     - `seatTypes.priceMultiplier` is strictly configured with clean decimal multiples: `1.00` (Standard), `1.20` (VIP), `1.40` (Deluxe), `1.50` (Couple), `2.00` (Suite).
   - Guarantees `finalPrice = Math.round(basePrice * multiplier)` is mathematically guaranteed to result in exact thousand-VND integer values with zero fractional remainders under 1,000 VND for both online bank transfers (PayOS) and physical POS cash payments.
4. **Single-JOIN Database Query with B-Tree Index Utilization**:
   - Query the entire seating grid in a single SQL operation joining `shows`, `movies`, `halls`, `cinemas`, `show_seats`, `seats`, and `seat_types`.
   - Utilizes the existing `uniqueIndex("show_seats_show_id_seat_id_uidx")` on `(show_id, seat_id)` to achieve $O(\log N)$ B-Tree Index Seek latency (< 1.5ms for 100–300 seats).
5. **Structured Layout Envelope (`dimensions`, `summary`, `seats`)**:
   - Returns a comprehensive response envelope containing:
     - `dimensions`: `{ totalRows: N, totalCols: M }` for client CSS Grid and layout calculations.
     - `summary`: `{ total: N, available: A, reserved: R, booked: B }` for instant UI badge counters without client-side array filtering.
     - `seats`: Itemized flat array of all hall seats with coordinates, type, price, and status.

## Positive Consequences

- **Instant Lapsed Seat Reallocation**: Customers can immediately reserve expired seats without waiting for scheduled cleanup cronjobs.

## Negative Consequences / Risks

- **Dynamic SQL Computation**: The `CASE WHEN` expression is evaluated on each row during the select query, requiring CPU cycles during high read concurrency (mitigated by future Redis caching in #128).
- **Strict Catalog Discipline**: Cinema administrators must adhere to the standardized multiplier guidelines to preserve zero-fraction pricing.

## Explicit Tradeoffs

- **Virtual SQL Status Computation vs Cleanup Cronjob Dependency**: Evaluating `CASE WHEN ss.status = 'reserved' AND ss.locked_until < NOW()` dynamically consumes minor PostgreSQL CPU cycles per query in exchange for 100% instant seat availability when locks lapse, completely decoupling customer experience from worker latency.
- **Catalog Multiplier Discipline (Option A) vs Arbitrary Floating Multipliers**: Constraining multipliers to standardized clean multiples (`1.00`, `1.20`, `1.50`, `2.00`) limits administrative flexibility in setting arbitrary percentages (e.g. `1.17`) in exchange for mathematically guaranteed integer VND pricing across all payment channels.

## Validation & Verification

- Integration tests in `test/integration/shows.spec.ts` asserting:
  - Return of all pre-allocated seats with correct `row`, `number`, and `seatNumber`.
  - Exact calculation of `finalPrice` based on seat type multiplier.
  - Virtual fallback of expired `reserved` seats to `available` when `lockedUntil < NOW()`.
  - Proper `404 Not Found` response when `showId` does not exist.
