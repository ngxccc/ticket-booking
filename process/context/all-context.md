# NestJS Ticket Booking - All Context

Last updated: 2026-07-05

This file is the root context entrypoint for the ticket-booking repository.

Use it for two things:

1. quick routing to the right context pack or root file
2. broad architecture and repository understanding

Start here before loading deeper context files.

---

## How This File Works (the `all-*.md` Convention)

Every `process/context/` directory has one `all-*.md` entrypoint that acts as an attachable quick router for that domain. This root file (`all-context.md`) is the top-level router. Context groups each have their own `all-{group}.md` entrypoint.

**The pattern:**

```text
process/context/
  all-context.md                      <-- THIS FILE: root router
  planning/
    all-planning.md                   <-- group router for planning
    example-simple-prd.md             <-- deep doc within the group
    example-complex-prd.md            <-- deep doc within the group
  tests/
    all-tests.md                      <-- group router for tests
```

**How agents use it:**

1. Agent reads `all-context.md` first (this file)
2. Finds the relevant context group from the routing tables below
3. Reads that group's `all-{group}.md` entrypoint
4. Only then loads the specific deep doc needed

This layered routing keeps context windows small. Never load the whole `process/context/` tree.

**What each `all-{group}.md` must contain:**

- Scope (what the group covers and does NOT cover)
- Read-when rules (when an agent should load this group)
- Quick procedures or decision rules
- Source paths (list of deeper docs in the group)
- Update triggers (when to refresh this group's content)
- Routing to deeper docs within the group

---

## Quick Start

For most substantial tasks:

1. read this file first
2. choose the smallest relevant root file or context group from the tables below
3. only then load deeper files

---

## Current Root Entry Points

| File                                       | Read when                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `process/context/all-context.md`           | any substantial planning, research, review, or implementation task          |
| `process/context/tests/all-tests.md`       | testing, verification, debugging test failures, execution planning          |
| `process/context/planning/all-planning.md` | plan-shape calibration, planning examples, SIMPLE vs COMPLEX reference docs |

## Current Context Groups

| Group       | Entry point                                | Scope                                                                       |
| ----------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| `planning/` | `process/context/planning/all-planning.md` | plan-shape calibration, planning examples, SIMPLE vs COMPLEX reference docs |
| `tests/`    | `process/context/tests/all-tests.md`       | test runners, commands, debugging, gaps                                     |

## Task Routing Table

| If the task involves...         | Start with                                 |
| ------------------------------- | ------------------------------------------ |
| architecture or stack questions | this file                                  |
| testing or verification         | `process/context/tests/all-tests.md`       |
| creating a new plan             | `process/context/planning/all-planning.md` |

## Context Group Lifecycle

Context groups are durable knowledge domains, not feature folders.

Create a group when:

- a topic has 3+ durable docs
- a single doc exceeds roughly 800 lines with separable subtopics
- multiple agents repeatedly need only one slice of a large context file
- the topic maps to a stable operational domain (tests, infra, database, auth, UI, workflows, etc.)

Do not create a group when:

- the content is a temporary report
- the content is a plan or execution artifact
- the topic is feature-specific and belongs in `process/features/...`

Move or split one group at a time. Use `all-{group}.md` entrypoints. Run the `audit-context` skill after every context organization change.

## Naming Convention

There are no `README.md` files inside `process/context/`.

Canonical entrypoints use `all-*.md`:

- root: `process/context/all-context.md`
- group: `process/context/{group}/all-{group}.md`

Each `all-{group}.md` file should act as the attachable quick router for that domain:

- tell the agent what the group covers
- give quick procedures and decision rules
- route to smaller deeper files

## Context Update Protocol

When durable project knowledge changes:

1. update the smallest relevant context file
2. update this file if routing, ownership, naming, or groups changed
3. update the owning `all-{group}.md` entrypoint when a group exists
4. run `audit-context`

---

## Repository Structure

```text
ticket-booking/
  src/                -- NestJS application source code
    database/         -- Database connection module and schema definitions
      schemas/        -- Drizzle table schemas (auth, movies, cinemas, shows, bookings, payments, etc.)
    config/           -- Configuration management module
    app.controller.ts -- Main controller
    app.service.ts    -- Main service
    app.module.ts     -- Root application module
    main.ts           -- Application entry point
  test/               -- E2E test suites (Bun test)
  drizzle/            -- Drizzle ORM migration files
  process/
    context/          -- Project context documentation (routers and groups)
    general-plans/    -- Cross-cutting feature plans
    features/         -- Feature-scoped storage folders
    development-protocols/ -- Managed development methodology files (RIPER-5)
  second-brain/       -- Symlink to Obsidian second brain vault
    000_Ticket_Booking_MOC.md -- Master Map of Content
    Docs/             -- Categorized technical documentation notes
      Architecture/   -- Core system specs, roadmap, and architecture
      Auth/           -- Auth schema, WBS deconstruction, and refresh token strategies
      Database/       -- Database schema DBML, enum strategies, index audits, SQL prep
      DevOps/         -- Azure deploy, Docker Compose, HTTPS, Caddy/Nginx, zero-downtime deploy
      Workflows/      -- Domain workflows, TMDB sync, caching & localization strategies
  docker/             -- Application containerization setups (Dockerfile, Dockerfile.prod, Dockerfile.prod.dockerignore)
  docker-compose.yml  -- Postgres & Redis development configuration
```

## Technology Stack

- **Framework/Structure:** NestJS 11
- **Languages:** TypeScript 6.0
- **Runtimes:** Bun 1.1+ (uses `bun.lock` and `package.json` for dependency management)
- **Database:** PostgreSQL via Drizzle ORM
- **Cache/Queue:** Redis & BullMQ (for background job processing / ticket queuing)
- **Database Tools:** Drizzle Kit (for database migrations and Drizzle Studio)
- **Containerization:** Docker & Docker Compose (running PostgreSQL 18-alpine & Redis 8-alpine)
- **Linting & Formatting:** ESLint & Prettier
- **Testing:** Bun test runner (`bun test`) for both unit and E2E tests

## Key Patterns and Conventions

- **RIPER-5 Flow:** Strictly phased spec-driven development workflow (Research -> Innovate -> Plan -> Execute -> Update Process).
- **All-\*.md Convention:** Entry points for context (`all-context.md`) and groups (`all-tests.md`, `all-planning.md`) act as quick context routers to keep context windows small.
- **Transactional Outbox Pattern:** Dual-write operations (such as registering a user and dispatching a verification email) are decoupled via the `outbox_events` table within a single DB transaction. An `OutboxService` relay polling worker runs every 5 seconds, publishing events to BullMQ queues and marking them `processed` or `failed`. Event types are derived at the application layer via `as const` constants (`OUTBOX_EVENT_TYPE`).
- **Swagger OpenAPI Auto-Mapping:** Controller endpoints returning `{ success: true, data: T }` use `@ApiOkResponseGeneric(DtoClass)` with explicit return types (`: Promise<ApiResponse<DtoClass>>`) to allow the NestJS Swagger CLI plugin to auto-map schemas without manual `@ApiProperty` decorators on DTOs.
- **Database Connection Security:** Database connection strings containing legacy SSL modes (`require`, `prefer`, `verify-ca`) are automatically normalized to `sslmode=verify-full` via case-insensitive regex in `DatabaseModule` to prevent deprecation security warnings.
- **Mail & Verification Link Architecture:** Verification emails contain links pointing to the Frontend SPA (`${env.FRONTEND_URL}/verify-email?token=${token}`). The Frontend loads the page and calls `POST /auth/verify-email` with `VerifyEmailDto` (`{"token": "..."}`) on the Backend.
- **Second Brain Note Storage:** When creating general notes, explanations, or documentation, store them under the `second-brain/Docs/` directory structured by topic (`Architecture/`, `Auth/`, `Database/`, `DevOps/`, `Workflows/`). Business specifications, architecture designs, critical trade-offs (e.g. concurrency, outbox pattern), and interview preparation notes must be written to `second-brain/` to facilitate future learning and study. This directory is a symlink pointing to the Obsidian second brain vault (`secondbrain`).
- **Dependency Management:** Use Bun for installing dependencies, running scripts, and testing.

## Environment and Configuration

- **Config Files:** `package.json`, `tsconfig.json`, `drizzle.config.ts`, `nest-cli.json`, `eslint.config.ts`, `docker-compose.yml`, `Caddyfile`, `scripts/redeploy.sh`, `scripts/setup-vps-system.sh`, `scripts/deploy-db.sh`, `scripts/deploy-app.sh`, `scripts/reload-caddy.sh`.
- **Environment Variables (names only):**
  - Database: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`.

## Scan Metadata

- Generated: 2026-07-05
- Repo HEAD: d006cc6d4e30f79b0c6303af5a72c1f0b0c5252a
- Mode: Delta Update
- Changes since last update: Categorized `second-brain/Docs/` into 5 subdirectories (`Architecture/`, `Auth/`, `Database/`, `DevOps/`, `Workflows/`), updated `000_Ticket_Booking_MOC.md` backlinks and documentation router rules.
- Package manager: bun (uses `bun.lock` at root)

## Source References

- `package.json`
- `docker-compose.yml`
- `process/context/tests/all-tests.md`
- `second-brain/000_Ticket_Booking_MOC.md`

## Open Questions

- None at this stage.
