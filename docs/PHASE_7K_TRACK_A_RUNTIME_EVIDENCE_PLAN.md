# Phase 7K Track A Runtime Evidence Hardening — Implementation Plan

**Status:** planning only — no implementation until reviewed  
**Parent plan:** `docs/PHASE_7K_QUERY_EVIDENCE_PLAN.md`  
**Scope:** web-side runtime evidence hardening only (Track A)

---

## Path note

Requested paths differ slightly from the repo layout. Actual query-logging modules live under `web/src/query_logging/`:

| Requested | Actual |
|---|---|
| `web/src/query_log_store.ts` | `web/src/query_logging/query_log_store.ts` |
| `web/src/query_log_runtime.ts` | `web/src/query_logging/query_log_runtime.ts` |
| `web/src/query_log_controls.ts` | `web/src/query_logging/query_log_controls.ts` |
| `web/src/query_log_*.test.ts` | `web/src/query_logging/query_log_*.test.ts` |

Additional existing files not listed but in scope:

- `web/src/query_logging/query_log_types.ts`
- `web/src/query_logging/query_log_inspect.ts`
- `web/src/query_logging/query_log_inspect.test.ts`

Other inspected paths match: `web/src/main.ts`, `web/src/i18n.ts`, `web/src/types/records.ts`, `web/src/search/search_query.ts`, `web/src/search/resolve_records.ts`, `web/package.json`.

---

## 1. Existing logging architecture

### Phase 5B flow (already shipped)

```text
User types in searchInput
  → 150 ms debounce → runSearch()
  → searchQuery() → optional resolveRecords()
  → scheduleSettledQueryLog() [800 ms settle]
  → appendSearchQueryLogIfEnabled() [if opt-in]
  → appendQueryLog() → IndexedDB query_logs store
```

**Opt-in toggle**

- `localStorage` key `siralex.query_logging.enabled` (`"true"` / absent).
- Default: **off** (`getQueryLoggingEnabled()` fails closed if storage throws).
- Toggle in Advanced diagnostics (`main.ts`); turning off cancels pending settled log but does **not** clear stored rows.

**IndexedDB `query_logs` store** (`siralex_db.ts` v3 migration)

- Auto-increment `log_id` primary key.
- Indexes: `by_timestamp_iso`, `by_bundle_id`, `by_storage_scope_id`.
- Append-only writes via `appendQueryLog()`.

**Settled-query logging**

- `QUERY_LOGGING_SETTLE_DELAY_MS = 800`.
- Guards: `searchSeq`, empty query, input/direction/bundle unchanged, logging still enabled.
- Logged on both hit and miss paths in `runSearch()`.

**Export / clear**

- `exportQueryLogsJsonl()` → NDJSON blob, ascending `log_id`.
- `clearAllQueryLogs()` / `clearQueryLogsForStorageScope()`.
- UI wrappers in `query_log_controls.ts` with download filename `siralex-query-logs-{UTC}.jsonl`.

**Diagnostics UI** (`main.ts` → Advanced diagnostics `<details>`)

- Toggle, count, export, clear, recent 50 rows table (`query_raw`, hit/miss, `ladder_level_hit`, `timestamp_iso`).
- Copy: “Logs stay on this device. No automatic upload.”

**Existing v1 event schema** (`query_log_event_v1`)

```typescript
query_raw, query_normalized_keys, direction, ladder_level_hit,
ir_ids_count, bundle_id, bundle_version?, storage_scope_id,
norm_version, app_version, timestamp_iso, logging_enabled: true
```

### Gaps vs Phase 7K plan

