# `web/`

Frontend (PWA) package.

Phase 2.0 primary responsibility:

- Minimal offline dictionary UI (bundle consumer / validation harness)
- Local caching + client-side search index
- Deterministic lookup behavior (no ranking heuristics beyond first match)

## Status

- Phase 2.0.0 (backend): enriched bundle records ✅
- Phase 2.0.1 (this folder): web/PWA scaffolding ✅

## Requirements

- Node.js **20+** (recommended)

This repo includes a **workspace-local** nvm clone at `../.nvm/` (ignored by git) that can be used in constrained environments. If you already have Node installed, you can skip the nvm steps.

## Setup

From repo root:

```bash
export NVM_DIR="$PWD/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 20
```

Then:

```bash
cd web
npm install
```

## Run

```bash
cd web
npm run dev
```

## Notes (scope discipline)

This phase is scaffolding only:

- No bundle loading yet
- No JS normalization parity yet
- No search UI yet

Those land in Phase 2.0.2+ per `docs/ROADMAP.md`.

