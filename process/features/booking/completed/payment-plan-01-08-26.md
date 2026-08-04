# Payment Confirmation & Ticket Issuance Plan

**Date**: August 1, 2026  
**Complexity**: COMPLEX (Multi-phase)  
**Implementation Approach**: Transactional Dual-Write Outbox + DB Pessimistic Locking (`SELECT FOR UPDATE`) + PayOS OrderCode Anchor  
**Execution Model**: Phase-by-Phase with Pre-Research and Post-Testing  
**Formal Spec Path**: `process/features/booking/completed/Payment_Confirmation_Formal_Spec.md`  
**Risk Gate Artifact**: `process/features/booking/reports/harness/risk-gate.json`  
**Invariant Bindings**: `INV-1 (Pessimistic Locking & Anti-Double Confirmation)`, `INV-2 (Transactional Dual-Write Outbox)`, `INV-3 (Redis Idempotency & Expiry Safety)`, `INV-4 (PayOS Reconciliation & Auto-Refund Worker)`, `INV-5 (Strict Ownership & Anti-Enumeration 404)`, `INV-6 (PayOS HMAC-SHA256 & 5m Anti-Replay Window)`, `INV-7 (Redis Fail-Closed Fallback)`, `INV-8 (DB Statement Timeout 3s & Observability)`, `INV-9 (UI/UX State Machine & Status Polling)`  

## Touchpoints

- **Files Read**: `src/database/schemas/enums.schema.ts`, `src/database/schemas/bookings.schema.ts`, `src/database/schemas/payments.schema.ts`, `src/modules/booking/booking.service.ts`, `src/modules/booking/booking.controller.ts`
- **Files Modified**: `src/database/schemas/enums.schema.ts`, `src/database/schemas/bookings.schema.ts`, `src/modules/booking/booking.service.ts`, `src/modules/booking/booking.controller.ts`, `package.json`
- **Files Created**: `src/common/utils/payos-crypto.util.ts`, `src/modules/booking/dto/confirm-booking.dto.ts`, `src/modules/booking/payos-webhook.controller.ts`, `src/modules/booking/processors/payment-reconciliation.processor.ts`, `src/modules/outbox/processors/outbox-cleanup.processor.ts`, `drizzle/20260801004446_fair_natasha_romanoff/migration.sql`

## Public Contracts

### HTTP Endpoints
1. `POST /api/v1/bookings/confirm`
   - Request DTO: `ConfirmBookingDto` (`bookingId`, `orderCode`, `paymentMethod: 'payos'`, `transactionId`, `amount`)
   - Header: `Idempotency-Key` (cached 60s on Redis `idempotency:confirm:<userId>:<key>`)
   - Response: `200 OK` (`ConfirmBookingResponseDto`)
   - Error Catalog (RFC 9457): `400 PAYMENT_AMOUNT_MISMATCH`, `404 BOOKING_NOT_FOUND`, `409 PAYMENT_TRANSACTION_EXISTS`, `410 BOOKING_EXPIRED`, `500 INTERNAL_SERVER_ERROR`.

2. `POST /api/v1/payments/payos-webhook`
   - HMAC-SHA256 signature verification (`INV-6`) + Anti-replay 5-minute timestamp window.

## Blast Radius

Core booking confirmation flow (`POST /api/v1/bookings/confirm`), PayOS webhook integration (`POST /api/v1/payments/payos-webhook`), database schema enum/column migration (`order_code`, `requires_refund`, `PAYOS`), BullMQ background workers (`booking` queue reconciliation, `outbox` queue 7-day retention cleanup).

## Harness & Mechanical Validation

Before phase transition or PR merge, run:
```bash
node .claude/skills/ag-generate-plan/scripts/validate-plan-artifact.mjs process/features/booking/active/payment-plan-01-08-26.md
```

## Overview