| Area | Exists | Needs change |
|---|---|---|
| v1 schema + store | Yes | Add v2 writes; union types for read/export |
| Opt-in toggle | Yes | Add consent gate before first enable |
| Settled logging | Yes | Pass latency + richer search metadata |
| Export JSONL | Yes | Mixed v1/v2 passthrough; anonymized export deferred |
| Clear logs | Yes | Unchanged |
| Diagnostics UI | Partial | Status/count/matched_key/consent/diagnostics copy |
| Retention cap | **No** | 2000 / 90-day prune on append |
| `matched_key`, `top_ir_ids` | **No** in logs | Wire from `SearchResult` (already in search path) |
| `query_normalized_keys` in log | Recomputed in runtime | Should come from search path |
| `catalog_version` | **No** | Resolve from cached catalog at log time |
| `ui_language`, `session_bucket_id`, `consent_version` | **No** | Add |
| `result_status`, `matched_deep_ladder`, `latency_ms`, `offline_or_online` | **No** | Derive at log time |
| Consent copy / i18n | **No** | Add FR/EN keys |
| Tests | Good v1 coverage | Extend for v2, consent, retention |

### Known Phase 5B debt (Track A should fix)

`query_log_runtime.ts` recomputes `computeSearchKeys()` instead of using `searchQuery()` output (`matched_key` is already returned but ignored). `runSearch()` captures `t0 = performance.now()` but never passes latency to logging.

---

## 2. Files to change

### Core logging (extend, do not replace)

| File | Change |
|---|---|
| `web/src/query_logging/query_log_types.ts` | v2 types, union, constants (`TOP_IR_IDS_LIMIT = 5`, retention caps) |
| `web/src/query_logging/query_log_derive.ts` | **New** — `deriveResultStatus()`, `deriveMatchedDeepLadder()`, v1/v2 display helpers |
| `web/src/query_logging/query_log_consent.ts` | **New** — consent/session-bucket localStorage API |
| `web/src/query_logging/query_log_catalog.ts` | **New** — `resolveCatalogVersionForBundle(db, bundleId)` from `CachedBundleCatalog` |
| `web/src/query_logging/query_log_store.ts` | v2 append/validate, retention prune, stats query, union reads |
| `web/src/query_logging/query_log_runtime.ts` | v2 payload build; remove shadow normalization recompute |
| `web/src/query_logging/query_log_controls.ts` | stats for UI, copy diagnostics, export options type stub |
| `web/src/query_logging/query_log_inspect.ts` | Hit/miss/status for v1 + v2 rows |

### Search metadata (minimal, non-behavior)

| File | Change |
|---|---|
| `web/src/search/search_query.ts` | Extend `SearchResult` with `query_normalized_keys` (+ optional `last_tried_normalized_key` on miss) |

### UI + i18n

| File | Change |
|---|---|
| `web/src/main.ts` | Consent-gated toggle, latency pass, diagnostics table/stats/copy button |
| `web/src/i18n.ts` | Consent + diagnostics i18n keys (FR/EN) |
| `web/src/i18n.test.ts` | Assert new keys resolve in both locales |

### Tests

| File | Change |
|---|---|
| `web/src/query_logging/query_log_store.test.ts` | v2 validation, retention, stats, mixed export |
| `web/src/query_logging/query_log_runtime.test.ts` | v2 fields, consent gate, metadata from search result |
| `web/src/query_logging/query_log_controls.test.ts` | diagnostics copy text, export filename unchanged |
| `web/src/query_logging/query_log_inspect.test.ts` | v2 `result_count` / `result_status` |
| `web/src/query_logging/query_log_derive.test.ts` | **New** — result_status + matched_deep_ladder matrix |
| `web/src/query_logging/query_log_consent.test.ts` | **New** — consent/session bucket |
| `web/src/search/search_query.test.ts` | **If exists** — assert new metadata fields; else add minimal test |

### Explicitly out of scope for Track A

- `web/src/types/records.ts` — no change (only `ir_id` refs logged)
- `web/src/search/resolve_records.ts` — no change
- `scripts/analyze_query_logs.py`, `shared/query_evidence/` — Track B
- Catalog/bundle/production assets — no change
- IndexedDB schema version bump — **not required** (same store, polymorphic rows)

---

## 3. `query_log_event_v2` schema

### TypeScript definition (planned)

