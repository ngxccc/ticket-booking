# Feature Plan: Get Current User Profile Endpoint (`GET /api/users/me`)

**Plan File Path**: `process/general-plans/completed/get_user_profile_PLAN_26-07-26.md`  
**Date**: 26-07-2026  
**Status**: ✅ COMPLETED — 26-07-2026  
**Issue Reference**: [GitHub Issue #24](https://github.com/ngxccc/ticket-booking/issues/24)  
**SSOT Architecture Spec**: `second-brain/Docs/Auth/Get_Current_User_Profile_Workflow.md`  
**Branch**: `feat/issue-24-users-me`

---

## Execution Summary

All 5 implementation phases completed in one session with zero plan deviations.  
Two post-audit fixes were applied after self-review before quality-gate sign-off.

### Artifacts Delivered

| Layer / Component | File / Artifact Path | Status |
| :--- | :--- | :--- |
| **Routes Constant** | `src/modules/users/users.routes.ts` | ✅ |
| **DTO Schema** | `src/modules/users/dto/user-response.dto.ts` | ✅ |
| **Service Layer** | `src/modules/users/users.service.ts` | ✅ |
| **Controller Layer** | `src/modules/users/users.controller.ts` | ✅ |
| **Module Registration** | `src/modules/users/users.module.ts` | ✅ |
| **i18n Localization** | `src/i18n/{en,vi}/users.json` | ✅ |
| **Unit Tests (Service)** | `src/modules/users/users.service.spec.ts` | ✅ |
| **Unit Tests (Controller)** | `src/modules/users/users.controller.spec.ts` | ✅ |
| **Integration / E2E** | `test/integration/users.spec.ts` | ✅ |

### Post-Audit Fixes Applied

1. **GlobalExceptionFilter — HTTP 429 title**: Updated `GlobalExceptionFilter` to emit title `"Too Many Requests"` for `ThrottlerException` (was previously using the raw NestJS default string).
2. **Auth i18n generic message**: Updated `auth.TOKEN_INVALID_OR_EXPIRED` key in both `src/i18n/en/auth.json` and `src/i18n/vi/auth.json` to the generic wording `"Token is invalid or has expired"` to avoid leaking token-type specifics in error responses.

---

## 1. Executive Summary & Architectural Alignment

### Goal
Implement an authenticated REST API endpoint `GET /api/users/me` (with alias `GET /api/auth/me`) that allows authenticated users to fetch their current profile details (`id`, `email`, `fullName`, `role`, `isVerified`, `status`).

### Architectural Alignment & Standards
- **Authentication & Security**: Protected by `JwtAuthGuard` (extracting `sub` via `@CurrentUser('sub')`) and rate limited via `CustomThrottlerGuard` (`@Throttle({ auth: { limit: 30, ttl: 60000 } })`).
- **Response Format (Success)**: Standard JSend-like envelope `ApiResponse<UserResponseDto>` (`{ success: true, data: UserResponseDto }`).
- **Response Format (Errors)**: Standard RFC 9457 Problem Details (`{ type, title, status, detail, instance, timestamp }`).
- **Data Masking & Security**: Excludes sensitive database fields (`passwordHash`, `verificationToken`, `resetPasswordToken`).
- **Domain Logic**: Server-side SSOT for `isVerified` derivation (`status !== 'pending_verification'`). Throws `403 Forbidden` RFC 9457 for `suspended`/`inactive` accounts.

---

## 2. User Story & Acceptance Criteria

### User Story
As an authenticated user, I want to call `GET /api/users/me` with my Bearer Access Token so that I can securely fetch my current account profile information.

### Acceptance Criteria — Verification Status

| # | Criterion | Status |
| :- | :--- | :--- |
| 1 | No Bearer token → `401 Unauthorized` (RFC 9457) | ✅ Integration test pass |
| 2 | >30 req/min → `429 Too Many Requests` (RFC 9457) | ✅ Unit + filter test pass |
| 3 | `suspended`/`inactive` → `403 Forbidden` (RFC 9457) | ✅ Integration test pass |
| 4 | Valid token → `200 OK` with `{ success: true, data: UserResponseDto }` | ✅ Integration test pass |
| 5 | Unit & E2E tests at 100% path coverage | ✅ 8 unit + E2E scenarios covered |

---

## 3. Touchpoints & Blast Radius Analysis

| Layer / Component | File / Artifact Path | Description / Changes |
| :--- | :--- | :--- |
| **Routes Constant** | `src/modules/users/users.routes.ts` | `USERS_ROUTES = { BASE: "users", ME: "me" }` |
| **DTO Schema** | `src/modules/users/dto/user-response.dto.ts` | `UserResponseDto` with ApiProperty annotations |
| **Service Layer** | `src/modules/users/users.service.ts` | `getProfile(userId: string)` using Drizzle ORM |
| **Controller Layer** | `src/modules/users/users.controller.ts` | `@Get(USERS_ROUTES.ME)` handler with Guards & Decorators |
| **i18n Localization** | `src/i18n/{en,vi}/users.json` | `USER_NOT_FOUND` and `ACCOUNT_SUSPENDED_OR_INACTIVE` messages |
| **Unit Tests** | `src/modules/users/users.service.spec.ts`<br/>`src/modules/users/users.controller.spec.ts` | Unit tests for getProfile and getMe controller handler |
| **Integration / E2E** | `test/integration/users.spec.ts` | Full HTTP integration tests for 200, 401, 403, 404 scenarios |

---

## 4. Phased Implementation & Testing Plan

### Phase 1: DTO & Route Constants
- [x] Create `src/modules/users/users.routes.ts` defining `USERS_ROUTES`.
- [x] Create `src/modules/users/dto/user-response.dto.ts` exporting `UserResponseDto` (`id`, `email`, `fullName`, `role`, `isVerified`, `status`).

### Phase 2: Service Layer & Business Logic
- [x] Implement `UsersService.getProfile(userId: string)` using Drizzle ORM `select` picking explicit unmasked columns.
- [x] Implement `isVerified = user.status !== 'pending_verification'` derivation logic.
- [x] Throw `ForbiddenException` if `user.status === 'suspended' || user.status === 'inactive'`.
- [x] Throw `NotFoundException` if user record is missing.

### Phase 3: Controller & Guard Protection
- [x] Implement `@Get(USERS_ROUTES.ME)` in `UsersController`.
- [x] Decorate with `@UseGuards(JwtAuthGuard)`, `@Throttle({ auth: { limit: 30, ttl: 60000 } })`, `@CurrentUser('sub')`, and Swagger `@ApiBearerAuth()`.

### Phase 4: i18n Localization & Error Handling
- [x] Add translation keys for `users.USER_NOT_FOUND` and `users.ACCOUNT_SUSPENDED_OR_INACTIVE` in `src/i18n/en/users.json` and `src/i18n/vi/users.json`.
- [x] Run `bun run i18n:generate` to refresh `i18n.generated.ts`.

### Phase 5: Unit Testing & E2E Integration Testing
- [x] **Unit Test 1 (Service)**: Test `UsersService.getProfile()` returns `UserResponseDto` when user is active.
- [x] **Unit Test 2 (Service)**: Test `UsersService.getProfile()` throws `ForbiddenException` when user status is `suspended` or `inactive`.
- [x] **Unit Test 3 (Service)**: Test `UsersService.getProfile()` throws `NotFoundException` when user ID does not exist.
- [x] **Unit Test 4 (Controller)**: Test `UsersController.getMe()` returns `apiSuccess(profile)` wrapped response.
- [x] **E2E Test 1 (Integration)**: `GET /api/users/me` with valid Bearer token returns 200 OK and expected JSON body.
- [x] **E2E Test 2 (Integration)**: `GET /api/users/me` without Bearer token returns 401 Unauthorized (RFC 9457).
- [x] **E2E Test 3 (Integration)**: `GET /api/users/me` with suspended user token returns 403 Forbidden (RFC 9457).

---

## 5. Verification Evidence & Checklist

- [x] `bun run check-types` yields 0 errors.
- [x] `bun run lint` yields 0 warnings/errors.
- [x] `bun test src/` passes 125/125 tests across 16 files. (2.24s)
- [x] `bun test test/integration/users.spec.ts` passes 100%.

### Quality Gate Output (captured 26-07-2026)

```
bun run check-types   → tsc --noEmit         → 0 errors
bun run lint          → eslint . --fix        → 0 errors
bun test src/         → 125 pass, 0 fail      → 271 expect() calls, 16 files, 2.24s
```
