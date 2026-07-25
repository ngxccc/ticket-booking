# Implementation Plan: Revoke All User Sessions Endpoint (POST /api/auth/logout-all)

Date: 25-07-26  
Complexity: Simple  
Status: ✅ VERIFIED

## Overview
This plan defines the end-to-end implementation for `POST /api/auth/logout-all` (GitHub Issue #23). The endpoint allows an authenticated user to bulk revoke all active refresh token sessions across all devices and browsers by executing an atomic cascade deletion (`DELETE FROM refresh_tokens WHERE user_id = :userId`) in PostgreSQL using Drizzle ORM.

This plan aligns with `process/context/all-context.md` and `process/context/tests/all-tests.md`.

## Quick Links
- [Design Specification](#design-specification)
- [Phase Completion Rules](#phase-completion-rules)
- [Execution Brief](#execution-brief)
- [Functional Requirements](#functional-requirements)
- [Implementation Checklist](#implementation-checklist)
- [Touchpoints](#touchpoints)
- [Public Contracts](#public-contracts)
- [Blast Radius](#blast-radius)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)

---

## Design Specification

### 1. Architectural Alignment
The `logout-all` feature belongs to `src/modules/auth`. It leverages NestJS dependency injection, `JwtAuthGuard` for Bearer token validation, `@CurrentUser("sub")` decorator for secure user ID extraction, and Drizzle ORM for bulk relational database mutation.

### 2. HTTP API Contract
- **Endpoint**: `POST /api/auth/logout-all`
- **Headers**: `Authorization: Bearer <AccessToken>`
- **Security**: Protected by `JwtAuthGuard` (`@ApiBearerAuth()`)
- **Request Body**: None (Empty)
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "data": null,
    "timestamp": "2026-07-25T00:00:00.000Z"
  }
  ```
- **Error Response (401 Unauthorized)**: RFC 9457 Problem Details (`ApiUnauthorizedResponseRfc9457`).

### 3. Service & Database Operation
```typescript
// AuthService method
async logoutAll(userId: string): Promise<ApiResponse<null>> {
  await this.db
    .delete(refreshTokens)
    .where(eq(refreshTokens.userId, userId));

  return apiSuccess(null);
}
```

### 4. Defense-in-Depth Security Controls
1. **Rate Limiting**: Protected by `@UseGuards(CustomThrottlerGuard)` at the Controller layer.
2. **Access Token Authentication**: Handled via `JwtAuthGuard`. Invalid or expired access tokens fail fast with 401 Unauthorized before business logic execution.
3. **Strict User Identity Isolation**: `userId` is supplied directly from the cryptographically verified JWT payload (`sub`), preventing any cross-tenant or multi-user session tampering.
4. **Session Cascade Purge**: Purges all rows matching `user_id` from `refresh_tokens`.

---

## Goals and Success Metrics
- Provide a reliable, secure mechanism for users to log out from all devices simultaneously.
- 100% test coverage for `logoutAll` controller and service methods (unit & integration).
- E2E Integration test in `test/integration/auth.spec.ts` verifying all refresh tokens for a user are deleted upon `logout-all`.
- Postman Collection (`postman_collection.json`) updated with `Logout All Sessions` request.
- 0 TypeScript compiler errors (`bun run check-types`) and 0 linter violations (`bun run lint`).

---

## Phase Completion Rules

A phase is NOT complete until:
1. **Integration Test** - Works with NestJS DI container, PostgreSQL DB, and supertest in `test/integration/auth.spec.ts`.
2. **Manual & Postman Test** - Validated via Postman request in `postman_collection.json`.
3. **Data Verification** - `refresh_tokens` rows for `user_id` verified deleted in PostgreSQL.
4. **Error Handling** - Missing/expired Authorization header returns HTTP 401.
5. **User Confirmation** - Tests pass and static analysis confirms 0 errors.

Status meanings:
- ⏳ PLANNED - Not started
- 🔨 CODE DONE - Written but not E2E tested
- 🧪 TESTING - Currently being tested
- ✅ VERIFIED - Tested AND confirmed working
- 🚧 BLOCKED - Has issues

---

## Execution Brief

### Implementation Steps
1. **Route Mapping & Service Method**: Add `LOGOUT_ALL: "logout-all"` to `AUTH_ROUTES` in `auth.routes.ts` and implement `logoutAll(userId: string)` in `auth.service.ts`.
   - *Test*: Run unit tests in `auth.service.spec.ts` per testing context (`process/context/tests/all-tests.md`).
   - *Verify*: Check DB mock call to `delete(refreshTokens)`.
2. **Controller Endpoint Integration**: Add `@Post(AUTH_ROUTES.LOGOUT_ALL)` to `auth.controller.ts` with `@UseGuards(JwtAuthGuard)`, `@CurrentUser("sub")`, `@ApiBearerAuth()`, and Swagger decorators.
   - *Test*: Run unit tests in `auth.controller.spec.ts` per testing context (`process/context/tests/all-tests.md`).
   - *Verify*: Verify HTTP 200 status code and `ApiResponse<null>` output format.
3. **E2E Integration Testing**: Add integration test in `test/integration/auth.spec.ts` testing `POST /api/auth/logout-all` against real test DB.
   - *Test*: Run `bun test test/integration/auth.spec.ts`.
   - *Verify*: Confirm multiple refresh tokens created for user are purged and subsequent refresh attempts fail.
4. **Postman Collection Update**: Add `Logout All Sessions` request to `postman_collection.json` under Auth folder.
   - *Verify*: Validate JSON syntax and test scripts.
5. **Full Suite & Post-Phase Testing Validation**: Run post-phase testing via `bun test`, `bun run check-types`, and `bun run lint`.
   - *Done when*: All tests pass with zero warnings or type errors.

---

## Scope

### In-Scope
- Adding `AUTH_ROUTES.LOGOUT_ALL` route constant.
- Adding `AuthService.logoutAll(userId: string)` method.
- Adding `@Post(AUTH_ROUTES.LOGOUT_ALL)` endpoint to `AuthController`.
- Unit tests for `AuthService` and `AuthController`.
- E2E / Integration tests for `logout-all` in `test/integration/auth.spec.ts`.
- Updating `postman_collection.json` with the new endpoint request.

### Out-of-Scope
- Frontend UI components or web screens.
- Revoking external OAuth provider tokens (e.g., Google/Facebook OAuth sessions).

---

## Functional Requirements
- `FR-1`: The system MUST expose `POST /api/auth/logout-all`.
- `FR-2`: The endpoint MUST require a valid Bearer JWT Access Token.
- `FR-3`: Upon successful invocation, the system MUST delete all refresh token rows from `refresh_tokens` table where `user_id` equals the authenticated user's ID (`sub`).
- `FR-4`: The endpoint MUST return HTTP 200 OK with `apiSuccess(null)`.

---

## Acceptance Criteria
- [ ] `AUTH_ROUTES.LOGOUT_ALL` exists in `src/modules/auth/auth.routes.ts`.
- [ ] `AuthService.logoutAll` executes Drizzle bulk delete on `refreshTokens` filtered by `userId`.
- [ ] `AuthController.logoutAll` is guarded by `JwtAuthGuard` and extracts user ID via `@CurrentUser("sub")`.
- [ ] Calling `POST /api/auth/logout-all` without a valid Bearer token returns 401 Unauthorized.
- [ ] Unit tests for `AuthService.logoutAll` and `AuthController.logoutAll` achieve 100% path coverage and pass.
- [ ] Integration test in `test/integration/auth.spec.ts` verifies all active sessions are revoked and passes.
- [ ] `postman_collection.json` contains `Logout All Sessions` request with 200 OK assertion test script.
- [ ] `bun run check-types` and `bun run lint` pass without errors.

---

## Implementation Checklist

- [ ] `[Route]` Add `LOGOUT_ALL: "logout-all"` to `AUTH_ROUTES` in `src/modules/auth/auth.routes.ts`.
- [ ] `[Service]` Implement `async logoutAll(userId: string): Promise<ApiResponse<null>>` in `src/modules/auth/auth.service.ts`.
- [ ] `[Controller]` Add `@Post(AUTH_ROUTES.LOGOUT_ALL)` handler in `src/modules/auth/auth.controller.ts`.
- [ ] `[Test-Service]` Write unit tests for `logoutAll` in `src/modules/auth/auth.service.spec.ts`.
- [ ] `[Test-Controller]` Write unit tests for `logoutAll` in `src/modules/auth/auth.controller.spec.ts`.
- [ ] `[Test-E2E]` Add integration test for `POST /api/auth/logout-all` in `test/integration/auth.spec.ts`.
- [ ] `[Postman]` Add `Logout All Sessions` request to `postman_collection.json`.
- [ ] `[Quality Gate]` Run `bun test` to confirm unit and integration tests pass.
- [ ] `[Type Check]` Run `bun run check-types` to verify type safety.
- [ ] `[Linter]` Run `bun run lint` to format and ensure code style compliance.

---

## Risks and Mitigations
- **Risk**: Deleting active sessions might disrupt active mobile/web apps for valid users.
- **Mitigation**: User intentionally triggers `logout-all` to clear lost/compromised sessions. Access Token remains valid until TTL expires (short-lived), while Refresh Tokens are immediately revoked.

---

## Touchpoints
- `src/modules/auth/auth.routes.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.spec.ts`
- `src/modules/auth/auth.controller.spec.ts`
- `test/integration/auth.spec.ts`
- `postman_collection.json`
- `process/context/all-context.md`
- `process/context/tests/all-tests.md`

---

## Public Contracts
- **Route**: `POST /api/auth/logout-all`
- **Auth Guard**: `JwtAuthGuard`
- **Response Format**: `ApiResponse<null>`

---

## Blast Radius
- Restricted to `src/modules/auth/`, `test/integration/auth.spec.ts`, and `postman_collection.json`. No database schema changes, migrations, or breaking changes to existing endpoints.

---

## Verification Evidence
- Unit test output from `bun test src/modules/auth/`
- Integration test output from `bun test test/integration/auth.spec.ts` per `process/context/tests/all-tests.md`
- TypeScript compiler output from `bun run check-types`
- Linter status from `bun run lint`

---

## Resume and Execution Handoff
To execute this plan:
1. Confirm plan status: `⏳ PLANNED`.
2. Transition to `ag-execute-agent` or prompt `ENTER EXECUTE MODE`.
3. Follow the implementation checklist sequentially.
4. Update plan status to `✅ VERIFIED` after quality gate validation.

---

## Cursor + RIPER-5 Guidance
- **RIPER-5 Phase**: PLAN -> PAUSE FOR EXECUTE APPROVAL.
- **Cursor Execution**: Load `logout_all_sessions_PLAN_25-07-26.md` into context when running EXECUTE phase.