Add to `query_log_types.ts`:

```typescript
export const QUERY_LOG_EVENT_V2 = "query_log_event_v2" as const;
export const QUERY_LOG_CONSENT_VERSION = "phase7k_tester_consent_v1" as const;
export const QUERY_LOG_TOP_IR_IDS_LIMIT = 5 as const;
export const QUERY_LOG_MAX_ROWS = 2000 as const;
export const QUERY_LOG_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export type QueryLogResultStatus =
  | "miss"
  | "hit_single"
  | "hit_multi";

export type QueryLogEventV2 = {
  schema_version: typeof QUERY_LOG_EVENT_V2;
  event_id: string;
  log_id?: number;
  timestamp_iso: string;
  app_version: string;
  bundle_id: string;
  bundle_version?: string;
  catalog_version?: string;
  storage_scope_id: string;
  norm_version: string;
  query_raw: string;
  query_normalized_primary: string | null;
  query_normalized_keys: QueryLogNormalizedKeys;
  direction: QueryLogDirection;
  ui_language: "en" | "fr";
  result_status: QueryLogResultStatus;
  result_count: number;
  top_ir_ids: string[];
  matched_key_type: QueryLogLadderLevel;
  matched_key: string | null;
  matched_deep_ladder: boolean;
  latency_ms: number;
  offline_or_online: boolean;
  session_bucket_id: string;
  logging_enabled: true;
  consent_version: string;
};

export type QueryLogEvent = QueryLogEventV1 | QueryLogEventV2;
export type AppendQueryLogV2Input = Omit<QueryLogEventV2, "log_id" | "schema_version">;
```

### `result_status` derivation

| Condition | `result_status` |
|---|---|
| `result_count === 0` | `miss` |
| `result_count === 1` | `hit_single` |
| `result_count > 1` | `hit_multi` |

### `matched_deep_ladder` derivation

| Condition | `matched_deep_ladder` |
|---|---|
| `matched_key_type` is `punct_stripped` or `nospace` | `true` |
| otherwise (including `none` on miss) | `false` |

A query can be both `hit_multi` and `matched_deep_ladder: true` — for example a multi-target hit resolved via `punct_stripped`:

```json
{
  "result_status": "hit_multi",
  "matched_deep_ladder": true,
  "matched_key_type": "punct_stripped",
  "result_count": 3
}
```

Do **not** use `"result_status": "hit_deep_ladder"`.

### Field mapping from v1

| v1 | v2 |
|---|---|
| `ladder_level_hit` | `matched_key_type` (same enum) |
| `ir_ids_count` | `result_count` |
| — | `top_ir_ids`, `matched_key`, `result_status`, `matched_deep_ladder`, etc. |

### `query_normalized_primary` rules

| Outcome | Value |
|---|---|
| Hit | `matched_key` from search |
| Miss | `last_tried_normalized_key` from search loop, or `null` if no keys tried |

### v1 export compatibility

- **Do not migrate** existing v1 rows in IndexedDB.
- **New writes only v2** once Track A lands.
- **Export:** serialize each row as stored; NDJSON may contain mixed `schema_version` values.
- **Read helpers:** use type guard `isQueryLogEventV2(row)`; v1 fallback for hit/miss via `ir_ids_count`.
- **`analyze_query_logs.py`:** Track B will add v2 ingest; Track A ensures export is backward-compatible passthrough.

### `event_id`

Generate with `crypto.randomUUID()` at append time (fallback: deterministic test-only stub in vitest via injected `createEventId` dep if needed).

---

## 4. Search metadata wiring

### What `searchQuery()` already exposes

```typescript
export type SearchResult = {
  ir_ids: string[];
  matched_key_type: keyof SearchKeys | null;
  matched_key: string | null;
};
```

`main.ts` already passes full `SearchResult` into `scheduleSettledQueryLog` → `appendSearchQueryLogIfEnabled`, but runtime only uses `ir_ids.length` and `matched_key_type`.

### Smallest safe `SearchResult` extension

