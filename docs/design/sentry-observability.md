---
title: "Sentry Observability, Error Tracking & Performance Monitoring Workflow"
docType: "infrastructure-workflow"
status: "approved"
date: 2026-08-29
author: "Team / Core Architecture"
version: "1.0.0"
---

# Sentry Observability, Error Tracking & Performance Monitoring Workflow

---

## 1. Overview & Context

In a high-throughput cinema ticket booking system, unhandled crashes, database connection timeouts, and background worker failures must be captured with actionable stack traces, user journey breadcrumbs, and correlated log identifiers without polluting APM quotas or alerting on expected domain race conditions (e.g. `409 Conflict`).

### Core Objectives

1. **Zero-Noise Error & Exception Filtering**: Capture 5xx server errors and unhandled runtime panics in Sentry while strictly filtering out standard 4xx client errors (`400`, `401`, `403`, `404`, `409`, `422`, `429`).
2. **PII Sanitization & Compliance**: Automatically mask credentials, tokens, cookies, and sensitive payload keys via `beforeSend` and `beforeBreadcrumb` hooks.
3. **Closed-Loop Traceability**: Return the Sentry `eventId` inside the client RFC 9457 JSON response for 500 errors, linked directly to Pino NDJSON `requestId` and `traceId`.
4. **Non-HTTP Background Worker Monitoring**: Capture Outbox relay worker and BullMQ queue dead-letter failures when retry attempts are exhausted.
5. **Database Query Observability**: Capture SQL query breadcrumbs via DrizzleLogger and track end-to-end query execution latency natively via Sentry OpenTelemetry APM Spans.
6. **Graceful Degradation**: Zero test disruption and zero local friction when `SENTRY_DSN` is empty.

---

## 2. Architecture

- **Sentry APM & Error Tracking**: Captures 5xx unhandled exceptions with sanitized stack traces and breadcrumbs while filtering routine 4xx client errors.
- **Distributed Tracing & Outbox Alerting**: Instruments database queries via OpenTelemetry spans and alerts on terminal background worker job failures.

---

## 3. Operational Flows

### A. HTTP 500 Server Crash & RFC 9457 Closed-Loop Traceability

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client (Frontend/Mobile)
    participant Route as Controller / Service
    participant DB as PostgreSQL / Drizzle
    participant Filter as GlobalExceptionFilter
    participant Sentry as Sentry Cloud APM
    participant Pino as Pino NDJSON Logger

    Client->>Route: POST /bookings/reserve (with X-Request-ID)
    Route->>DB: Execute Transaction
    DB-->>Route: DB Connection Drop / Fatal Exception
    Route->>Filter: Unhandled Exception
    Filter->>Sentry: captureException(err, { tags, extra, user })
    Sentry-->>Filter: Returns Sentry eventId ("9b1a8f...")
    Filter->>Pino: logger.error("Database Exception [08006]...", { eventId, requestId })
    Filter-->>Client: HTTP 500 Problem Details (Content-Type: application/problem+json)<br/>{ "type": "...", "status": 500, "eventId": "9b1a8f...", ... }
    Note over Client,Pino: Client reports eventId -> Support searches Sentry & Pino logs
```

---

### B. High-Concurrency 409 Conflict Zero-Noise Filtering

```mermaid
sequenceDiagram
    autonumber
    actor VU as Virtual User (Load Test / Customer)
    participant Redlock as RedlockService
    participant Filter as GlobalExceptionFilter
    participant Sentry as Sentry Cloud APM

    VU->>Redlock: Acquire Lock on Seat A1
    Redlock-->>Filter: Lock Already Held -> throw ConflictException (409)
    Filter->>Filter: Check status < 500 (Status: 409 Conflict)
    Filter->>Sentry: addBreadcrumb("POST /bookings/reserve [409] Conflict", level: "warning")
    Note over Filter,Sentry: ZERO Exception Alerts sent -> 0 Quota Consumed
    Filter-->>VU: HTTP 409 Conflict (RFC 9457 JSON)
```

---

### C. Background Outbox Relay Worker Dead-Letter Alerting

```mermaid
sequenceDiagram
    autonumber
    participant Worker as Outbox Relay Worker
    participant Queue as BullMQ Queue
    participant Sentry as Sentry Cloud APM
    participant Pino as Pino Logger

    loop Polling Pending Outbox Events
        Worker->>Queue: Dispatch Event (auth.verification_email_requested)
        alt Attempt 1 or 2 Failed
            Queue-->>Worker: Connection Error / Timeout
            Worker->>Pino: logger.error("Failed attempt 1/3...")
            Worker->>Sentry: addBreadcrumb("Outbox attempt 1 failed", level: "warning")
        else Attempt 3/3 Failed (Terminal Exhaustion)
            Queue-->>Worker: Fatal Error
            Worker->>Pino: logger.error("Failed attempt 3/3...")
            Worker->>Sentry: captureException(error, { tags: { eventId, eventType, deadLetter: true } })
            Note over Worker,Sentry: Sentry Alert triggered for Engineer Investigation
        end
    end
