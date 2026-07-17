# NestJS Ticket Booking - All Tests

Last updated: 2026-06-28

Attach this file first when the task involves testing, verification, or test debugging.

This is the fast operator guide for the testing surface:

- which runner to use
- what command to start with
- how to quickly debug common failures
- which deeper file to read next

---

## How This File Works

This is the `all-tests.md` entrypoint for the `tests/` context group. It follows the `all-*.md` routing convention:

1. Agents read `all-context.md` first and get routed here for testing tasks
2. This file gives quick decision rules and commands
3. For deeper details, agents follow the routing table below to specific docs

---

## What This Covers

- test runner selection
- quick commands by test scope
- dependency on running environment (Docker containers)
- fast debugging procedures

## Read This When

Use this file when you need to:

- run tests after implementation
- run unit tests or E2E tests
- check types or run linter
- debug failing tests

## Quick Routing

(No deeper test docs yet. Add routing entries here as they are created.)

## Quick Decision Guide

### Use `bun test` for everything

- All tests (both unit and E2E) run through the Bun native test runner (`bun test`).
- Database migrations and running Docker containers are required for tests that touch Postgres or Redis.

### Use Docker Compose before running tests

- The application uses Postgres (for persistence) and Redis (for queue/caching).
- Ensure the containers are running by executing `docker compose up -d` before running database-dependent or E2E tests.

---

## Default Verification Order

Unless the task clearly needs a different path:

1. ensure Docker containers are up (`docker compose up -d`)
2. run type checks (`bun run check-types`) to catch TS compile issues
3. run the narrowest existing automated test (e.g. `bun test src/app.controller.spec.ts`)
4. run the full unit test suite (`bun run test`)
5. run E2E integration tests (`bun run test:e2e`)
6. run the linter (`bun run lint`) to ensure styling standards are met

---

## Commands

### API Integration Tests (Newman)

- **Locations:**
  - Scenario files (Postman collections): `test/api/scenarios/`
  - Environment configurations: `test/api/environments/`
  - Iteration data files: `test/api/data/`

- **File Naming Rule (Dynamic Mapping):**
  - The scenario JSON file and its corresponding iteration data JSON file MUST follow matching naming conventions.
  - Specifically, a scenario file `<name>.json` (e.g. `auth_flow.json`) MUST map to a data file named `<name>_data.json` to allow dynamic mapping and execution by automated directory-scanning scripts.

---

## Commands

| Scope / Task     | Runner              | Command                                  | Notes                                               |
| ---------------- | ------------------- | ---------------------------------------- | --------------------------------------------------- |
| Run Unit Tests   | Bun test            | `bun run test` (or `bun test src/`)      | Run all tests in `src/`                             |
| Run E2E Tests    | Bun test            | `bun run test:e2e` (or `bun test test/`) | Run all E2E integration tests in `test/`            |
| Watch Unit Tests | Bun test            | `bun run test:watch`                     | Run tests in watch mode                             |
| Coverage Report  | Bun test            | `bun run test:cov`                       | Generate coverage report                            |
| Type Check       | TypeScript Compiler | `bun run check-types`                    | Run `tsc --noEmit`                                  |
| Lint Code        | ESLint              | `bun run lint`                           | Run ESLint with fix and caching options             |
| Format Code      | Prettier            | `bun run format`                         | Run Prettier formatter across source and test paths |

## Debugging Quick Reference

- **Database Connection Issues:** If tests fail with connection errors to Postgres or Redis, ensure Docker is running and execute `docker compose up -d` to spin up services.
- **Port Conflicts:** If `docker compose up` fails, check if local instances of Postgres (port 5432) or Redis (port 6379) are already running on the host and stop them.
- **TypeScript Compilation Errors:** If tests fail due to types, run `bun run check-types` to see type errors across the project.
- **Lint Failures:** Run `bun run lint` to automatically fix common styling issues.