**No ranking, ladder, or lookup behavior change** — only return metadata from the existing single `computeSearchKeys()` call and ladder walk:

```typescript
export type SearchResult = {
  ir_ids: string[];
  matched_key_type: keyof SearchKeys | null;
  matched_key: string | null;
  query_normalized_keys: SearchKeys;
  last_tried_normalized_key: string | null;
};
```

Implementation in `search_query.ts`:

- Assign `query_normalized_keys: keys` once after `computeSearchKeys`.
- In the ladder loop, before each `idbGet`, set `last_tried_normalized_key = normalizedKey`.
- On hit, return as today plus both new fields.
- On miss, return empty `ir_ids` plus keys and last tried key.

### Runtime wiring (`query_log_runtime.ts`)

Replace `SearchLogResult` with `Pick<SearchResult, ...>` or import `SearchResult` directly.

```typescript
type AppendSearchQueryLogParams = {
  queryRaw: string;
  direction: SearchDirection;
  result: SearchResult;
  activeBundleMeta: Pick<ActiveBundleMeta, "bundle_id" | "version" | "normalization_ruleset">;
  storageScopeId: string;
  uiLanguage: Locale;
  latencyMs: number;
  catalogVersion?: string;
  timestampIso?: string;
};
```

Build v2 row:

| Field | Source |
|---|---|
| `matched_key_type` | `result.matched_key_type ?? "none"` |
| `matched_key` | `result.matched_key` |
| `top_ir_ids` | `result.ir_ids.slice(0, 5)` |
| `result_count` | `result.ir_ids.length` |
| `result_status` | `deriveResultStatus(result.ir_ids.length)` |
| `matched_deep_ladder` | `deriveMatchedDeepLadder(matched_key_type)` |
| `query_normalized_keys` | map `SearchKeys` → `QueryLogNormalizedKeys` (same shape) |
| `query_normalized_primary` | hit → `matched_key`; miss → `last_tried_normalized_key` |
| `latency_ms` | from `main.ts` `Math.round(performance.now() - t0)` at settle time |
| `offline_or_online` | `navigator.onLine` (default `true` if unavailable) |
| `catalog_version` | optional resolver (below) |

**Remove** `computeNormalizedKeysForLogging()` entirely.

### `catalog_version` resolution

`ActiveBundleMeta` has no catalog version today. Catalog entries use `version` (e.g. `norm-v3-featured-enriched-source-aliases-3-source-index-supplements-2` in `web/public/catalog.json`).

Planned helper `resolveCatalogVersionForBundle(db, bundleId)`:

1. `getCachedBundleCatalog(db)`.
2. Find `catalog.bundles.find(b => b.bundle_id === bundleId)?.version`.
3. Return `undefined` if cache missing or bundle not in catalog (log row omits field — do not block append).

Called inside `appendSearchQueryLogIfEnabled` (one readonly meta read; failures swallowed).

### `main.ts` changes

In `scheduleSettledQueryLog` callback, compute latency from search start stored on payload:

```typescript
type SettledQueryLogPayload = {
  // existing fields...
  latencyMs: number;
  uiLanguage: Locale;
};
```

Set `latencyMs` when scheduling (from `runSearch`’s `t0`). Pass `getCurrentLocale()` into append call.

**No change** to `resolve_records.ts` or result rendering.

---

## 5. Consent gate

### localStorage keys (new module `query_log_consent.ts`)

| Key | Purpose |
|---|---|
| `siralex.query_logging.consent_version` | e.g. `phase7k_tester_consent_v1` |
| `siralex.query_logging.consent_at_iso` | ISO timestamp of agree |
| `siralex.query_logging.session_bucket_id` | UUID created on first agree |

Existing: `siralex.query_logging.enabled`.

### Behavior

