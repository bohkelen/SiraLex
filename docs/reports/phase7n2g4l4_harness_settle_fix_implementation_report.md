# Phase 7N2G4L4 — Implement Harness Settle Fix

## Decision

```text
HARNESS_SETTLE_FIX_IMPLEMENTED
```

Implemented the L3 harness settle fix in the usage automation only. No product
search behavior, phrase-guidance copy, `web/src/` runtime, catalog, bundles,
source data, matrices, packages, or review artifacts were changed.

## 1. Input

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2g4l3_harness_settle_fix_plan.md` | Approved settle predicate plan |
| `web/e2e/human_usage/usage_harness.spec.ts` | Implementation target |

## 2. Implemented settle behavior

Factored shared helper:

- `isNoResultMeta(text)` — same miss/phrase-miss recognition previously inlined in `deriveObservedStatus`

Updated `waitForSettledSearchMeta(searchMeta, searchInput, previous, query)`:

1. **Existing path (unchanged intent):** non-empty meta and (`meta !== previous` or `meta.includes(query)`).
2. **New path:** non-empty meta is a recognized no-result/phrase-miss **and** `#searchInput` value equals the submitted query **and** that miss text is stable for ≥2 poll cycles **and** at least 250ms has elapsed since wait start (covers 150ms search debounce + short headroom).

`deriveObservedStatus` now calls `isNoResultMeta` so settle and evidence classification stay aligned.

## 3. Files changed

| Path | Change |
| --- | --- |
| `web/e2e/human_usage/usage_harness.spec.ts` | Factor `isNoResultMeta`; extend settle predicate; pass `searchInput` into waiter |
| `docs/reports/phase7n2g4l4_harness_settle_fix_implementation_report.md` | This report |

## 4. Explicit non-changes

- No `web/src/` product runtime edits
- No i18n / phrase-guidance copy edits
- No catalog / bundle / source / matrix / package edits
- No Son/`prix`, `fièvre`, `poulet` reopen

## 5. Verification

| Check | Result |
| --- | --- |
| `npm --prefix web run test:e2e:usage` | **Pass** (build + Playwright; 1 test, 26.4s) |
| Fresh run evidence | `usage_2026-07-17T23-04-22-740Z` — 68 rows, **0** `error` statuses; no “did not settle” metas |
| Product phrase copy | Unchanged (no i18n edits) |
| Scope | Harness + report only |

Behavioral outcomes observed:

- consecutive phrase-like misses no longer produce settle-timeout errors
- suite completed with single-word misses and hits still classified normally
- product copy unchanged

## 6. Decision

```text
HARNESS_SETTLE_FIX_IMPLEMENTED
```

## 7. Next slice definition

**Phase 7N2G4L5 — Verify Harness Settle Fix**

Purpose: verify the harness settle fix against the L3 contract (consecutive
phrase misses, single-word miss, hit path, unchanged product copy) without
expanding scope.
