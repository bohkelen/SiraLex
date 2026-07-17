# Phase 7N2G4L5 — Verify Harness Settle Fix

## Decision

```text
HARNESS_SETTLE_FIX_VERIFIED
```

Verification only. No new harness behavior, product runtime, phrase-guidance copy,
catalog, bundles, source data, matrices, packages, or review artifacts were
changed. Son/`prix`, `fièvre`, and `poulet` were not reopened.

## 1. Inputs

| Path | Role |
| --- | --- |
| `docs/reports/phase7n2g4l3_harness_settle_fix_plan.md` | L3 contract |
| `docs/reports/phase7n2g4l4_harness_settle_fix_implementation_report.md` | L4 implement record |
| `web/e2e/human_usage/usage_harness.spec.ts` | Current settle implementation |
| L4 evidence | `data/local_evidence/human_usage_automation/usage_2026-07-17T23-04-22-740Z/` |
| L5 re-run evidence | `data/local_evidence/human_usage_automation/usage_2026-07-17T23-09-09-072Z/` |

## 2. Code contract checks (read-only)

| Check | Observation | Result |
| --- | --- | --- |
| Shared miss recognition | `isNoResultMeta` used by settle + `deriveObservedStatus` | **PASS** |
| Settle when input matches query on miss meta | Branch requires `inputValue === query && isNoResultMeta(latest)` with ≥2 stable polls and ≥250ms | **PASS** |
| Existing settle paths retained | `latest !== previous` or `latest.includes(query)` still return early | **PASS** |
| L4 diff scope | Only harness + L4 report (no `web/src/`, catalog, bundles, matrices, packages) | **PASS** |
| Product phrase copy unchanged | `web/src/i18n.ts` still EN/FR primary phrase guidance; no L4/L5 i18n edits | **PASS** |

## 3. Usage-run verification

### L4 run (`usage_2026-07-17T23-04-22-740Z`)

| Metric | Value |
| --- | --- |
| Rows | 68 |
| `error` / “did not settle” | **0** |
| Phrase-like misses (examples) | `comment dit-on école`, `combien ça coûte`, `merci beaucoup`, `how do you say thank you` → `miss` + `Try searching one word at a time.` |
| Single-word misses | Classified as `miss` with `No results for "<query>"…` |

### L5 re-run (`npm --prefix web run test:e2e:usage`)

| Metric | Value |
| --- | --- |
| Playwright | **1 passed** (build + harness, ~23s) |
| Fresh evidence | `usage_2026-07-17T23-09-09-072Z` |
| Rows | 68 |
| `error` / settle timeouts | **0** |
| Consecutive phrase-like misses | Settle without timeout (e.g. multiple phrase rows including `how do you say thank you`) |
| Single-word miss classification | Still `miss` with query-bearing no-result copy |

### Hit-path note

Default `test:e2e:usage` installs the small debug bundle
(`web/public/debug-bundles/test_directional_bundle`), so this corpus is
all-`miss` and does not exercise hit classification against featured 7N2B.
Hit settle still uses the retained first branch (`meta !== previous` /
`meta.includes(query)`). No regression signal for hits in these runs; full-bundle
hit smoke remains outside this harness default.

## 4. Checklist

| Requirement | Result |
| --- | --- |
| Consecutive phrase-like misses no longer timeout | **PASS** |
| Recognized no-result/phrase-miss meta settles when input equals query | **PASS** (code + 0 settle errors) |
| Single-word misses still classify normally | **PASS** |
| Hits still classify normally | **PASS** (code path retained; default debug-bundle run has no hits) |
| Product copy unchanged | **PASS** |
| No `web/src/` runtime product change | **PASS** |
| No catalog/bundle/source/matrix/package change | **PASS** |

## 5. Issues found

None. No repair required.

## 6. Decision

```text
HARNESS_SETTLE_FIX_VERIFIED
```

## 7. Next slice definition

**Phase 7N2G4L6 — Close Harness Settle Fix Workstream**

Purpose: close the 7N2G harness settle-fix workstream after verified
implementation, recording residual notes and next practical follow-up.

## 8. Confirmation: no runtime / catalog / bundle / source / matrix / package changes

L5 created only this report. No edits to harness code, product runtime, i18n,
catalog, bundles, source data, matrices, packages, or review artifacts.