| Action | Result |
|---|---|
| Default | Logging off; no consent recorded required |
| User clicks Turn On | If consent version missing/stale → show confirm dialog with i18n body |
| Agree | Set consent keys, create `session_bucket_id` if absent, set enabled `"true"` |
| Decline | Leave enabled off; no consent keys written |
| Turn Off | Remove enabled flag only; **keep** consent + session bucket + existing logs |
| Clear logs | Separate button; unchanged confirm |
| Append | Require `enabled === true` **and** `hasValidQueryLoggingConsent()` |

### Consent invalidation

If `QUERY_LOG_CONSENT_VERSION` bumps in code, `hasValidQueryLoggingConsent()` returns false → user must re-confirm on next enable; existing logs remain until cleared.

### API (testable)

```typescript
export function hasValidQueryLoggingConsent(): boolean;
export function getQueryLoggingConsentStatus(): { version?: string; atIso?: string };
export function recordQueryLoggingConsent(now?: () => Date): void;
export function getOrCreateSessionBucketId(): string;
export function tryEnableQueryLoggingWithConsent(
  confirmFn: (message: string) => boolean,
  translate: (key: ConsentI18nKey) => string,
): boolean;
export function disableQueryLogging(): void;
```

### UI (`main.ts`)

Replace direct `setQueryLoggingEnabled(!enabled)` on toggle:

- **Turn On:** `tryEnableQueryLoggingWithConsent(window.confirm, t)` (or small inline modal later; confirm is sufficient for Track A).
- **Turn Off:** `disableQueryLogging()` + cancel pending settle.

Show consent status line in diagnostics: `Consent: recorded (phase7k_tester_consent_v1, 2026-06-18…)` / `Consent: not recorded`.

### i18n keys (add to `MESSAGES.en` / `MESSAGES.fr`)

- `logging.consentPrompt` — multi-line confirm body (FR/EN from parent plan §7)
- `logging.consentRecorded` — status with `{version}`, `{date}`
- `logging.consentNotRecorded`
- `logging.copyDiagnostics` — button label
- `logging.diagnosticsCopied` / `logging.diagnosticsCopyFailed`
- `logging.statsLine` — `{count}`, `{oldest}`, `{cap}`, `{days}`
- `logging.recentColumnStatus`, `logging.recentColumnCount`, `logging.recentColumnMatchedKey`

Add matching entries to `i18n.test.ts` (both locales non-empty, FR contains expected phrases).

---

## 6. Retention cap

### Policy

- Max **2000** rows (global store, not per bundle).
- Max age **90 days** from `timestamp_iso`.
- Prune **on append**, after successful `store.add`.

### Algorithm (`pruneQueryLogsAfterAppend` in `query_log_store.ts`)

1. **Age prune:** readonly cursor on `by_timestamp_iso` where `timestamp_iso < cutoffIso`; collect primary keys; delete in readwrite tx.
2. **Count prune:** if `count > 2000`, open forward cursor on primary key, delete oldest `(count - 2000)` rows.

Use existing indexes; no DB migration.

### Fail closed

- Prune errors: `console.warn` only; **do not** roll back the append (search must never break).
- Append validation errors: still throw before write (test-only path).

### Tests (`query_log_store.test.ts`)

| Test | Setup |
|---|---|
| 2001st row evicts oldest | Append 2001 v2 rows with monotonic timestamps; expect count 2000; oldest `log_id` gone |
| 91-day row evicted | Insert row with `timestamp_iso` 91 days ago; append new row; old row absent |
| Other stores untouched | Reuse existing clear-all isolation pattern |

Optional: `getQueryLogStats(db)` → `{ count, oldest_timestamp_iso | null }` for diagnostics.

---

## 7. Export and diagnostics changes

### Export (Track A)

**In scope**

- Default JSONL export unchanged in UX; rows pass through as stored (v1 + v2 mixed).
- Keep filename: `siralex-query-logs-{yyyyMMdd}T{hhmmss}Z.jsonl`.
- Extend `ExportQueryLogsOptions`:

```typescript
export type ExportQueryLogsOptions = QueryLogScopeFilter & {
  mode?: "default"; // anonymized deferred
};
```

