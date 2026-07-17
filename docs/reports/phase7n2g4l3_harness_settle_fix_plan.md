# Phase 7N2G4L3 — Draft Minimal Fix for Selected Round 2 Issue

## Decision

```text
HARNESS_SETTLE_FIX_PLAN_READY
```

Planning only. No code was implemented. No product search behavior, phrase-guidance
copy, catalog, bundles, source data, matrices, packages, or runtime product code
were changed.

Selected issue: `7n2g_r2_harness_settle_timeout`

## 1. Inputs

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2g4l2_remaining_usage_evidence_review_report.md` | Selected R2 harness settle timeout |
| `web/e2e/human_usage/usage_harness.spec.ts` | Current `runQuery` / `waitForSettledSearchMeta` / miss classification |

## 2. Current settle behavior

In `runQuery`:

1. Read `previousSearchMetaText` from `#searchMeta`.
2. `fill` the query into `#searchInput`.
3. Call `waitForSettledSearchMeta(searchMeta, previousSearchMetaText, query)`.
4. Classify settled meta via `deriveObservedStatus`.

`waitForSettledSearchMeta` currently returns success only when:

```ts
latest.length > 0 && (latest !== previousSearchMetaText || latest.includes(query))
```

Otherwise it polls until `queryTimeoutMs` and throws:

```text
Search metadata did not settle for "<query>" within <N>ms. Last meta: <latest>
```

`deriveObservedStatus` already recognizes no-result / phrase-miss guidance
(including shipped J3 copy: `Try searching one word at a time.` /
`Essayez de chercher un mot à la fois.`).

## 3. Failure cause

Evidence row `how do you say thank you` recorded:

- automation `status: error`
- last meta already showed phrase-miss guidance
- settle timeout fired anyway

Root cause:

1. Phrase-miss / some no-result copy does **not** include the query string.
2. Consecutive phrase-like misses can leave `#searchMeta` text **unchanged**
   (same guidance string as the previous query).
3. Settle predicate then fails both branches:
   - `latest === previousSearchMetaText`
   - `latest.includes(query)` is false
4. Harness times out despite correct product empty-state already being visible.

This remains valid after J3 short phrase copy, which also omits the query.

## 4. Minimal fix (for L4 implementation)

Keep the fix limited to `web/e2e/human_usage/usage_harness.spec.ts`.

### Recommended settle predicate update

Treat recognized no-result / phrase-miss meta as settled when it is already
visible **after** the query has been entered, even if:

- meta equals the previous meta text, and
- meta does not include the query substring.

Concretely, extend `waitForSettledSearchMeta` (or a tiny helper) so success is:

1. existing condition: non-empty meta and (`meta !== previous` or `meta.includes(query)`), **or**
2. new condition: non-empty meta matches the same miss/phrase-miss recognition used by `deriveObservedStatus` **and** `#searchInput` value equals the submitted query.

Optional hardening (still harness-only, if needed for race safety):

- require the miss meta to remain unchanged for a short quiet window (e.g. 1–2 poll cycles) after input matches the query, so a stale previous miss is not accepted before the new search lands.

### Preferred helper reuse

Factor or call the same miss-text recognition already used by
`deriveObservedStatus` (regex / helper) so phrase-miss and single-word miss
copy stay in sync with evidence classification.

## 5. Non-goals

L4 must **not**:

- change product search / index behavior
- change phrase-guidance or other i18n product copy
- edit `web/src/` runtime product code
- edit catalog, bundles, source data, matrices, or packages
- add English translation features or phrase aliases
- reopen Son/`prix`, `fièvre`, or `poulet`
- broaden into general harness rewrites beyond settle/miss recognition needed for this defect

## 6. Test / verification plan (L4+)

| Check | Expected |
| --- | --- |
| Focused harness logic reasoning / unitizable helper if extracted | Miss meta without query substring counts as settled when input matches query |
| Consecutive phrase-like misses simulation | Second miss with identical guidance does not throw settle timeout |
| Single-word miss that includes query | Still settles (existing path) |
| Hit path | Still settles when meta changes to result-count text |
| Product copy | Unchanged EN/FR phrase guidance strings |
| Scope | Diff limited to usage harness (+ this report chain) |

If full Playwright usage e2e is too heavy for the slice, L4 should still implement
the predicate fix and document the verification performed (focused helper test
and/or targeted e2e). Do not require product unit-suite changes unless a tiny
pure helper is extracted into a testable module; prefer keeping the fix local to
the harness file.

## 7. Decision

```text
HARNESS_SETTLE_FIX_PLAN_READY
```

## 8. Next slice definition

**Phase 7N2G4L4 — Implement Harness Settle Fix**

Purpose: implement the minimal `waitForSettledSearchMeta` update in
`web/e2e/human_usage/usage_harness.spec.ts` so already-visible no-result /
phrase-miss guidance settles correctly for consecutive identical miss messages.

## 9. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

L3 created only this report. No edits to harness code, product runtime, catalog,
bundles, source data, matrices, packages, or phrase-guidance copy.
