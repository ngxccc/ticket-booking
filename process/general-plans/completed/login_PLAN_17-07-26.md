# JWT Login and Token Refresh Integration - Plan

**Date**: 17-07-26  
**Complexity**: Simple  
**Status**: ✅ COMPLETED

## Overview

This plan details transitioning the stubbed Authentication API (Login and Token Refresh endpoints) into a production-ready, database-backed flow using stateless JWT access tokens and database-persisted refresh tokens with token rotation.

For core patterns, environment setups, and coding conventions, refer to the authoritative repository router: [process/context/all-context.md](process/context/all-context.md).

## Quick Links
- [Touchpoints & Public Contracts](#touchpoints--public-contracts)
- [Assumptions and Constraints](#assumptions-and-constraints)
- [Acceptance Criteria](#acceptance-criteria)
- [Phase Completion Rules](#phase-completion-rules)
- [Implementation Checklist](#implementation-checklist)
- [Verification Evidence](#verification-evidence)
- [Resume and Execution Handoff](#resume-and-execution-handoff)

---

## Touchpoints

### Database Touchpoints
- Table: `users` (select fields: `id`, `email`, `fullName`, `role`, `status`, `passwordHash`)
- Table: `refresh_tokens` (insert/delete fields: `id`, `userId`, `tokenHash`, `expiresAt`, `isRevoked`)

## Public Contracts

### Public API Contracts

1. **Login API (`POST /auth/login`)**:
   - Request Body: `LoginDto` (`email`, `password`)
   - Success Response:
     ```json
     {
       "success": true,
       "data": {
         "accessToken": "string (JWT)",
         "refreshToken": "string (64-char hex)",
         "user": {
           "id": "string (UUID)",
           "email": "string",
           "fullName": "string",
           "role": "string"
         }
       }
     }
     ```

2. **Refresh Token API (`POST /auth/refresh`)**:
   - Request Body: `RefreshTokenDto` (`refreshToken`)
   - Success Response:
     ```json
     {
       "success": true,
       "data": {
         "accessToken": "string (JWT)",
         "refreshToken": "string (64-char hex)"
       }
     }
     ```

## Blast Radius
- Impacts `AuthController` and `AuthService` login and refresh token endpoints.
- Modifies `test/mocks/database.mock.ts` mock utility structure.
- Registers global `JwtModule` in `AuthModule`.

---
## Assumptions and Constraints
- **Zero plain text leaks**: Under no circumstances should `value` or `target` properties containing user secrets be returned in validation or authentication errors.
- **Drizzle ORM Best Practices**: Always selectively project columns (`select({ id: ... })`) instead of using `.select()` without arguments, following YAGNI selection principles.
- **Optional Chaining**: Prefer `user?.status !== 'active'` over `!user || user.status !== 'active'` to comply with repository rules.

---

## Acceptance Criteria

1. ✅ The application compiles with type safety (`bun run check-types` runs successfully).
2. ✅ All 46 unit tests and 10 E2E tests pass cleanly (`bun test` and `bun run test:e2e` run successfully).
3. ✅ Credentials login correctly verifies password hashes using `comparePassword`.
4. ✅ Validation errors do not leak plaintext password inputs or internal payload structures.
5. ✅ Refresh token validation, deletion, and rotation work correctly.
6. ✅ Newman scenario collections execute and pass successfully.

Refer to the testing quickstart for details: [process/context/tests/all-tests.md](process/context/tests/all-tests.md).

---

## Phase Completion Rules
- **Phase 1 (Setup)**: Complete when `@nestjs/jwt` is installed and environment configurations are added.
- **Phase 2 (Utilities)**: Complete when cryptographic and date parsing functions are isolated to common utility files.
- **Phase 3 (Translations)**: Complete when translation keys and type definitions are generated.
- **Phase 4 (Logic & Persist)**: Complete when login/refresh endpoints are secure, database-backed, and use selective projections.
- **Phase 5 (Verification)**: Complete when unit tests, type-checks, and Newman scenarios pass.

---

## Implementation Checklist

### Phase 1: Setup
- [x] Install `@nestjs/jwt` dependency.
- [x] Add `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`, and `JWT_REFRESH_EXPIRES_IN` in `src/env.ts`.

### Phase 2: Utilities
- [x] Add pure `sha256` hashing function to `src/common/utils/crypto.util.ts`.
- [x] Create reusable duration parser and date offset helpers in `src/common/utils/date.util.ts`.

### Phase 3: Translations
- [x] Add `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, and `TOKEN_INVALID_OR_EXPIRED` to english and vietnamese translations.
- [x] Regenerate translation TypeScript types (`bun run i18n:generate`).

### Phase 4: Logic & Database Persistence
- [x] Register `JwtModule` in `AuthModule` with environment secrets.
- [x] Implement credentials checking, password comparison, and JWT generation in `AuthService.login`.
- [x] Implement refresh token verification, deletion, and rotation in `AuthService.refreshToken`.
- [x] Refactor Drizzle select queries to explicitly project columns mapping to DTOs.
- [x] Automate environment variables capture in Postman API Collection JSON test scripts.

### Phase 5: Verification
- [x] Write comprehensive unit tests for login and refresh token success and failure flows.
- [x] Run linting (`bun run lint`) and resolve warning/optional chaining errors.
- [x] Verify type safety and all project-wide tests pass successfully.

---

## Verification Evidence

### Test Run Output
All 46 unit tests and 10 E2E tests are successfully validated:
```bash
Ran 46 tests across 7 files. [1065.00ms]
Ran 10 tests across 1 file. [203.00ms]
```

### TypeScript Validation
```bash
$ tsc --noEmit
# Completed successfully without warnings or type errors
```

---

## Resume and Execution Handoff

The implementation, refactoring, and local tests are 100% complete and validated.

**Next Step:** Commit all staged and unstaged changes to Git.
