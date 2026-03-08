# ADR 0001: Monorepo layout (`web/`, `api/`, `shared/`)

## Status

Accepted

## Context

SiraLex will be built as an offline-first dictionary + sentence analysis tool with strict requirements around:

- shared data contracts (lossless IR, provenance at entry/sense/example)
- deterministic transliteration (Latin → N’Ko) with uncertainty marking
- search normalization rules (versioned)

These concerns cut across frontend/offline packaging and backend ingestion/parsing, so we want to minimize drift between components.

## Decision

Use a **single monorepo** with the following top-level packages:

- `web/`: frontend (PWA) and offline UX
- `api/`: backend services (ingestion, APIs, admin/moderation tooling)
- `shared/`: shared specs, schemas, and utilities (kept stack-agnostic where possible)

## Consequences

- Pros:
  - one source of truth for schemas/contracts
  - easier coordination between ingestion/transliteration/search behavior and UI
  - simpler onboarding (one repo)
- Cons:
  - repository grows over time; requires discipline in boundaries

## Notes

This ADR does **not** lock the implementation stack (Next.js/FastAPI/etc.). It only establishes repo layout boundaries to support Phase 0/1 planning and execution.

