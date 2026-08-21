# Domain Documentation Standards

## 1. Domain SSOT: `CONTEXT.md` & Glossary

- **Location**: `CONTEXT.md` at the repository root.
- **Ubiquitous Language**: All code identifiers (entity names, DTO fields, database tables, route segments, test cases) MUST strictly use the terms defined in `CONTEXT.md`.
- **Prohibition**: Do not invent synonyms or translate domain terms arbitrarily.

---

## 2. Architectural Decision Records: `docs/adr/`

- **Location**: `docs/adr/` with zero-padded numbering: `NNNN-<kebab-case-title>.md` (e.g. `0001-redlock-distributed-lock-concurrency-control.md`).
- **Review Requirement**: Before implementing features touching database schema, auth, caching, or locking, MUST read the corresponding ADRs.
- **Handling Contradictions**: If a proposed implementation contradicts an existing ADR, surface the conflict explicitly in PR descriptions and ADR updates rather than overriding silently.

---

## 3. Repository Layout (Single-Context)

```
/
├── CONTEXT.md          # Global domain glossary and ubiquitous language
├── docs/adr/           # Architecture Decision Records (0001-...)
└── src/                # Application modules adhering to the domain model
```
