# Implementation Standards

## Core Principles

- Follow YAGNI, KISS, and DRY.
- Read `process/context/all-context.md` first, then load only the relevant context group or root file.
- Prefer updating existing files over creating parallel "enhanced" variants.
- Implement real code paths rather than mock-only stand-ins unless the user explicitly asks for a mock or stub.

## Code Organization

- Use descriptive kebab-case filenames.
- Keep TypeScript and JavaScript source files roughly under 200 lines when practical; split by responsibility when files become hard to reason about.
- Prefer focused modules, helpers, and composition over large mixed-purpose files.
- Markdown planning, context, agent, and skill files are exempt from the 200-line rule.
- **Visual Workflow Documentation:** Each feature must document its operational and database flow visually (using Mermaid or sequence diagrams) inside its own dedicated note within the `second-brain/Docs/` directory structured by topic (e.g. `second-brain/Docs/Auth/Register_User_Existence_Creation_Workflow.md`). Do NOT consolidate multiple workflows into a single monolithic document, keeping documentation distributed and context-localized.

## Implementation Behavior

- Follow established architecture and local code patterns before inventing new ones.
- In utility or helper layers, prefer result objects over throwing when the local repo pattern expects recoverable errors.
- Handle edge cases and error paths deliberately.
- Prioritize readable, maintainable code over clever abstractions.
- **Transactional Outbox Pattern:** Dual-write operations (such as registering a user and sending a verification email) MUST be decoupled using the Transactional Outbox Pattern. State mutations and outbox event records (`outbox_events` table) MUST occur within a single database transaction. Background workers (`OutboxService`) poll for pending events, publish them to queue processing systems (BullMQ), and mark events as `processed` or `failed`. Event types MUST be defined at the application layer using TypeScript `as const` constraints (`OUTBOX_EVENT_TYPE`) rather than database-level enums to minimize migration overhead.
- **DTO & Spec Testing Rules:** DTOs containing complex custom validation or input sanitization logic (such as XSS tag stripping) MUST have dedicated unit tests (`*.dto.spec.ts`). Basic DTOs relying solely on standard built-in `class-validator` decorators should not have separate specs to avoid redundant testing.
- **Swagger OpenAPI Documentation Standards:** Controller endpoints returning standardized responses (`{ success: true, data: T }`) MUST use `@ApiOkResponseGeneric(DtoClass)` and explicitly annotate TypeScript return types (`: Promise<ApiResponse<DtoClass>>`). Response DTOs MUST be concrete TypeScript classes (not interfaces) to allow the NestJS `@nestjs/swagger` CLI plugin to introspect runtime property metadata.
- **Database Connection Security:** Connection strings specifying legacy SSL modes (`require`, `prefer`, `verify-ca`) MUST be normalized to `sslmode=verify-full` via case-insensitive global regex (`/sslmode=(require|prefer|verify-ca)/gi`) in the database module to eliminate driver security deprecation warnings.

## Tooling

- Use `bun`, not `npm` or `pnpm`.
- Use Context7 for library and API docs or setup guidance.
- Use `gh` for GitHub automation when needed.
- For database debugging, follow the current repo stack and context docs; do not assume Drizzle or SQLite unless the specific package actually uses them.
- Markdown formatting: Always format markdown files using Prettier.

## Quality Gates

- Ensure code is syntactically valid and compiles where applicable.
- Run the most relevant tests for the change before calling work complete.
- Use code review or reviewer agents for meaningful implementation changes.
- Do not wave away failing tests just to force a green status.

## Risky Work Evidence Contract

For high-risk work, use a manual-first evidence pack before calling the change ready for finalize, push, or human handoff.

High-risk classes include:

- auth or identity flows
- billing, payments, or credit accounting
- schema/data migrations or destructive writes
- public API or external contract changes
- deploy/runtime/container/proxy/gateway behavior
- permission, secret, or trust-boundary logic

Preferred artifact set in the selected plan's reports `harness/` folder:

- `risk-gate.json`
- `context-snippets.json`
- `verification.json`
- `review-decision.json`
- `adversarial-validation.json` for high-risk or adversarial paths

Auto-stop rule:

- if risk is `high`, do not treat the work as ready to finalize until the evidence pack exists and the reviewer decision is recorded
- if the evidence pack is missing, say so explicitly instead of implying the work is proven

This contract is manual-first and opt-in by risk class. It is not a default blocking hook.

## Commit Hygiene

- Keep commits focused on the requested change.
- Never commit secrets or credentials.
- Use clean professional commit messages, ideally conventional-commit style when it fits the change.
