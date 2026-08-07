# ML1D1 — Multilingual Search State + Query-Log Provenance

**Decision:** `ML1D1_MULTILINGUAL_SEARCH_STATE_IMPLEMENTED`  
**BASE_COMMIT:** `730a28f8b64076c27e85c13dc2e39b19dd737193`  
**Commit:** NOT CREATED (awaiting independent review)

---

## Decision summary

Consumer Search now uses `LookupMode` as the sole mutable runtime source of truth. Legacy `SearchDirection` is derived via `toLegacySearchDirection`. Production query logs write **`query_log_event_v3`** with required `input_lang` / `output_lang`. English UI remains unexposed; preference helpers exist but are **not** restored at startup.

---

## 1. Runtime LookupMode state

| Item | Result |
|------|--------|
| Source of truth | `let currentLookupMode: LookupMode` in `main.ts` |
| Default | `{ from: "fr", to: "mnk" }` (`DEFAULT_LOOKUP_MODE`) |
| Independent `searchDirection` mutable state | **Removed** |
| Legacy direction | `getSearchDirection()` → `toLegacySearchDirection(currentLookupMode)` |
| Swap | `swapLookupMode(currentLookupMode)` on lang toggle |
| EN via consumer UI | Not reachable |

## 2. Default / swap behavior

- Startup: FR → MNK  
- Swap: FR → MNK ↔ MNK → FR  
- EN modes only via harness/tests / programmatic `setSearchLookupMode` + capability

## 3. Helpers (`lookup_mode.ts`)

- `swapLookupMode(mode)` — fail-closed on invalid pairs  
- `resolveSupportedLookupMode(meta, requested)` — unsupported (incl. EN without capability) → **FR→MNK** (never silent remap to MNK→FR)  
- `DEFAULT_LOOKUP_MODE`

## 4. Search execution

`runSearch` binds `executedLookupMode` at generation start, revalidates against active-bundle capability, then calls:

```ts
searchQueryForLookupMode(db, scope, effectiveMode, query, directional, capabilityMeta)
```

FR→MNK still uses `src_*`; MNK→FR uses `tgt_*`; same ladder/debounce/stale-seq/CF2 surfaces. No cross-language fallback.

## 5. Active-bundle capability revalidation

On `refreshDbStatus` / clear active / `setSearchLookupMode` / pre-search:

- Uses persisted `lookup_languages` + `search_key_families`  
- Does **not** derive EN from gloss content  
- Unsupported current mode → FR→MNK  

## 6. Preference storage

**IMPLEMENTED (helpers only; EN restore deferred to ML1D2)**

- Key: `siralex.search_lookup_lang` (`"fr" \| "en"`)  
- Module: `web/src/search/search_lookup_lang_preference.ts`  
- Invalid → FR; localStorage only  
- `main.ts` does **not** read preference on startup (startup remains FR→MNK)

## 7–9. Query-log schema audit + decision

### Audit (BASE)

| Fact | Evidence |
|------|----------|
| Schema ids | Closed union `query_log_event_v1` \| `query_log_event_v2` |
| V1/V2 fields | `direction` only — **cannot** distinguish FR→MNK vs EN→MNK |
| Validators | Required-field checks; unknown keys not rejected, but write path/types closed |
| Export | NDJSON JSONL; mixed versions by `schema_version` |
| IDB | Document rows in existing store; version **6** |

### Decision (Option A — CF2 lesson)

- **Freeze V1 and V2** under their existing ids  
- Introduce **`query_log_event_v3`** with required `input_lang` + `output_lang`  
- Retain `direction` as legacy mirror of the pair  
- Do **not** silently extend V2 under the same schema id  

Historical V1/V2 resolve:

- `source_to_target` → FR→MNK  
- `target_to_source` → MNK→FR  

No in-place mutation of historical rows.

## 10. IndexedDB

**Unchanged: `SIRALEX_DB_VERSION = 6`**  
No new store/index.

## 11. Query-log write path

`appendSearchQueryLogIfEnabled({ lookupMode, ... })` writes **V3** only.  
Language pair bound to the settled search generation’s `lookupMode` (not UI re-read / query text).  
Consent / enable gates / settle debounce / generation checks preserved.

## 12–13. Diagnostics / export

- `resolveLookupModeFromQueryLog` / `formatLookupModeDisplay` / `recentLogLookupPairLabel`  
- Export remains open NDJSON: V1/V2/V3 coexist by `schema_version`  
- No strict export package schema → **compatibility PASS** (additive readable)

