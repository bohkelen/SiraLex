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

This folder started as Phase 2.0.1 scaffolding, but the runtime has since moved
well beyond that initial scope.

Completed since the initial scaffold:

- Bundle loading/import and IndexedDB storage
- JS normalization parity for query-time lookup behavior
- Search UI, entry rendering, offline shell behavior, and multi-bundle flows

See `docs/ROADMAP.md` for the milestone history and the current follow-up work.

## Performance constraint (important)

The enriched bundle is ~20 MB. A browser probe confirmed that parsing JSONL with `JSON.parse` can create large transient heap spikes even when you do **not** retain parsed objects.

Implication (lock-in before IndexedDB work):

- `records.jsonl` must **not** be fully materialized in memory as parsed objects.
- Import must be streaming: read → parse line-by-line → write to IndexedDB → discard.
- `search_index.jsonl` should **not** become a giant in-memory Map by default (87k entries can balloon).
- Prefer storing the index in IndexedDB too (or another compact structure) and only reading what’s needed per query.

