# 14. Global Route Prefix /api, Native NestJS URI Versioning v1, and Scalar Documentation Architecture

Date: 2026-09-27  
Deciders: Team / Core Architecture

### Metadata

- **ID**: `ADR-0014`
- **Status**: `Accepted`
- **Date**: `2026-09-27`
- **Feature**: `api-infrastructure`
- **Topic**: `Global Route Prefixing (/api), Native NestJS URI Versioning (v1), System Route Exclusions, Scalar Interactive Reference UI (/api/docs), OpenAPI 3.1 Spec Endpoint (/openapi.json)`
- **Target Module**: `src/common/config/api-prefix.config.ts`, `src/common/config/openapi.config.ts`, `src/app.controller.ts`, `src/main.ts`, `test/helpers/app.helper.ts`, `src/modules/*/*.controller.ts`
- **Spec Reference**: Issue #112, PR #127, `docs/standards/api-design-and-error-handling.md`, `ADR-0003` (Route Constants vs NestJS Router Module)

---

## Status

Accepted

---

## Context

As the Ticket Booking platform expands across web, mobile, and third-party partner integrations, the API routing architecture must support clean API taxonomy, backward-compatible API evolution, high-clarity developer documentation, and unthrottled healthcheck probes.

The legacy routing infrastructure presented four architectural challenges:

1. **Missing Unified Global Prefix**:
   Controllers were previously mounted at root paths without an `/api` prefix or with ad-hoc route strings, creating namespace collisions with root reverse proxies, static asset delivery, and cloud health monitoring probes.
2. **Lack of Native API Versioning**:
   Route versioning was either omitted or hardcoded into controller strings (`@Controller('api/v1/...')`), preventing fine-grained per-controller or per-route version increments (e.g. migrating `BookingController` to `v2` while keeping `MoviesController` at `v1`) and breaking multi-version routing.
3. **Healthcheck and Reverse Proxy Collisions**:
   Root healthcheck endpoints (`GET /`, `GET /health`) were susceptible to accidental global prefixing or versioning (`/api/v1/health`), breaking container orchestrator (Docker/Kubernetes/Render) liveness/readiness probes and Sentry uptime monitoring.
4. **Scattered Documentation Endpoints**:
   Swagger/OpenAPI specifications and Scalar reference interfaces were exposed under inconsistent paths (`/reference`, `/api-json`), diverging from standard enterprise API documentation patterns.

---

## Decision

We decided to establish a Centralized Global Prefix & Native URI Versioning Architecture structured across 6 core pillars:

1. **Centralized Global Prefix Configuration (`src/common/config/api-prefix.config.ts`)**:
   - Encapsulate all global prefixing and versioning bootstrap logic in a single reusable function `setupGlobalPrefix(app: INestApplication)`.
   - Apply `app.setGlobalPrefix(GLOBAL_API_PREFIX, { exclude: GLOBAL_PREFIX_EXCLUSIONS })` with `GLOBAL_API_PREFIX = 'api'`.
2. **Explicit System Route Exclusions**:
   - Exclude root and system endpoints from the global prefix to ensure uninterrupted cloud orchestration and documentation access:
     - `GET /` (Root ping / health status)
     - `GET /health` (System liveness & readiness probe)
     - `GET /openapi.json` (Raw OpenAPI 3.1 JSON specification)
     - `GET /api/docs` (Scalar interactive documentation UI)
3. **Native NestJS URI Versioning (`VersioningType.URI`)**:
   - Enable NestJS native URI versioning via `app.enableVersioning({ type: VersioningType.URI })`.
   - Explicitly omit `defaultVersion` to ensure excluded system routes remain completely unversioned (`/health`, `/api/docs`).
   - Tag all business controllers with explicit versions: `@Controller({ path: ..., version: '1' })`.
4. **Multi-Version Evolution Strategy**:
   - Support seamless introduction of future API versions (`v2`) via:
     - **Separate Controller**: `@Controller({ path: BOOKING_ROUTES.BASE, version: '2' })` for breaking architectural rewrites.
     - **Method-Level Override**: `@Version('2')` on specific endpoints within a `v1` controller for localized non-breaking upgrades.
     - **Multi-Version Support**: `@Controller({ path: ..., version: ['1', '2'] })` for backward-compatible shared endpoints.
5. **Modernized OpenAPI 3.1 & Scalar Documentation UI (`src/common/config/openapi.config.ts`)**:
   - Mount the interactive Scalar reference UI at `/api/docs` with `saturn` theme.
   - Serve the raw OpenAPI 3.1 specification at `/openapi.json`, eliminating redundant legacy aliases (`/api-json`).
6. **Unified App Factory Alignment (`test/helpers/app.helper.ts`)**:
   - Execute `setupGlobalPrefix(app)` in both production bootstrap (`src/main.ts`) and test harness (`createTestApp()`), guaranteeing 100% environment parity between production and integration tests.

---

## Consequences

### Positive Consequences

- **Clean API Taxonomy**: All business endpoints follow predictable, standardized URLs: `/api/v1/{module}/{resource}`.
- **Zero-Downtime API Evolution**: Seamless side-by-side execution of `v1` and `v2` endpoints without routing conflicts or breaking changes for existing mobile/web clients.
- **Container Orchestrator Compatibility**: Unversioned, unthrottled healthcheck probes (`/` and `/health`) ensure rapid container health reporting without hitting rate limiters.
- **Unified Testing Parity**: All integration test suites, E2E error filters, and k6 load testing scripts run against identical `/api/v1/*` route structures.

### Negative Consequences

- **Route Constant Update**: All external consumers and test suites require updating endpoint paths to include the `/api/v1` prefix.
- **Explicit Version Tagging**: Every new controller must be explicitly annotated with `version: '1'` (or target version) to participate in URI routing.

---

### Explicit Tradeoffs

- **Explicit Controller Versioning vs Global `defaultVersion: '1'`**:
  Omitting global `defaultVersion` requires annotating each business controller with `version: '1'`. This tradeoff was explicitly chosen to prevent root system controllers (`AppController`) from accidentally generating versioned routes like `/v1/health` or `/api/v1`.
- **URI Versioning (`/api/v1/*`) vs Header Versioning (`Accept: application/vnd.app.v1+json`)**:
  URI versioning is easily discoverable, cacheable at CDN/reverse proxy layers, and directly testable in browser and Scalar UI, at the cost of embedding version numbers in the URL path.

---

## Validation & Verification

- Verified `AppController` serves unversioned, unthrottled responses at `GET /` and `GET /health`.
- Verified all business controllers respond at `/api/v1/*` across 58 test files and 454 tests in `bun test`.
- Verified Scalar interactive documentation loads at `/api/docs` and raw OpenAPI schema at `/openapi.json`.
- Verified k6 concurrency scripts and Playwright automation suites execute successfully against `/api/v1/*`.