**Deferred: anonymized export**

Reason: requires Web Crypto SHA-256 pipeline, per-export salt, row transformer, second UI button, and analyzer contract — meaningful scope on its own. Track A should **not** implement it; leave `mode: "anonymized"` for a follow-up PR with tests listed in parent plan.

### Diagnostics UI (Advanced diagnostics only)

**Stats line** (below count):

```text
42 logs · oldest 2026-05-01 · cap 2000 / 90d
```

**Consent status** (mono subtitle)

**Recent searches table** — extend columns:

| Column | v1 source | v2 source |
|---|---|---|
| `query_raw` | unchanged | unchanged |
| status | hit/miss from `ir_ids_count` | `result_status` |
| count | `ir_ids_count` | `result_count` |
| matched_key | — | `matched_key` or `—` |
| deep ladder | — | `matched_deep_ladder` (`yes`/`no` or icon) |
| ladder | `ladder_level_hit` | `matched_key_type` |
| timestamp | unchanged | unchanged |

Use i18n column headers (not raw field names) for FR UI.

**Copy diagnostic info** button

Build plaintext (no PII beyond bucket prefix):

```text
app_version=0.0.0
bundle_id=bundle_full_...
catalog_version=norm-v3-... (or unknown)
norm_version=norm_v3
ui_language=fr
query_log_count=42
query_log_oldest=2026-05-01T...
logging_enabled=true
consent_version=phase7k_tester_consent_v1
session_bucket_prefix=a1b2c3d4
```

Implement `copyQueryLogDiagnosticsToClipboard()` in `query_log_controls.ts` using `navigator.clipboard.writeText` with fallback message on failure.

**Refresh** after append, export, clear, toggle.

---

## 8. Test plan

### Commands (from `web/package.json`)

```bash
cd web && npm run test:run -- src/query_logging/query_log_store.test.ts src/query_logging/query_log_runtime.test.ts src/query_logging/query_log_controls.test.ts
cd web && npm run test:run
cd web && npm run build
```

### `query_log_store.test.ts` — add/update

| Test | Assert |
|---|---|
| append v2 row | All required fields; `schema_version === query_log_event_v2` |
| v2 validation rejects bad `result_status`, negative `latency_ms`, `top_ir_ids.length > 5` |
| v2 validation requires boolean `matched_deep_ladder` |
| mixed export | One v1 fixture row + one v2 row → two lines, distinct schema versions |
| retention 2001 | Count 2000; oldest evicted |
| retention 91d | Stale row removed |
| getQueryLogStats | Count + oldest timestamp |

Update `makeAppendInput` → add `makeAppendV2Input()` helper.

### `query_log_runtime.test.ts` — add/update

| Test | Assert |
|---|---|
| no append without consent | enabled true but consent missing → count 0 |
| append v2 with consent | Full metadata including `top_ir_ids`, `matched_key`, `consent_version` |
| uses passed normalized keys | Spy/mock: no `computeSearchKeys` in runtime module |
| multi-hit + deep ladder | `result_status: "hit_multi"`, `matched_deep_ladder: true` when `matched_key_type: "punct_stripped"` and `result_count > 1` |
| single hit not deep ladder | `result_status: "hit_single"`, `matched_deep_ladder: false` when `matched_key_type: "casefold"` |
| session bucket stable | Two appends same bucket id |

### `query_log_controls.test.ts` — add/update

| Test | Assert |
|---|---|
| formatQueryLogExportFilename | unchanged |
| copy diagnostics | Mock clipboard; expected lines present |
| getQueryLogStatsFromDb wrapper | ok/message shape |

### `query_log_derive.test.ts` — new

Matrix for:

- `deriveResultStatus(count)` → `miss` / `hit_single` / `hit_multi`
- `deriveMatchedDeepLadder(matched_key_type)` → true only for `punct_stripped` and `nospace`

### `query_log_consent.test.ts` — new

Agree/decline, version bump invalidates, session bucket creation.