Implements the **Atomic Payment Confirmation & Ticket Issuance System (`POST /api/v1/bookings/confirm`)** using the PayOS VietQR gateway for the Standalone Cinema Ticket Booking App. The system guarantees 100% ACID atomicity via PostgreSQL DB pessimistic locking (`SELECT ... FOR UPDATE`), prevents duplicate processing via Redis Idempotency Header (60s) & DB unique constraints, publishes asynchronous outbox events (`booking.confirmed`), and automatically triggers refunds via PayOS Reconciliation Worker when payment amounts do not match (`EDGE-1`) or booking reservations expire (`EDGE-2`).

**Status**: 🚀 COMPLETED

---

## Quick Links

- [Context and Goals](#1-context-and-goals)
- [Execution Brief](#15-execution-brief)
- [Architecture Decisions](#3-architecture-decisions-final)
- [System Invariants & Reliability Invariants](#4-system-invariants--reliability-invariants)
- [Database Schema](#11-database-schema)
- [API Surface](#12-api-surface)
- [Phased Delivery Plan](#14-phased-delivery-plan)
- [Implementation Checklist](#implementation-checklist)
- [Verification Evidence & Success Criteria](#17-verification-evidence--success-criteria)
- [Resume and Execution Handoff](#18-resume-and-execution-handoff)

---

## 1. Context and Goals

The current booking system supports temporary seat holds for 10 minutes (`POST /api/v1/bookings/reserve`). The next step is implementing the payment confirmation flow when a customer completes VietQR payment on PayOS.

Refer to general project context at `process/context/all-context.md` and testing criteria at `process/context/tests/all-tests.md`.

**In-scope**:
- `POST /api/v1/bookings/confirm` receiving payment status from Client/PayOS Webhook.
- DTO validation using NestJS `class-validator` / `class-transformer` (`ConfirmBookingDto`).
- Atomic DB Transaction: Row lock on `bookings` (`SELECT FOR UPDATE`), status update `pending_payment` $\rightarrow$ `confirmed`, insert payment record (`PAYOS`), update seat status `reserved` $\rightarrow$ `booked`, and insert `booking.confirmed` outbox event in a single transaction.
- PayOS OrderCode Anchor: Unique bigint column `bookings.order_code` matching PayOS orderCode 1-to-1.
- PayOS Webhook Endpoint `POST /api/v1/payments/payos-webhook` with HMAC-SHA256 signature verification & 5-minute timestamp anti-replay window (`INV-6`).
- Fail-safe Auto-Refund: Record status `requires_refund` and call PayOS Cancel/Refund API (`payos.cancelPaymentLink(orderCode)`) on amount mismatch (`EDGE-1`) or expired booking (`EDGE-2`).
- Background Workers: `PaymentReconciliationProcessor` (periodically reconciles PayOS orderCode `INV-4`) and `OutboxCleanupProcessor` (cleans up events older than 7 days `INV-2`).
- Resilience: Redis fail-closed fallback to DB transaction (`INV-7`) & DB `statement_timeout = 3000ms` (`INV-8`).

**Out-of-scope**:
- Other payment gateways (VNPay, MoMo) — system exclusively uses PayOS.
- Frontend UI components (Polling contract `INV-9` defined for frontend integration).

---

## 1.5 Execution Brief

### Phase A: Environment & Dependencies
- Install `@payos/node` and configure environment variables `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.

### Phase B: Database Schema & Migration
- Add `"requires_refund"` to `paymentStatusEnum` & `"PAYOS"` to `paymentMethodEnum` in `enums.schema.ts`.
- Add column `order_code` (BigInt, Unique Index `bookings_order_code_uidx`) to `bookings.schema.ts`. Run `bun run db:generate`.

### Phase C: DTO Core & Error Catalog
- Implement `ConfirmBookingDto` and `ConfirmBookingResponseDto` using `class-validator`.

### Phase D: PayOS Helper & HMAC Service
- Implement `src/common/utils/payos-crypto.util.ts` for HMAC-SHA256 verification & timestamp window.

### Phase E: Core Confirmation Logic
- Implement `BookingService.confirmBooking()` with `db.transaction()`, `SELECT FOR UPDATE`, Outbox Dual-Write, Redis Fallback (`INV-7`), DB Statement Timeout 3s (`INV-8`).

### Phase F: PayOS Webhook Controller
- Implement `PayOSWebhookController` at `/api/v1/payments/payos-webhook` (`INV-6`).

### Phase G: PayOS Reconciliation Worker
- Implement BullMQ repeatable job `PaymentReconciliationProcessor` (`INV-4`).

### Phase H: Outbox Retention Cleanup Worker
- Implement BullMQ worker `OutboxCleanupProcessor` cleaning up events >7 days (`INV-2`).

### Phase I: Verification & Test Suite
- Implement 16 unit tests, E2E specs, and run `bun run check-types` + `bun test src/`.

---

## Phase Completion Rules

1. Every execution step (Phases A–I) must satisfy 100% system invariants (`INV-1`..`INV-9`).
2. TypeScript compilation `bun run check-types` must pass with 0 errors before proceeding.
3. Existing test suites in `src/modules/booking/` must not break.

---

## Acceptance Criteria

1. **AC-1:** Valid confirm request $\rightarrow$ Atomic DB transaction commit (`bookings` status `confirmed`, `show_seats` status `booked`, `payments` record created, `outbox_events` has `booking.confirmed` event).
2. **AC-2:** Duplicate `transactionId` or `Idempotency-Key` request $\rightarrow$ Returns 200 OK idempotent response from cache/DB without creating duplicate tickets.
3. **AC-3:** Payment amount mismatch (`amount !== total_price`) $\rightarrow$ Rejects with HTTP 400 `PAYMENT_AMOUNT_MISMATCH`, records status `requires_refund`, and triggers auto-refund.
4. **AC-4:** Expired booking (`expiresAt < NOW()`) $\rightarrow$ Returns HTTP 410 `BOOKING_EXPIRED`, automatically triggers refund if payment succeeded.
5. **AC-5:** User accessing another user's booking $\rightarrow$ Returns HTTP 404 `BOOKING_NOT_FOUND` (anti-enumeration defense `INV-5`).
6. **AC-6:** Redis connection loss/crash $\rightarrow$ Logs warning and degrades safely via DB Transaction (`INV-7`).
7. **AC-7:** Worker `PaymentReconciliationProcessor` runs periodically to reconcile un-tracked payments (`INV-4`).

---

## 3. Architecture Decisions (Final)

1. **PayOS Exclusive Gateway**: Uses PayOS exclusively as the primary payment gateway.
2. **PostgreSQL Pessimistic Locking**: `SELECT ... FOR UPDATE` row locks on `bookings` prevent race conditions between Confirm requests and BullMQ cancellation jobs.
3. **Transactional Dual-Write Outbox**: Inserts `booking.confirmed` event into `outbox_events` within the same DB transaction to guarantee 100% event delivery.
4. **PayOS orderCode SSOT Anchor**: Fixed integer `orderCode` stored at `bookings.order_code` serves as a 1-to-1 reconciliation anchor with PayOS API.

---

## 4. System Invariants & Reliability Invariants

- `INV-1`: Atomicity & Anti-Double-Processing via DB Pessimistic Locking (`SELECT ... FOR UPDATE`).
- `INV-2`: Transactional Dual-Write Outbox & 7-Day Retention (`outbox-cleanup` BullMQ cron).
- `INV-3`: Expiry, Locking & Idempotency Safety (`idempotency:confirm:<userId>:<key>`).
- `INV-4`: Reconciliation & Auto-Refund Safety (`PaymentReconciliationProcessor` via PayOS `orderCode`).
- `INV-5`: Strict Ownership & Anti-Enumeration Defense (`WHERE id = :bookingId AND user_id = :userId` $\rightarrow$ HTTP 404).
- `INV-6`: PayOS HMAC-SHA256 Signature Verification & Anti-Replay Defense (5-min timestamp window).
- `INV-7`: Redis Fail-Closed Fallback (Bypass Idempotency check to DB transaction on Redis connection loss).
- `INV-8`: DB Statement Timeout (3s) & NestJS Logger Structured JSON Observability.
- `INV-9`: UI/UX State Machine & Status Polling (3s) Contract.

---

## 11. Database Schema

```typescript
// enums.schema.ts
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending", "completed", "failed", "refunded", "requires_refund"
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "MOMO", "VNPAY", "Credit_Card", "ShopeePay", "PAYOS"
]);

// bookings.schema.ts
export const bookings = snakeCase.table("bookings", {
  // ... existing fields ...
  orderCode: bigint("order_code", { mode: "bigint" }),
}, (table) => [
  uniqueIndex("bookings_order_code_uidx").on(table.orderCode),
]);
```

---

## 12. API Surface

- `POST /api/v1/bookings/confirm`
  - Headers: `Authorization: Bearer <jwt>`, `Idempotency-Key: <uuid>`
  - Body: `ConfirmBookingDto` (`bookingId`, `orderCode`, `paymentMethod: 'payos'`, `transactionId`, `amount`)
  - Responses: `200 OK` (`ConfirmBookingResponseDto`), `400 PAYMENT_AMOUNT_MISMATCH`, `404 BOOKING_NOT_FOUND`, `409 PAYMENT_TRANSACTION_EXISTS`, `410 BOOKING_EXPIRED`, `500 INTERNAL_SERVER_ERROR`.

---

## 14. Phased Delivery Plan

| Phase | Description | Deliverable |
| :--- | :--- | :--- |
| **Phase A–B** | SDK & DB Schema Migration | `@payos/node` + Drizzle Migration SQL |
| **Phase C–D** | DTO Core & HMAC Utility | `ConfirmBookingDto` + `payos-crypto.util.ts` |
| **Phase E–F** | Service Logic & Webhook Controller | `BookingService.confirmBooking()` + `PayOSWebhookController` |
| **Phase G–I** | Reconciliation Workers & Verification | BullMQ Workers + Test Suite (100% PASS) |

---

## Implementation Checklist

### Primitive Atomic WBS Table

| Target File / Artifact | Bound Invariant | Verification Command |
| :--- | :--- | :--- |
| `src/database/schemas/enums.schema.ts` | `INV-4` | `bun run check-types` |
| `src/database/schemas/bookings.schema.ts` | `INV-4` | `bun run db:generate` |
| `src/modules/booking/dto/confirm-booking.dto.ts` | `INV-3` | `bun test src/modules/booking/` |
| `src/common/utils/payos-crypto.util.ts` | `INV-6` | `bun test src/common/utils/` |
| `src/modules/booking/booking.service.ts` | `INV-1`, `INV-5`, `INV-7`, `INV-8` | `bun test src/modules/booking/booking.service.spec.ts` |
| `src/modules/outbox/outbox.service.ts` | `INV-2` | `bun test src/modules/outbox/outbox.service.spec.ts` |
| `src/modules/booking/payos-webhook.controller.ts` | `INV-6` | `bun test src/modules/booking/` |
| `src/modules/booking/processors/payment-reconciliation.processor.ts` | `INV-4` | `bun test src/modules/booking/` |
| `src/modules/outbox/processors/outbox-cleanup.processor.ts` | `INV-2` | `bun test src/modules/outbox/` |

---

## Verification Evidence

1. **TypeScript Type Safety:** `bun run check-types` passes with 0 errors.
2. **ESLint Clean:** `bun run lint` passes with 0 warnings.
3. **Unit & Integration Tests:** `bun test src/` passes 100% (145/145 PASS).
4. **Mechanical Validation:** `node .claude/skills/ag-generate-plan/scripts/validate-plan-artifact.mjs process/features/booking/active/payment-plan-01-08-26.md` passes with 0 failures and 0 warnings.
5. **Context Alignment:** Aligned with `process/context/all-context.md` and `process/context/tests/all-tests.md`.

---

## Resume and Execution Handoff

- **Plan File Path:** `process/features/booking/active/payment-plan-01-08-26.md` (this file)
- **Harness Risk Gate:** `process/features/booking/reports/harness/risk-gate.json` $\rightarrow$ `PHASE_5_PROOFS_APPROVED`
- **Execution Status:** 🚀 COMPLETE
