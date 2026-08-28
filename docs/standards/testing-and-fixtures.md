# Testing & Fixture Standards

## 1. Integration Test Hierarchy & Naming Conventions

All test suites under `test/` MUST adhere to the standardized BDD hierarchical structure:

- **Level 1 (File Root / Domain Boundary)**: `describe("<Domain> Module Integration", () => { ... })`
- **Level 2 (Endpoint / Scope)**: Pure HTTP method and route only — `describe("<HTTP_METHOD> <route>", () => { ... })` (or `describe("Database Invariants: <Topic>", () => { ... })`). Never append custom parenthetical qualifiers or dashes to Level 2.
- **Level 2.5 (Context / Scenarios — Optional)**: When an endpoint encompasses multiple distinct sub-scenarios (authentication, validation, concurrency), group them using nested `describe("when <context/scenario>", () => { ... })`.
- **Level 3 (Test Case)**: `it("should <action and expected outcome> when <condition>", async () => { ... })`

```ts
describe("Booking Module Integration", () => {
  describe("POST /bookings/reserve", () => {
    describe("when validating request payload", () => {
      it("should return 400 Bad Request when showId is not a valid UUIDv7", async () => {
        // Arrange, Act, Assert
      });
    });

    describe("when handling concurrency and race conditions", () => {
      it("should eliminate deadlocks and process exactly one reservation when concurrent requests submit reversed seat orders", async () => {
        // Arrange, Act, Assert
      });
    });
  });

  describe("POST /bookings/confirm", () => {
    it("should successfully confirm booking and return 200 OK when payment is valid", async () => {
      // Arrange, Act, Assert
    });
  });
});
```

---

## 2. Test Data Factory & Object Mother Patterns

```mermaid
flowchart TD
    subgraph Patterns[Test Data Patterns]
        F[Test Factories: test/factories/] -->|Dynamic Entities with Overrides| D[Auto-resolves Foreign Key DAGs]
        M[Object Mothers: test/mothers/] -->|Standard Domain Scenarios| S[MovieMother.standard, UserMother.customer]
        A[Auth Helper: test/helpers/auth.helper.ts] -->|Direct JWT Signing| H[createAuthenticatedUser, createAuthenticatedAdmin]
    end
```

- **Factory Pattern**: Use `create<Entity>(db, overrides)` with `Partial<TNewEntity> = {}` to automatically resolve parent relationships.
- **Object Mother Pattern**: Centralize domain presets (`MovieMother.standard()`, `UserMother.admin()`).
- **Auth Helper**: Use `createAuthenticatedUser()` to get a ready-to-use `{ user, token, authHeader }` without cross-module HTTP requests.

---

## 3. SUT Boundary & Cross-Module Test Isolation

- **Testing the Auth Module (`auth.spec.ts`)**: Call the HTTP endpoints (`/auth/register`, `/auth/login`) directly because the Auth API itself is the System Under Test (SUT).
- **Testing Other Modules (`shows.spec.ts`, `users.spec.ts`, `booking.spec.ts`)**: DO NOT call `/auth/register` over HTTP to create test users. Seed directly via `UserMother` / `createAuthenticatedUser` to eliminate test coupling and speed up execution.

---

## 4. OpenAPI Contract-First Type Assertions

- **PROHIBITION**: Never declare local, hand-rolled response interfaces inside test files (`interface UserProfile { ... }`).
- **MANDATORY**: Import schema types from the generated OpenAPI specification (`test/generated/api-schema.d.ts`):

```ts
import type { components } from "../generated/api-schema";

type UserProfileData = components["schemas"]["UserResponseDto"];
type GetProfileResponse = components["schemas"]["ApiResponseDto"] & {
  data: UserProfileData;
};
type Rfc9457ErrorResponse = components["schemas"]["Rfc9457ErrorResponseDto"];
```

---

## 5. Database & State Isolation (Schema-per-Worker Architecture)

- **Dynamic Schema Provisioning**: Every integration test suite binds to a unique PostgreSQL schema (`test_${randomUUID().replace(/-/g, '_')}`) via `options: "-c search_path=<worker_schema>,public"` in the PostgreSQL `Pool` (ADR 0010).
- **Extension Resolution**: Retain `public` in `search_path` to resolve global database extensions (e.g. `btree_gist`).
- **`beforeEach` Truncation**: Run `truncateAllTables(db)` which queries `WHERE schemaname = current_schema()` with `sql.identifier()` to clear transactional tables strictly within the worker's isolated schema without cross-worker deadlocks.
- **Redis Namespace Isolation**: In integration tests, configure IoRedis with `keyPrefix: "test:${workerSchemaId}:"` and BullMQ with `prefix: "bull:${workerSchemaId}"` to prevent cross-worker lock and job interference.
- **Background Scheduler Guardrails**: Disable `@Cron` tasks (`BookingCronService`) in `createTestApp()` during integration test runs.
- **Lifecycle Teardown**: Clean up the provisioned schema in `afterAll()` via `DROP SCHEMA IF EXISTS <worker_schema> CASCADE;`, and close all background Redis connections and timers.

---

## 6. Performance Benchmarks & Stress Testing (`test/benchmarks/`)

- **Location**: `test/benchmarks/` with naming convention `<domain>.bench.ts` (e.g. `shows-batch.bench.ts`).
- **Runner**: `bun run test:bench` (or filter by domain: `bun run test:bench shows`).
- **Structure**: Export `runBenchmark(): Promise<BenchmarkMetric[]>` returning metrics (`task`, `iterations`, `minMs`, `avgMs`, `p50Ms`, `p95Ms`, `p99Ms`, `opsPerSec`).
- **Output Standards**: Console table output only — zero emojis, zero ASCII decorative dividers (`===`), machine-readable and CI/CD-friendly.