### `query_log_inspect.test.ts` — update

`queryLogHitMiss` accepts v1 `ir_ids_count` and v2 `result_count`.

### `i18n.test.ts` — add

`logging.consentPrompt`, `logging.copyDiagnostics` resolve in `en` and `fr`.

### `search_query.test.ts`

If present: assert `query_normalized_keys` populated and `last_tried_normalized_key` on miss. If absent, add one focused test file.

### Manual smoke (post-implementation)

1. Enable logging → consent prompt → agree.
2. Search hit single, hit multi, miss.
3. Diagnostics show new columns + stats.
4. Export JSONL → verify v2 lines with `top_ir_ids`, `latency_ms`, `matched_deep_ladder`.
5. Copy diagnostics → paste check.
6. Turn off → new searches not logged; old rows remain.
7. Clear → empty.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| `SearchResult` extension perceived as behavior change | Document as metadata-only; no ladder/lookup logic change; test search outputs unchanged for same index |
| `catalog_version` often missing (manual import) | Optional field; diagnostics show `unknown` |
| Retention prune performance on large stores | Run only on append; use cursors; cap at 2000 limits worst case |
| Consent `window.confirm` UX | Acceptable for tester diagnostics; not consumer UI |
| Mixed v1/v2 complicates UI helpers | Centralize in `query_log_derive.ts` / `query_log_inspect.ts` |
| `crypto.randomUUID` in old browsers | Extremely unlikely for target PWA; test injects fallback |
| Latency includes `resolveRecords` on hits | Measure at schedule time from `runSearch` t0 (includes record fetch for hits) — document as end-to-end settled search latency, not index-only |
| Deferred anonymized export | Call out in tester packet until shipped |

---

## 10. Non-goals

Track A explicitly excludes:

- Offline analyzer CLI (`analyze_query_evidence.py`) and `shared/query_evidence/` artifacts
- Remote telemetry, third-party analytics, automatic upload
- Search ladder/ranking/normalization behavior changes
- New aliases, supplements, phrase aliases
- Bundle, catalog, or production asset changes
- ROADMAP or deployment config updates
- Anonymized export (deferred within Track A; default export only)
- Consumer-facing analytics UI
- Auto-classification or auto-approval of gap candidates

---

## 11. Recommendation

**Approve Track A as one focused implementation PR** with this execution order:

1. **Types + derive + consent modules** — schema, `result_status` / `matched_deep_ladder` derivation, localStorage API, tests.
2. **`search_query.ts` metadata extension** — smallest `SearchResult` additive fields; test unchanged hit/miss outcomes.
3. **`query_log_store.ts` v2 append + retention + stats** — store tests including 2001/91-day cases.
4. **`query_log_runtime.ts` v2 wiring** — remove recompute; consent + session bucket gates.
5. **`main.ts` + i18n** — consent toggle, latency/catalog/locale pass, diagnostics table/stats/copy.
6. **Controls + inspect updates** — export passthrough, clipboard helper.
7. **Full verification:**

```bash
cd web && npm run test:run -- src/query_logging/ src/i18n.test.ts src/search/search_query.test.ts
cd web && npm run test:run
cd web && npm run build
```

**Defer to follow-up PR (Track A.1 or early Track B prep):** anonymized export with Web Crypto hashing and analyzer contract.

### Approved decisions (unchanged)

- Extend Phase 5B logging in place
- Do not create a parallel logging system
- Write v2 forward
- Keep v1 rows readable/exportable
- No IndexedDB schema version bump
- No anonymized export in Track A
- No offline analyzer in Track A
- No bundle/catalog/search behavior changes
- Diagnostics only inside Advanced diagnostics
- Consent required before first v2 log write
- Retention cap: 2000 events / 90 days

**Do not** migrate v1 rows — extend Phase 5B in place, write v2 forward, export mixed JSONL, and keep all surfacing inside Advanced diagnostics with tester consent.

---

**Planning only. No implementation until this Track A plan is reviewed.**
