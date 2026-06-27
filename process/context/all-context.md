# agent-skills-kit - All Context

Last updated: 2026-06-05

This file is the root context entrypoint for the repo.

Use it for two things:

1. quick routing to the right context pack or root file
2. broad architecture and repository understanding

Start here before loading deeper context files.

---

## How This File Works (the `all-*.md` Convention)

Every `process/context/` directory has one `all-*.md` entrypoint that acts as an attachable quick router for that domain. This root file (`all-context.md`) is the top-level router. Context groups each have their own `all-{group}.md` entrypoint.

**The pattern:**

```
process/context/
  all-context.md                      <-- THIS FILE: root router
  planning/
    all-planning.md                   <-- group router for planning
    example-simple-prd.md             <-- deep doc within the group
    example-complex-prd.md            <-- deep doc within the group
  tests/
    all-tests.md                      <-- group router for tests
    debugging-and-pitfalls.md         <-- deep doc within the group
    e2e-tests.md                      <-- deep doc within the group
  database/
    all-database.md                   <-- group router for database
    schema-guide.md                   <-- deep doc within the group
    migration-procedures.md           <-- deep doc within the group
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

<!-- STUDY: Replace with actual repo directory tree (2-3 levels deep). -->
<!-- Show the top-level layout so agents can quickly orient. -->

<!-- Example of what this looks like filled in (for a Next.js + tRPC monorepo): -->

<!--
```
acme-saas/
  apps/
    web/              -- Next.js 15 App Router
    admin/            -- Internal admin dashboard
  packages/
    api/              -- tRPC routers + Hono server
    db/               -- Prisma ORM + PostgreSQL
    ui/               -- Shared React components
    validators/       -- Shared Zod schemas
  process/
    context/          -- this context system
    general-plans/    -- plans, reports, references
    features/         -- feature-scoped storage
    development-protocols/  -- RIPER-5 methodology docs
```
-->

```
agent-skills-kit/
  .agents/            -- Hooks, adapter, and mirrored agents
  .claude/            -- Claude Code configuration, agents, and skills
    agents/           -- 12 specialized agent definitions (Markdown)
    skills/           -- 15+ executable skill directories (e.g. ag-scout, ag-repomix, ag-tech-graph)
  .codex/             -- Codex-specific agent mirrors, hooks, and tests
  process/            -- Development process metadata and plans (shared)
    context/          -- Durable context routers and groups
    development-protocols/ -- Managed development methodology files (RIPER-5)
    general-plans/    -- Cross-cutting feature plans (active, completed, backlog)
    features/         -- Feature-scoped storage folders
  docs/               -- Project documentation, internationalization (i18n) READMEs
  assets/             -- Visual assets (logos, etc.)
  install.sh          -- Installation script
  resolve-manifest.mjs -- Glob-based manifest resolver
  ag-manifest.json    -- Installation and packaging manifest file
```

## Technology Stack

<!-- STUDY: Replace with actual framework names, versions, and key technology details. -->
<!-- Be specific: "Next.js 15 with App Router" not just "Next.js". -->

<!-- Example of what this looks like filled in: -->

<!--
- **Framework:** Next.js 15 (App Router) for web, Hono for API server
- **Language:** TypeScript 5.5 throughout
- **Runtime:** Node 22.x (web), Bun 1.x (API server and API tests)
- **Database:** PostgreSQL via Prisma ORM (Supabase hosted)
- **API:** tRPC v11 for type-safe RPC
- **Auth:** Clerk (middleware + webhook-based sync)
- **UI:** Tailwind CSS v4 + shadcn/ui components
- **State:** Zustand for client state
- **Package manager:** pnpm 10.x (monorepo with turborepo)
- **Monorepo:** Turborepo for build orchestration
-->

- **Framework/Structure:** Meta development harness for AI coding agents
- **Languages:** Node.js (JavaScript, TypeScript), Shell scripting (Bash)
- **Runtimes:** Node.js v20+, Bash
- **Test Runners:** Custom test suites (Node), Jest (for `ag-sequential-thinking` skill)
- **Dependencies:** `puppeteer`, `sharp`, `yargs`, `@modelcontextprotocol/sdk`, `jest` (per-skill and helper-level)
- **Key CLI Tools:** `resolve-manifest.mjs`
- **Orchestration:** Monitored workflow using system hooks and markdown protocols

## Key Patterns and Conventions

- **RIPER-5 Flow:** Strictly phased spec-driven development workflow (Research -> Innovate -> Plan -> Execute -> Update Process).
- **All-\*.md Convention:** Entry points for context (`all-context.md`) and groups (`all-tests.md`, `all-planning.md`) act as quick context routers to keep context windows small.
- **Agent/Skill Mirroring:** Codex TOML agents mirror Claude Code Markdown agents; `.agents/skills` is symlinked to `.claude/skills`.
- **Validation Gates:** CI workflow `validate.yml` runs a set of validation scripts under `ag-audit-ag`, `ag-audit-context`, `ag-audit-plans`, and `ag-generate-context`.

## Environment and Configuration

- **Config Files:** `ag-manifest.json` (defines paths included/excluded/copied/symlinked), `.markdownlint.json`, `process/development-protocols/` files.
- **Environment Variables (names only):**
  - Statusline: `CK_STATUSLINE_STDIN_TIMEOUT_MS`

## Scan Metadata

- Generated: 2026-06-05
- Repo HEAD: 6f25553867f0ec9755e83a89fbd88e1a4f7d2878
- Mode: Full Scan
- Package manager: npm (no package lock at root, lockfiles exist in sub-packages)

## Open Questions

- None at this stage.
