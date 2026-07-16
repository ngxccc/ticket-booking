# Chunk 5: Email Verification & Activation - Plan

**Date:** 14-07-26  
**Complexity:** Simple  
**Status:** ✅ COMPLETED

## Overview

Implement the email verification and activation flow (Chunk 5) for the Register User workflow. This involves:

1. Configuring BullMQ using existing Redis environment variables in `AppModule` and registering the `'mail'` queue.
2. Creating a `MailProcessor` to process email-sending background jobs.
3. Dispatching an email verification job containing the generated token in `AuthService.register`.
4. Implementing a `GET /auth/verify-email` endpoint that validates the token, checks for expiration, updates the user status to `active` (and clears the token), returning proper i18n messages.
5. Verification using Bun test unit tests.

## Goals

- Configure BullMQ server-wide and within `AuthModule`.
- Trigger background verification emails upon user registration.
- Provide a working verification endpoint with proper multilingual error handling and status updates.
- Achieve 100% test pass rate using Bun test.

---

## Execution Brief

### Phase 1: Configuration & Queue Set-up

- Import `BullModule` in `src/app.module.ts` using existing `env` Redis host/port.
- Create `src/modules/auth/processors/mail.processor.ts` to log/simulate verification emails.
- Register `mail` queue in `src/modules/auth/auth.module.ts` and add `MailProcessor` as a provider.

### Phase 2: AuthService Dispatch Integration

- Inject the `'mail'` queue into `AuthService`.
- Dispatch a job to `'mail'` queue at the end of `AuthService.register`.

### Phase 3: Verification Endpoint

- Add translation keys to `src/i18n/{vi,en}/auth.json`.
- Implement `verifyEmail(token: string)` in `AuthService`.
- Expose `GET /auth/verify-email` in `AuthController`.

### Phase 4: Verification (Tests)

- Update `auth.service.spec.ts` to mock the mail Queue and test `verifyEmail`.
- Run tests using `bun test`.

---

## Acceptance Criteria

- BullMQ connects to Redis without crashing the app.
- Registration dispatches a job to the `mail` queue.
- `GET /auth/verify-email?token=xxx` activates the user status, clears verification token fields in a single write, and returns a translated success message.
- Invalid or expired tokens throw a `400 BadRequestException` with translated error messages.
- All unit tests pass cleanly under Bun.
