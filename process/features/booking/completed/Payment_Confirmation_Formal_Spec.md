---
title: Formal Design Specification: Payment Confirmation & Ticket Issuance (Formal Spec)
docType: feature-spec
feature: booking
status: completed
date: 2026-07-31
tags: [type/spec, topic/booking, topic/payment, status/completed]
invariants: [INV-1, INV-2, INV-3, INV-4, INV-5, INV-6, INV-7, INV-8, INV-9]
---

# Formal Design Specification: Payment Confirmation & Ticket Issuance (Formal Spec)

## 1. TL;DR & Objectives (Isolation Boundaries)

### 1.1 Scope & Goal

This specification defines the processing engine for **Payment Confirmation & Ticket Issuance (`POST /api/v1/bookings/confirm`)** for the Standalone Cinema Ticket Booking App.

The system transitions a booking reservation from temporary hold (`pending_payment`) to confirmed (`confirmed`), records payment transaction details in `payments`, updates seat status (`reserved` $\rightarrow$ `booked`), and generates an asynchronous outbox event (`outbox_events`) for ticket issuance and email notification. The system guarantees **100% ACID Atomicity**, **Anti-Double Confirmation**, and **Zero Event Loss (Transactional Outbox Pattern)**.

### 1.2 Isolation Boundaries

- **In Scope:**
  - Payment confirmation & order status transition (`POST /api/v1/bookings/confirm`).
  - Recording transaction details into `payments` table with unique constraint `payments_transaction_id_uidx`.
  - Updating seat status from `reserved` to `booked` and clearing seat lock time (`lockedUntil = NULL`).
  - Inserting `booking.confirmed` event into `outbox_events` within the same PostgreSQL DB Transaction.
  - Removing 10-minute auto-cancellation delayed job (`cancel-booking-${bookingId}`) on BullMQ `booking` queue post-commit.
  - Caching 60s Idempotency response on Redis key `idempotency:confirm:<userId>:<key>`.
- **Out of Scope:**
  - Directly executing external third-party payment gateway SDK calls (handled by PayOS webhook gateway).
  - Rendering HTML templates and sending SMTP emails directly (handled asynchronously by `OutboxService` and `MailProcessor`).

---

## 2. System Invariants

Any code implementation for `POST /bookings/confirm` **MUST** adhere to the following system invariants:

| Invariant ID | Name | Detailed Rule |
| :--- | :--- | :--- |
| **INV-1** | Atomicity & Anti-Double-Processing via DB Pessimistic Locking | `SELECT ... FOR UPDATE` on `bookings` inside DB transaction |
| **INV-2** | Transactional Dual-Write Outbox | Event `booking.confirmed` inserted into `outbox_events` within same DB transaction |
| **INV-3** | Expiry, Locking & Idempotency Safety | Removes delayed job `cancel-booking-${bookingId}` post-commit |
| **INV-4** | Reconciliation & Auto-Refund Safety | `PaymentReconciliationProcessor` automatically reconciles and refunds mismatched payments |
| **INV-5** | Strict Ownership & Anti-Enumeration Defense | Validates `userId` matches `booking.userId` |
| **INV-6** | PayOS Signature Verification & Anti-Replay Defense | HMAC-SHA256 signature verification + 5 min timestamp window |
| **INV-7** | Redis Fail-Closed Fallback | Degrades safely to DB pessimistic lock if Redis drops connection |
| **INV-8** | DB Statement Timeout & Observability Guard | `SET LOCAL statement_timeout = 3000` inside DB transaction |
| **INV-9** | UI/UX State Machine & Status Polling Contract | Polling contract transitions UI state from PENDING to CONFIRMED |
