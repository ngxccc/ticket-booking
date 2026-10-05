---
title: "Forget Password Workflow Spec"
docType: "feature-workflow"
status: "implemented"
date: 2026-07-17
author: "Team / Core Architecture"
version: "1.0.0"
---

# Forget Password Workflow Spec

---

## Overview & Context

This document describes the operational flow for password recovery when a user forgets their password. The system receives the user's email, generates a secure time-limited reset token (15-minute TTL), inserts an outbox event to dispatch an email via a BullMQ worker, and allows the user to reset their password safely.

---

## Architecture

- **Password Recovery Gateway**: Generates cryptographically secure, time-bounded reset tokens (15m TTL).
- **Transactional Outbox Eventing**: Emits `auth.reset_password_email_requested` events to BullMQ workers without dual-write race conditions.
- **Constant-Time User Enumeration Defense**: Returns consistent responses irrespective of account existence.

---

## Operational Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client / Mobile App
    participant Controller as AuthController
    participant Service as AuthService
    participant DB as PostgreSQL (Drizzle)
    participant Outbox as OutboxService

    Client->>Controller: POST /api/auth/forget-password { email }
    Controller->>Service: forgetPassword(email)
    Service->>DB: Query SELECT id FROM users WHERE email = email
    DB-->>Service: User Record
    alt User Exists
        Service->>Service: Generate Reset Token (15m TTL)
        Service->>DB: DB Transaction: UPDATE resetToken & INSERT outbox_event
        DB-->>Service: Transaction Success
    end
    Service-->>Controller: Return success true (User Enumeration Defense)
    Controller-->>Client: HTTP 200 OK
```

---

## Technical Decisions & Implementation Details

- **Transactional Dual-Write Outbox**: The reset token email event `auth.reset_password_email_requested` is written inside the same DB transaction as the reset token update, preventing email loss.
- **Constant-Time Response**: Returns HTTP 200 OK regardless of whether the email exists in the database.

---

## Security & Defense-in-Depth

- **User Enumeration Defense**: Always returns HTTP 200 OK even if the email does not exist in the system.
- **Short Token TTL**: Reset Tokens expire in 15 minutes to minimize attack windows.
- **Transactional Outbox**: Guarantees atomic insertion of `auth.reset_password_email_requested` in the same database transaction.

---

## Verification & Operational Checklist

- [x] Forget password request with unknown email returns HTTP 200 OK without sending email.
- [x] Reset token expires strictly after 15 minutes.
- [x] Unit tests verify outbox event generation and token invalidation after reset.