## 14. CF2 consistency

One executed mode feeds:

1. `searchQueryForLookupMode`  
2. query-log V3 `input_lang`/`output_lang`  
3. `ExecutedSearchSnapshot` → CF2 capture context  

CF2 **schema** unchanged (already V2 from ML1C2A).

## 15. English UI

**NO** picker, chrome labels, preference selector, More setting, or EN restore.

## 16–18. Regression / harness / downgrade

- Legacy FR↔MNK swap + search path preserved via LookupMode  
- Harness: FR/EN/MNK pairs with family + log + CF2 identity  
- Bundle downgrade: EN→MNK + empty capability → FR→MNK  

## 19. Baseline query-log failures

**On BASE (pre-ML1D1):** 895 passed, **12 failed** — all `query_log_*`.

**Root cause (class A, environment/time):** fixtures used May 2026 `timestamp_iso`; with `QUERY_LOG_MAX_AGE_MS` = 90 days and wall clock Aug 2026, prune deleted rows on append. Not fake-indexeddb.

**ML1D1 action:** while touching the subsystem, fixtures moved to `recentIso()` relative timestamps. Failures **resolved**.

**Current unit suite:** **924 passed / 0 failed**.

---

## High-risk files

### `web/src/main.ts`
- **Why:** sole consumer Search state + settle log + CF2 snapshot  
- **Before:** `let searchDirection`; `searchQuery(...)`  
- **After:** `currentLookupMode`; `searchQueryForLookupMode`; one `effectiveMode` for search/log/CF2  
- **Schema/IDB:** none  
- **Concurrency:** settle compares LookupMode pair; generation `seq` unchanged  

### `web/src/search/lookup_mode.ts`
- Added `swapLookupMode`, `resolveSupportedLookupMode`, `DEFAULT_LOOKUP_MODE`  

### `web/src/search/search_lookup_lang_preference.ts`
- New preference key/parser (not wired to startup)  

### Query-log modules
- `query_log_types.ts` — V3 type + `QUERY_LOG_EVENT_V3`  
- `query_log_store.ts` — `appendQueryLogV3`  
- `query_log_runtime.ts` — production writes V3 from `lookupMode`  
- `query_log_derive.ts` / `query_log_inspect.ts` — resolve/display  

### Not changed
Learning, CF1, CF2 schema, bundle/index builders, `render_entry`, Russian, ranking/normalization.

---

## Tests / build

| Gate | Result |
|------|--------|
| Focused lookup/search/query_log/CF2/harness | PASS |
| `npm --prefix web run test:run` | **924 passed** |
| `test:e2e:ux2-search` | 2 passed |
| `test:e2e:search-feedback` | 7 passed |
| `test:e2e:ux2-search-feedback` | 4 passed |
| `npm --prefix web run build` | PASS |
| `git diff --check` | PASS (exit 0) |

---

## Files changed

### Modified (M)
- `web/src/main.ts`
- `web/src/search/lookup_mode.ts`
- `web/src/search/lookup_mode.test.ts`
- `web/src/query_logging/query_log_types.ts`
- `web/src/query_logging/query_log_store.ts`
- `web/src/query_logging/query_log_store.test.ts`
- `web/src/query_logging/query_log_runtime.ts`
- `web/src/query_logging/query_log_runtime.test.ts`
- `web/src/query_logging/query_log_derive.ts`
- `web/src/query_logging/query_log_derive.test.ts`
- `web/src/query_logging/query_log_inspect.ts`
- `web/src/query_logging/query_log_inspect.test.ts`
- `web/src/query_logging/query_log_controls.test.ts`

### Added (A)
- `web/src/search/search_lookup_lang_preference.ts`
- `web/src/search/search_lookup_lang_preference.test.ts`
- `web/src/search/ml1d1_multilingual_search_state.harness.test.ts`
- `docs/reports/ml1d1_multilingual_search_state_query_log_report.md` (this file)

### Deleted (D)
- NONE

### Untracked (pre-existing / out of scope)
- `web/scripts/capture_ui_screenshots.mjs` (unrelated; do not commit with ML1D1)

### Unexpected changes
- NONE beyond query-log fixture timestamp fixes required to resolve baseline retention failures in the touched subsystem.

### Scope deviations
- NONE (preference helpers defined without EN restore; no CF2 schema change; no IDB bump).

---

## Working tree

Branch `feat/phase-2.0.5-offline-pwa` ahead of origin by 4. ML1D1 changes uncommitted. Commit: **NOT CREATED**.
