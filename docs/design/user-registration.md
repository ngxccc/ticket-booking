---
title: "Register User Existence & Creation Workflow Spec"
docType: "feature-workflow"
status: "implemented"
date: 2026-07-25
author: "Team / Core Architecture"
version: "1.0.0"
---

# Register User Existence & Creation Workflow Spec

---

## Overview & Context

This document describes the operational flow for user registration in the Ticket Booking system. The registration process validates email uniqueness, hashes passwords securely using Scrypt, and records an email verification event using the Transactional Outbox Pattern to eliminate the Dual-Write Problem.

---

## Architecture

- **User Registration Flow**: Validates email uniqueness, salts and hashes passwords via Scrypt.
- **Transactional Dual-Write Outbox**: Atomically inserts the new user and an outbox email verification event in a single transaction.

---

## Operational Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant CDN as CDN / WAF (Cloudflare)
    participant Controller as AuthController
    participant Service as AuthService
    participant DB as PostgreSQL (Drizzle)
    participant Outbox as OutboxService (Relay Worker)
    participant Queue as QueueService (BullMQ)
    participant Worker as MailProcessor (BullMQ Worker)

    Client->>CDN: POST /api/auth/register { email, ... }
    Note over CDN: IP Rate Limit Check (Volumetric DDoS)
    alt Request Valid
        CDN->>Controller: Forward Request
    else Rate Limited
        CDN-->>Client: HTTP 429 Too Many Requests
    end

    Note over Controller: 1. Validate & Sanitize DTO<br/>2. ThrottlerGuard Check (5 reqs/1 min)
    alt Throttled
        Controller-->>Client: HTTP 429 Too Many Requests
    else Valid Payload
        Controller->>Service: register(dto)
    end

    rect rgb(12, 66, 101)
        Note over Service, DB: User Existence & Transactional Outbox
        Service->>DB: Query SELECT id FROM users WHERE email = dto.email
        DB-->>Service: Query Result
        alt Email Exists
            Service-->>Controller: throw ConflictException (409)
            Controller-->>Client: HTTP 409 Conflict ("Email already exists")
        else Email Unique
            Service->>DB: DB Transaction: INSERT user & INSERT outbox_event
            DB-->>Service: Transaction Success
        end
    end

    Service-->>Controller: Return void
    Controller-->>Client: HTTP 201 Created

    loop Interval 5 seconds
        Outbox->>DB: SELECT * FROM outbox_events WHERE status = 'pending' LIMIT 10
        DB-->>Outbox: Pending events
        alt Pending Events Exist
            Outbox->>Queue: Push 'send-verification' job
            Outbox->>DB: UPDATE outbox_events SET status = 'processed'
        end
    end

    Queue->>Worker: Consume 'send-verification' job
    Worker->>Worker: Send email via Resend SDK
    Worker-->>Queue: Job Completed
```

---

## Technical Decisions & Implementation Details

- **Transactional Dual-Write Outbox**: User account creation and outbox verification email event `auth.verification_email_requested` are executed within a single database transaction.
- **Scrypt Password Hashing**: Hashing uses native `crypto.scrypt` with a cryptographically secure 16-byte salt per user.

---

## Security & Defense-in-Depth

- **Layer 1: CDN / Reverse Proxy**: Protects against global volumetric DDoS attacks.
- **Layer 2: Application Level Throttling**: Restricts attempts to 5 requests/minute per IP via `ThrottlerGuard` and Redis. Prevents **Account Pre-emption DoS** by refraining from hard-locking by email.
- **Layer 3: Progressive Friction**: Supports CAPTCHA verification and exponential backoff during detected spam bursts.
- **Password Protection**: Hashes passwords using `crypto.scrypt` with unique 16-byte random salts.

---

## Verification & Operational Checklist

- [x] Duplicate email registration returns HTTP 409 Conflict.
- [x] Successful registration inserts user record and `auth.verification_email_requested` outbox event atomically.
- [x] Unit and integration tests verify registration, outbox creation, and password hashing.