```

---

## 4. Module-Scoped Domain Invariants (`SentryObservabilityInvariants: INV-1..13`)

| Invariant ID | Name                                            | Architectural Boundary & Edge Case Prevented                                         | Enforcement Mechanism                                                                                          |
| :----------- | :---------------------------------------------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| **`INV-1`**  | **Zero-Noise Alert Integrity**                  | 409 Conflict/429 Throttling during load tests triggering false alarms                | `GlobalExceptionFilter` filters all status < 500, routing only to warning breadcrumbs.                         |
| **`INV-2`**  | **PII & Deep Cycle Protection Guard**           | Password, token, cookie leakage or circular object reference causing stack overflow  | `sanitizeSensitiveData` uses `Set<string>` blacklist and deep recursion with cycle safety.                     |
| **`INV-3`**  | **Closed-Loop Crash Traceability**              | Support unable to find Sentry crash logs from client RFC 9457 error response         | `GlobalExceptionFilter` attaches Sentry `eventId` directly into 500 JSON payload.                              |
| **`INV-4`**  | **Concurrency Fault Distinction Guard**         | DB connection drop/statement timeout (57014) masked as 409 instead of 5xx            | Strict mapping: only `23505`/`23P01` are 409; `57014` is 504 and all driver crashes trigger 500 Sentry alerts. |
| **`INV-5`**  | **Bounded Span Lifecycle Guard**                | Long-running transactions leaving unclosed OpenTelemetry/Sentry spans leaking memory | Deterministic span finish inside `finally` block of distributed locks and DB sessions.                         |
| **`INV-6`**  | **Worker Error Fingerprinting & Deduplication** | Outbox worker retry storm sending 10,000 duplicate Sentry alerts during Redis outage | Sentry exception capture triggers **only** on terminal exhaustion (`attempt >= 3`) with custom fingerprinting. |
| **`INV-7`**  | **Zero-Overhead Telemetry Bypassing**           | High-frequency Kubernetes `/health` probes (100 Hz) exhausting CPU & Tracing quota   | `tracesSampler` performs O(1) prefix check to immediately drop `/health`, `/metrics`, `/reference`.            |
| **`INV-8`**  | **Graceful Flush Timeout Ceiling**              | Fatal server shutdown exiting before asynchronous Sentry HTTPS buffers drain         | `SentryService.onApplicationShutdown` awaits `Sentry.flush(2000)` with a strict 2s ceiling.                    |
| **`INV-9`**  | **Fail-Safe Telemetry Isolation Guard**         | Exception inside Sentry SDK or SentryService crashing the NestJS HTTP error filter   | Sentry capture calls are wrapped defensively so telemetry failures never disrupt HTTP responses.               |
| **`INV-10`** | **Deterministic Release Signature Guard**       | Environment variable missing locally causing "undefined" release tracking tags       | Deterministic fallback: `package_name@version+commit` (or 'local').                                            |
| **`INV-11`** | **Bounded Breadcrumb Payload Size Guard**       | 10MB bulk insert query string causing V8 heap memory exhaustion in breadcrumbs       | SQL strings hard-truncated to 300 characters; parameter arrays record length only.                             |
| **`INV-12`** | **Cross-Tenant Context Isolation Guard**        | Request A's `userId` or `requestId` leaking into Request B's concurrent error report | User and request tags bound strictly to request scope via `Sentry.withScope`, never global scope.              |
| **`INV-13`** | **Memory Ceiling & Ring Buffer Guard**          | High-frequency loops pushing thousands of breadcrumbs into Node.js heap              | `maxBreadcrumbs` strictly capped at 50 with duplicate loop suppression in `beforeBreadcrumb`.                  |

---

## 5. Security & PII Defense-in-Depth

1. **Automatic Credential & Token Masking**:
   - All headers matching `authorization`, `cookie`, and `set-cookie` are automatically replaced with `[REDACTED]` prior to dispatching events to Sentry.
   - All request body and extra fields matching `password`, `confirmPassword`, `token`, `refreshToken`, `accessToken`, `checksumKey`, `apiKey`, and `clientSecret` are recursively redacted.
2. **Database Query Parameter Shielding**:
   - Drizzle ORM query breadcrumbs record only the SQL structure and parameter count (`paramCount: N`). Raw parameter values containing user emails, names, or passwords are never captured.
3. **Cross-Tenant Context Isolation**:
   - User identity (`userId`, `email`, `role`) and request ID tags are strictly bound to isolated execution scopes (`Sentry.withScope` / `AsyncLocalStorage`), preventing cross-tenant data leakage in high-concurrency event loops.

---

## 6. Verification & Test Checklist

- [ ] `SentryService` safely no-ops without error when `SENTRY_DSN` is empty.
- [ ] `GlobalExceptionFilter` captures 5xx errors and attaches `eventId` to response JSON.
- [ ] `GlobalExceptionFilter` suppresses 4xx exceptions from Sentry alerts while appending breadcrumbs.
- [ ] `LoggingInterceptor` attaches `requestId` and `user` context to Sentry scope.
- [ ] `RedlockService` appends `redlock` category breadcrumbs during acquisition and release.
- [ ] `OutboxService` triggers `captureException` only on terminal retry exhaustion (3/3).
- [ ] Unit and E2E test suites pass 100% with zero regressions.
