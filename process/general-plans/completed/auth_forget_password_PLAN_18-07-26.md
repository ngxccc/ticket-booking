# Password Reset (Forgot Password) Flow Integration - Plan

**Date**: 18-07-26  
**Complexity**: Simple  
**Status**: ✅ COMPLETED

## Overview

This plan details implementing the Forgot Password and Reset Password authentication flow. It includes adding dedicated database columns to the `users` table, implementing rate limiting, sending password reset emails using the Transactional Outbox Pattern + BullMQ + Resend SDK, and establishing a periodic cleanup job to purge expired and revoked refresh tokens to mitigate database accumulation risks.

For core patterns, environment setups, and coding conventions, refer to the authoritative repository router: [process/context/all-context.md](process/context/all-context.md).

## Quick Links

- [Touchpoints & Public Contracts](#touchpoints)
- [Assumptions and Constraints](#assumptions-and-constraints)
- [Acceptance Criteria](#acceptance-criteria)
- [Phase Completion Rules](#phase-completion-rules)
- [Implementation Checklist](#implementation-checklist)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)

---

## Touchpoints

### Database Touchpoints

- Table: `users`
  - Add column: `resetPasswordToken: varchar(255)` (unique index)
  - Add column: `resetPasswordExpiresAt: timestamp` (partial index filtered by `resetPasswordToken IS NOT NULL`)
- Table: `refresh_tokens`
  - Bulk delete where `userId = user.id` during reset to force-logout all active sessions.
- Table: `outbox_events`
  - Insert event: `auth.reset_password_email_requested`

## Public Contracts

1. **Forgot Password Request (`POST /auth/forgot-password`)**:
   - Request Body: `ForgotPasswordDto` (`email`)
   - Success Response:

     ```json
     {
       "success": true,
       "data": null
     }
     ```

   - _Note_: Always returns a generic success response to prevent User Enumeration attacks.

2. **Reset Password Execute (`POST /auth/reset-password`)**:
   - Request Body: `ResetPasswordDto` (`token`, `password`, `confirmPassword`)
   - Success Response:

     ```json
     {
       "success": true,
       "data": null
     }
     ```

## Blast Radius

- Modifies auth schemas at `src/database/schemas/auth.schema.ts` (triggers schema migration).
- Modifies `AuthController`, `AuthService`, `auth.routes.ts`.
- Modifies `event.constant.ts` to declare `AUTH_RESET_PASSWORD_EMAIL_REQUESTED`.
- Modifies `OutboxService` to dispatch `AUTH_RESET_PASSWORD_EMAIL_REQUESTED` to BullMQ.
- Modifies `MailProcessor` and `MailService` to implement `sendPasswordResetEmail`.
- Adds `TokenCleanupService` to periodically purge expired refresh tokens.

---

## Assumptions and Constraints

- **Zero plain text leaks**: Under no circumstances should `password` or `token` inputs be leaked in error responses or logs.
- **Selective Projections**: Drizzle queries must selectively project columns (e.g. `select({ id: users.id, status: users.status })`) rather than using `.select()` wildcard, following YAGNI selection principles.
- **Prevent User Enumeration**: The forgot-password endpoint must not throw an error if the email does not exist; instead, return a generic success message.
- **Cleanup Interval Lifecycle**: Custom `TokenCleanupService` must implement `OnApplicationShutdown` and clear the interval timer to avoid hanging handles during graceful shutdown.

---

## Acceptance Criteria

1. ✅ The application compiles with type safety (`bun run check-types` runs successfully).
2. ✅ All unit and E2E tests pass cleanly (`bun test` and `bun run test:e2e`).
3. ✅ Database migration is successfully generated and applied with correct index settings.
4. ✅ `POST /auth/forgot-password` verifies email existence using minimal projection (`id, status, fullName`) and creates transactional outbox event.
5. ✅ `POST /auth/reset-password` validates token, checks expiry, hashes password using `scrypt`, and invalidates all existing sessions (deletes refresh tokens).
6. ✅ `TokenCleanupService` automatically purges expired refresh tokens every 24 hours (or configurable period).
7. ✅ Graceful shutdown runs without memory leaks or dangling timers.

Refer to the testing quickstart for details: [process/context/tests/all-tests.md](process/context/tests/all-tests.md)
---

## Phase Completion Rules

- **Phase 1 (Schema & Migration)**: Complete when columns are added, migration generated via Drizzle Kit, and database is migrated.
- **Phase 2 (Logic & Outbox)**: Complete when Forgot Password API and Outbox event registration are implemented.
- **Phase 3 (Email & Queue Processor)**: Complete when BullMQ handler and MailService send reset links correctly.
- **Phase 4 (Reset Password API)**: Complete when Reset Password API validates token, rotates password, and invalidates active refresh tokens.
- **Phase 5 (Cleanup Job)**: Complete when `TokenCleanupService` interval worker is developed with shutdown hook.
- **Phase 6 (Verification)**: Complete when unit tests, integration tests, and type-checks pass.

---

## Implementation Checklist

### Phase 1: Schema & Migration

- [x] Add `resetPasswordToken` and `resetPasswordExpiresAt` to `users` in `src/database/schemas/auth.schema.ts`.
- [x] Configure `users_reset_password_token_uidx` (Unique) and `users_reset_password_expires_at_idx` (Partial index).
- [x] Run `bun run db:generate` to generate migration files.
- [x] Run `bun run db:migrate` to apply the migrations to PostgreSQL.

### Phase 2: Logic & Outbox

- [x] Add `ForgotPasswordDto` inside `src/modules/auth/dto/`.
- [x] Add `forgot-password` route path in `src/modules/auth/auth.routes.ts`.
- [x] Declare `AUTH_RESET_PASSWORD_EMAIL_REQUESTED` event in `src/common/constants/event.constant.ts`.
- [x] Implement `forgotPassword(dto)` in `AuthService` with minimal SELECT (`id, status, fullName`), secure token generation, and database transaction outbox write.
- [x] Bind `/auth/forgot-password` endpoint in `AuthController` with rate limiter (3 req/min).

### Phase 3: Email & Queue Processor

- [x] Update `OutboxService` dispatch case to forward the reset password event to the `mail` queue with job type `send-reset-password`.
- [x] Update `MailService` to implement `sendPasswordResetEmail(email, fullName, token)` utilizing Resend API and `env.FRONTEND_URL`.
- [x] Update `MailProcessor` to process `send-reset-password` job and call `MailService.sendPasswordResetEmail`.

### Phase 4: Reset Password API

- [x] Add `ResetPasswordDto` inside `src/modules/auth/dto/`.
- [x] Add `reset-password` route path in `src/modules/auth/auth.routes.ts`.
- [x] Implement `resetPassword(dto)` in `AuthService` (SELECT only `id, resetPasswordExpiresAt`, check expiry, scrypt hash password, clear reset fields, and delete active refresh tokens of the user).
- [x] Bind `/auth/reset-password` endpoint in `AuthController` with rate limiter (5 req/min).

### Phase 5: Cleanup Job

- [x] Create `TokenCleanupService` implementing `OnApplicationBootstrap` and `OnApplicationShutdown` in `src/modules/auth/token-cleanup.service.ts`.
- [x] Implement query `DELETE FROM refresh_tokens WHERE expires_at < NOW()`.
- [x] Schedule `setInterval` (every 24 hours) in `onApplicationBootstrap()` and call `clearInterval()` in `onApplicationShutdown()`.
- [x] Register `TokenCleanupService` in `AuthModule` providers.

### Phase 6: Verification

- [x] Write integration and unit tests for `forgot-password` and `reset-password` APIs (valid token, expired token, mismatch pass, user enumeration check).
- [x] Write unit test for `TokenCleanupService` to verify database purging runs correctly.
- [x] Check type safety (`bun run check-types`) and linting (`bun run lint`).

---

## Verification Evidence

### Test Run Output
All 56 unit tests passed successfully:
```bash
Ran 56 tests across 8 files. [1023.00ms]
```

### TypeScript & Linting Validation
```bash
$ tsc --noEmit
# Completed successfully with no compiler errors
$ eslint . --fix --cache --cache-location .eslintcache
# Passed with no warnings or errors
```

---

## Resume and Execution Handoff

The implementation, verification, and local tests are 100% complete and validated.

**Next Step:** Move the completed plan to `process/general-plans/completed/` and enter UPDATE PROCESS mode to document learnings.
